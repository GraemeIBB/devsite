import { glyphIndex } from "./atlas";

// ---- document -> cell grid ---------------------------------------------
// pure (no DOM/GL). parse(src) -> blocks; layout(blocks, cols) -> grid arrays
// packed 1 byte/cell each: glyph, style (palette idx), flags, link id.
//
// styles: 0 text 1 heading 2 dim 3 link 4 code 5 accent 6 quote
// flags:  1 bold  2 underline  4 code-bg  8 scene-window
export const STYLE = { text: 0, heading: 1, dim: 2, link: 3, code: 4, accent: 5, quote: 6 };
export const FLAG = { bold: 1, underline: 2, codeBg: 4, window: 8 };

// block registry: parse rules are ordered, layout fns keyed by block.type.
// add a block type = one entry in each. (layout fns get a Writer, see below)

export function parseInline(raw) {
	const atoms = [];
	let bold = false;
	let code = false;
	for (let i = 0; i < raw.length; ) {
		if (!code && raw.startsWith("**", i)) { bold = !bold; i += 2; continue; }
		if (raw[i] === "`") { code = !code; i++; continue; }
		if (raw[i] === "[" && !code) {
			const m = raw.slice(i).match(/^\[([^\]]+)\]\(([^)]+)\)/);
			if (m) {
				for (const ch of m[1]) atoms.push({ ch, bold, code, link: m[2] });
				i += m[0].length;
				continue;
			}
		}
		atoms.push({ ch: raw[i], bold, code, link: null });
		i++;
	}
	return atoms;
}
export const plain = (raw) => parseInline(raw).map((a) => a.ch).join("");

