import { glyphIndex } from "./atlas";

// pure helpers for in-grid find / select / copy — no DOM, no GL.
// the doc is flattened to one string, rows joined by "\n", so flat index
// k = row * (cols + 1) + col. indices map straight back to cells.
export const stride = (doc) => doc.cols + 1;

export function flatten(doc) {
	const s = stride(doc);
	const out = new Array(doc.rows * s);
	for (let r = 0; r < doc.rows; r++) {
		for (let c = 0; c < doc.cols; c++) out[r * s + c] = String.fromCharCode(32 + doc.glyph[r * doc.cols + c]);
		out[r * s + doc.cols] = "\n";
	}
	return out.join("");
}

// last non-space col + 1 per row (highlights stop at the end of the text)
export function rowLens(doc) {
	const lens = new Uint16Array(doc.rows);
	for (let r = 0; r < doc.rows; r++) {
		for (let c = doc.cols - 1; c >= 0; c--) {
			if (doc.glyph[r * doc.cols + c]) { lens[r] = c + 1; break; }
		}
	}
	return lens;
}

// ---- vim-style patterns -> RegExp ------------------------------------------
// nvim "magic" mode: `. * [] ^ $` are special bare; `\+ \? \= \| \( \) \{n,m} \< \>`
// need the backslash; bare `+ ? | ( ) { }` are literal.
//   \c / \C  force ignore / match case (anywhere in the pattern)
//   default is ignorecase + smartcase: an uppercase letter makes it case-sensitive
//   \V        rest of the pattern is literal
//   \d \w \s \a \l \u (+ \D \W \S)  classes;  \n  a row break
// a space matches any run of whitespace INCLUDING row breaks, so a phrase still
// matches across a word-wrap (rows are padded, so one space is not enough).
// an invalid pattern falls back to a literal search rather than throwing.
const esc = (c) => c.replace(/[\\^$.*+?()[\]{}|/-]/g, "\\$&");
const WS = "[ \\n]+";

export function compilePattern(src) {
	let ic = null;
	let literal = false;
	let out = "";
	const last = () => out.slice(-1);
	const atomStart = () => out === "" || out.endsWith("(") || out.endsWith("|");
	for (let i = 0; i < src.length; ) {
		const ch = src[i++];
		if (literal) { out += ch === " " ? WS : esc(ch); continue; }
		if (ch === "\\") {
			const n = src[i++];
			if (n === undefined) { out += "\\\\"; break; }
			switch (n) {
				case "c": ic = true; break;
				case "C": ic = false; break;
				case "V": literal = true; break;
				case "<": case ">": out += "\\b"; break;
				case "+": out += "+"; break;
				case "?": case "=": out += "?"; break;
				case "|": out += "|"; break;
				case "(": case ")": out += n; break;
				case "{": {
					const end = src.indexOf("}", i);
					if (end < 0) { out += "\\{"; break; }
					let body = src.slice(i, end).replace(/\\$/, "");
					const lazy = body.startsWith("-");
					if (lazy) body = body.slice(1);
					out += body === "" ? (lazy ? "*?" : "*") : `{${body.includes(",") || /^\d+$/.test(body) ? body : ""}}${lazy ? "?" : ""}`;
					i = end + 1;
					break;
				}
				case "d": case "D": case "w": case "W": out += "\\" + n; break;
				case "s": out += "[ \\n]"; break;
				case "S": out += "[^ \\n]"; break;
				case "a": out += "[A-Za-z]"; break;
				case "l": out += "[a-z]"; break;
				case "u": out += "[A-Z]"; break;
				case "n": out += "\\n"; break;
				case "t": out += "\\t"; break;
				default: out += esc(n);
			}
		} else if (ch === ".") out += "[^\\n]";
		else if (ch === "*") out += atomStart() || last() === "^" ? "\\*" : "*";
		else if (ch === "^") out += atomStart() ? "^" : "\\^";
		else if (ch === "$") out += i >= src.length || src.startsWith("\\)", i) || src.startsWith("\\|", i) ? "(?=[ ]*$)" : "\\$"; // rows are space-padded, so $ means "only padding left"
		else if (ch === "[") {
			const end = src.indexOf("]", i + 1);
			if (end < 0) out += "\\[";
			else { out += `[${src.slice(i, end)}]`; i = end + 1; }
		} else if (ch === " ") out += WS;
		else out += esc(ch);
	}
	const ignore = ic ?? !/[A-Z]/.test(src.replace(/\\./g, ""));
	const flags = "gm" + (ignore ? "i" : "");
	try {
		return new RegExp(out, flags);
	} catch {
		return new RegExp(src.split(" ").map(esc).join(WS), flags);
	}
}

const MAX_HITS = 5000;
export function findAll(flat, pattern) {
	if (!pattern) return [];
	const re = compilePattern(pattern);
	const hits = [];
	for (let m = re.exec(flat); m && hits.length < MAX_HITS; m = re.exec(flat)) {
		if (!m[0].length) { re.lastIndex++; continue; }
		hits.push({ start: m.index, len: m[0].length });
	}
	return hits;
}

// inclusive flat range of the non-space run around `k`, within its row; null on a space
export function wordAt(flat, doc, k) {
	if (flat[k] === " ") return null;
	const s = stride(doc);
	const rowStart = Math.floor(k / s) * s;
	let a = k, b = k;
	while (a > rowStart && flat[a - 1] !== " ") a--;
	while (b < rowStart + doc.cols - 1 && flat[b + 1] !== " ") b++;
	return [a, b];
}

// text of the inclusive flat range [lo, hi], one line per row, trailing space trimmed
export function textOf(flat, doc, lo, hi) {
	const s = stride(doc);
	const r0 = Math.floor(lo / s), r1 = Math.floor(hi / s);
	const lines = [];
	for (let r = r0; r <= r1; r++) {
		const c0 = r === r0 ? lo - r * s : 0;
		const c1 = r === r1 ? hi - r * s : doc.cols - 1;
		lines.push(flat.slice(r * s + c0, r * s + Math.min(c1, doc.cols - 1) + 1).trimEnd());
	}
	return lines.join("\n");
}

// the command/search bar as one screen row of cells (r glyph, g style — layout.js STYLE)
export function barRow(totalCols, { prefix = "", text = "", textStyle = 1, cursor = false, right = "", rightStyle = 2 }) {
	const d = new Uint8Array(totalCols * 4);
	const put = (c, ch, style, flags = 0) => {
		if (c < 0 || c >= totalCols) return;
		d[c * 4] = glyphIndex(ch);
		d[c * 4 + 1] = style;
		d[c * 4 + 2] = flags;
	};
	const write = (c, str, style, flags) => [...str].forEach((ch, i) => put(c + i, ch, style, flags));
	const tc = prefix.length > 1 ? prefix.length + 2 : 2; // "find:" gets a gap, "/" hugs its text
	write(1, prefix, 5, 1);
	write(tc, text, textStyle, 1);
	if (cursor) put(tc + text.length, "_", 5, 1);
	write(totalCols - right.length - 1, right, rightStyle);
	return d;
}