const isBullet = (l) => /^\s*[-*]\s+/.test(l);
const isQuote = (l) => /^>\s?/.test(l);
const isStart = (l) => /^(```|:::|#{1,3}\s|---+\s*$)/.test(l) || isBullet(l) || isQuote(l);

export function parse(src) {
	const lines = src.replace(/\r/g, "").split("\n");
	const blocks = [];
	for (let i = 0; i < lines.length; ) {
		const l = lines[i];
		let m;
		if (!l.trim()) { i++; continue; }
		if (/^```/.test(l)) {
			const code = [];
			for (i++; i < lines.length && !/^```/.test(lines[i]); i++) code.push(lines[i]);
			i++;
			blocks.push({ type: "code", lines: code });
		} else if ((m = l.match(/^:::window\s*(\d+)?/))) {
			blocks.push({ type: "window", rows: +(m[1] || 10) });
			i++;
		} else if (/^---+\s*$/.test(l)) {
			blocks.push({ type: "hr" });
			i++;
		} else if ((m = l.match(/^(#{1,3})\s+(.*)/))) {
			blocks.push({ type: "h", level: m[1].length, text: m[2] });
			i++;
		} else if (isBullet(l)) {
			const items = [];
			for (; i < lines.length && lines[i].trim() && (isBullet(lines[i]) || /^\s{2,}\S/.test(lines[i])); i++) {
				if (isBullet(lines[i])) items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
				else items[items.length - 1] += " " + lines[i].trim();
			}
			blocks.push({ type: "ul", items });
		} else if (isQuote(l)) {
			const parts = [];
			for (; i < lines.length && isQuote(lines[i]); i++) parts.push(lines[i].replace(/^>\s?/, ""));
			blocks.push({ type: "quote", text: parts.join(" ") });
		} else {
			const parts = [];
			for (; i < lines.length && lines[i].trim() && !isStart(lines[i]); i++) parts.push(lines[i].trim());
			blocks.push({ type: "p", text: parts.join(" ") });
		}
	}
	return blocks;
}

// word-wrap atoms to `width` cells. spaces inherit the link if both neighbours share it.
function wrap(atoms, width) {
	const words = [];
	let cur = [];
	for (const a of atoms) {
		if (a.ch === " ") { if (cur.length) { words.push(cur); cur = []; } }
		else cur.push(a);
	}
	if (cur.length) words.push(cur);
	const lines = [];
	let line = [];
	for (let w of words) {
		while (w.length > width) {
			if (line.length) { lines.push(line); line = []; }
			lines.push(w.slice(0, width));
			w = w.slice(width);
		}
		if (line.length && line.length + 1 + w.length > width) { lines.push(line); line = []; }
		if (line.length) {
			const prev = line[line.length - 1];
			line.push({ ch: " ", bold: false, code: false, link: prev.link === w[0].link ? prev.link : null });
		}
		line.push(...w);
	}
	if (line.length) lines.push(line);
	return lines;
}

class Writer {
	constructor(cols) {
		this.cols = cols;
		this.rows = 0;
		this.glyph = [];
		this.style = [];
		this.flags = [];
		this.link = [];
		this.links = [];
	}
	ensure(row) {
		while (this.rows <= row) {
			for (let c = 0; c < this.cols; c++) {
				this.glyph.push(0); this.style.push(0); this.flags.push(0); this.link.push(0);
			}
			this.rows++;
		}
	}
	linkId(url) {
		let i = this.links.indexOf(url);
		if (i < 0) i = this.links.push(url) - 1;
		return Math.min(i + 1, 255);
	}
	put(row, col, ch, style = 0, flags = 0, link = 0) {
		if (col < 0 || col >= this.cols) return;
		this.ensure(row);
		const k = row * this.cols + col;
		this.glyph[k] = glyphIndex(ch);
		this.style[k] = style;
		this.flags[k] = flags;
		this.link[k] = link;
	}
	fill(row, col, n, flags, style = 0) {
		for (let c = 0; c < n; c++) this.put(row, col + c, " ", style, flags);
	}
	// emit wrapped inline atoms; returns rows used
	atoms(row, col, atoms, width, { style = STYLE.text, flags = 0 } = {}) {
		const lines = wrap(atoms, width);
		lines.forEach((line, r) => {
			line.forEach((a, c) => {
				const f = flags | (a.bold ? FLAG.bold : 0) | (a.link ? FLAG.underline : 0);
				this.put(row + r, col + c, a.ch, a.link ? STYLE.link : a.code ? STYLE.code : style, f, a.link ? this.linkId(a.link) : 0);
			});
		});
		return { rows: lines.length, widest: Math.max(0, ...lines.map((l) => l.length)) };
	}
	text(row, col, str, style, flags = 0) {
		[...str].forEach((ch, c) => this.put(row, col + c, ch, style, flags));
	}
}

const LAYOUT = {
	h(w, b, row) {
		let atoms = parseInline(b.text);
		if (b.level === 1) atoms = atoms.map((a) => ({ ...a, ch: a.ch.toUpperCase() }));
		if (b.level === 3) atoms = [{ ch: "+", bold: true, code: false, link: null }, { ch: " ", bold: false, code: false, link: null }, ...atoms];
		const style = b.level === 3 ? STYLE.accent : STYLE.heading;
		const { rows, widest } = w.atoms(row, 0, atoms, w.cols, { style, flags: FLAG.bold });
		if (b.level === 3) return rows;
		w.text(row + rows, 0, (b.level === 1 ? "=" : "-").repeat(widest), STYLE.dim);
		return rows + 1;
	},
	p: (w, b, row) => w.atoms(row, 0, parseInline(b.text), w.cols).rows,
	ul(w, b, row) {
		let r = 0;
		for (const item of b.items) {
			w.put(row + r, 0, "*", STYLE.accent, FLAG.bold);
			r += w.atoms(row + r, 2, parseInline(item), w.cols - 2).rows;
		}
		return r;
	},
	quote(w, b, row) {
		const { rows } = w.atoms(row, 2, parseInline(b.text), w.cols - 2, { style: STYLE.quote });
		for (let r = 0; r < rows; r++) w.put(row + r, 0, "|", STYLE.dim);
		return rows;
	},
	code(w, b, row) {
		const n = b.lines.length + 2; // 1 row pad top + bottom
		for (let r = 0; r < n; r++) w.fill(row + r, 0, w.cols, FLAG.codeBg);
		b.lines.forEach((l, r) => {
			[...l.replace(/\t/g, "  ").slice(0, w.cols - 2)].forEach((ch, c) => w.put(row + 1 + r, 1 + c, ch, STYLE.code, FLAG.codeBg));
		});
		return n;
	},
	window(w, b, row) {
		for (let r = 0; r < b.rows; r++) w.fill(row + r, 0, w.cols, FLAG.window);
		return b.rows;
	},
	hr(w, b, row) {
		w.text(row, 0, "-".repeat(w.cols), STYLE.dim);
		return 1;
	},
};

export function layout(blocks, cols) {
	const w = new Writer(cols);
	let row = 1; // top pad
	for (const b of blocks) {
		row += LAYOUT[b.type](w, b, row) + 1; // +1 gap row
	}
	w.ensure(row); // bottom pad
	const u8 = (a) => Uint8Array.from(a);
	return { cols, rows: w.rows, glyph: u8(w.glyph), style: u8(w.style), flags: u8(w.flags), link: u8(w.link), links: w.links };
}

// pack into RGBA8: r glyph, g style, b flags, a link id
export function pack(doc) {
	const n = doc.cols * doc.rows;
	const data = new Uint8Array(n * 4);
	for (let k = 0; k < n; k++) {
		data[k * 4] = doc.glyph[k];
		data[k * 4 + 1] = doc.style[k];
		data[k * 4 + 2] = doc.flags[k];
		data[k * 4 + 3] = doc.link[k];
	}
	return data;
}
