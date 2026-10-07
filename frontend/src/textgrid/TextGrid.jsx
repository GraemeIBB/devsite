import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { makeTextAtlas } from "./atlas";
import { flatten, rowLens, findAll, wordAt, textOf, barRow, stride } from "./search";
import { parse, layout, pack, plain, MAX_IMAGES } from "./layout";
import { makeTextGridMaterial } from "./shader";

// full-screen text grid: one texel per glyph cell, drawn through a font atlas.
// spike — owns its own canvas (not yet folded into the scene's ascii pass).
// scroll is lerp-only (wheel/keys/touch move a target, the view eases to it).
// keys: arrows / pgup / pgdn / space / home / end.
// text interaction lives in the grid, not the DOM: drag or double-click to
// highlight, ctrl+A / ctrl+C. two searches, both drawn as a screen-row prompt
// with live highlighting:
//   ctrl+F   plain find: literal, case-insensitive, enter / shift+enter step, esc closes
//   / and ?  nvim-style: vim magic-mode patterns + \c \C flags (search.js), enter
//            commits, n / N step, esc clears
// docs are read-only, so `:` is navigation only (`:42`, `:$`, `:noh`) plus
// whatever `onCommand` handles (return true). also j k gg G ctrl-d ctrl-u. the
// hidden DOM mirror below is only for assistive tech.
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// touch fling: release velocity decays with this time constant (s), like native
// momentum scroll; slower than FLING_MIN (device px/s) just stops
const FLING_TAU = 0.325;
const FLING_MIN = 20;
const IMG_SLOT = 256; // px per image in the atlas: plenty, it's sampled once per cell

// `reveal` true dithers the doc in over `revealMs` (cell-stipple, transparent
// until revealed so whatever is underneath shows through); false dithers it out
// again and then calls `onHidden`.
export default function TextGrid({ source, maxCols = 88, fontPx = 18, onLink, reveal = true, revealMs = 900, onHidden, onCommand }) {
	const host = useRef();
	const blocks = useMemo(() => parse(source), [source]);
	const onLinkRef = useRef(onLink);
	onLinkRef.current = onLink;
	const onHiddenRef = useRef(onHidden);
	onHiddenRef.current = onHidden;
	const onCommandRef = useRef(onCommand);
	onCommandRef.current = onCommand;
	const revealRef = useRef({ on: reveal, ms: revealMs });
	revealRef.current = { on: reveal, ms: revealMs };

	useEffect(() => {
		const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
		renderer.setClearAlpha(0);
		host.current.appendChild(renderer.domElement);
		const canvas = renderer.domElement;
		canvas.style.touchAction = "none";
		const scene = new THREE.Scene();
		const camera = new THREE.Camera();
		const material = makeTextGridMaterial();
		const u = material.uniforms;
		const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
		mesh.frustumCulled = false;
		scene.add(mesh);

		let dpr = 1, cell = { w: 9, h: 21 }, doc, atlas, gridTex, gridData, barTex, barData;
		let maxScroll = 0, colOff = 0, totalCols = 1, shown = 0;
		let reveal01 = 0, wasShown = false, hover = 0, raf, last = performance.now(), dead = false;
		const scroll = { cur: 0, target: 0 };

		// images (layout.js img blocks): each drawn stretched into its own atlas slot,
		// aspect kept aside so fitImages can letterbox it inside the reserved rows
		const imgCanvas = document.createElement("canvas");
		imgCanvas.width = IMG_SLOT;
		imgCanvas.height = IMG_SLOT * MAX_IMAGES;
		const imgTex = new THREE.CanvasTexture(imgCanvas);
		imgTex.flipY = false; // v=0 is the canvas top, so slot i starts at i / MAX_IMAGES
		u.uImg.value = imgTex;
		const aspects = [];
		blocks.filter((b) => b.type === "img").slice(0, MAX_IMAGES).forEach((b, i) => {
			const im = new Image();
			im.crossOrigin = "anonymous";
			im.onload = () => {
				if (dead) return;
				imgCanvas.getContext("2d").drawImage(im, 0, i * IMG_SLOT, IMG_SLOT, IMG_SLOT);
				imgTex.needsUpdate = true;
				aspects[i] = im.naturalWidth / im.naturalHeight;
				fitImages();
			};
			im.onerror = () => console.warn(`textgrid: image failed to load: ${b.src}`);
			im.src = b.src;
		});
		// contain-fit each loaded image in its box (cells aren't square), left-aligned
		function fitImages() {
			doc.images.slice(0, MAX_IMAGES).forEach((box, i) => {
				const R = u.uImgRect.value[i], a = aspects[i];
				if (!a) return R.set(0, 0, 0, 0);
				const W = box.cols * cell.w, H = box.rows * cell.h;
				const [pw, ph] = W / H > a ? [H * a, H] : [W, W / a];
				R.set(0, box.row, pw / cell.w, ph / cell.h);
			});
		}

		// text-side state, all in flat cell indices (search.js): selection, find
		let flat = "", lens, overlay;
		let sel = null; // { a, b } anchor / head, any order
		// nvim-style: mode "off" | "input" (typing at / ? :) | "active" (pattern committed,
		// hits highlighted, n/N step) | "msg" (an error line). `last` survives :noh for n/N.
		const find = { mode: "off", kind: "/", text: "", dir: 1, pattern: "", last: "", hits: [], cur: 0, note: "", msg: "", origin: 0, histIdx: -1 };
		const history = { "/": [], ":": [] };
		let pendingG = 0;
		let drag = null, lastPtr = null, justDragged = false;

		function build() {
			dpr = Math.min(window.devicePixelRatio || 1, 2);
			renderer.setPixelRatio(dpr);
			renderer.setSize(window.innerWidth, window.innerHeight);
			const res = renderer.getDrawingBufferSize(new THREE.Vector2());

			atlas?.texture.dispose();
			atlas = makeTextAtlas(Math.round(fontPx * dpr));
			cell = atlas.cell;

			totalCols = Math.floor(res.x / cell.w);
			const cols = Math.max(20, Math.min(maxCols, totalCols - 2)); // last col = scrollbar
			colOff = Math.floor((totalCols - cols) / 2);
			doc = layout(blocks, cols);
			if (doc.rows > renderer.capabilities.maxTextureSize) console.warn("textgrid: doc taller than max texture size");

			gridTex?.dispose();
			gridData = pack(doc);
			gridTex = new THREE.DataTexture(gridData, doc.cols, doc.rows, THREE.RGBAFormat);
			gridTex.needsUpdate = true;
			barTex?.dispose();
			barData = new Uint8Array(totalCols * 4);
			barTex = new THREE.DataTexture(barData, totalCols, 1, THREE.RGBAFormat);
			barTex.needsUpdate = true;

			u.uGrid.value = gridTex;
			u.uBar.value = barTex;
			u.uAtlas.value = atlas.texture;
			u.uRes.value.copy(res);
			u.uCell.value.set(cell.w, cell.h);
			u.uGridSize.value.set(doc.cols, doc.rows);
			u.uColOff.value = colOff;
			fitImages();
			maxScroll = Math.max(0, doc.rows * cell.h - res.y + cell.h);
			scroll.target = clamp(scroll.target, 0, maxScroll);
			scroll.cur = clamp(scroll.cur, 0, maxScroll);

			// a relayout moves every cell: derived text state is rebuilt, selection dropped
			flat = flatten(doc);
			lens = rowLens(doc);
			overlay = new Uint8Array(doc.cols * doc.rows);
			sel = null;
			if (find.mode === "active") search(find.pattern, { scrollTo: false });
			else { paint(); updateBar(); }
		}

		// ---- highlights: overlay bits packed into the grid's flags channel ----
		function paint() {
			overlay.fill(0);
			const s = stride(doc);
			// highlights stop at the end of a row's text (rows are space-padded)
			const mark = (k, bit) => {
				const r = Math.floor(k / s), c = k - r * s;
				if (c < lens[r]) overlay[r * doc.cols + c] |= bit;
			};
			if (sel) {
				const lo = Math.min(sel.a, sel.b), hi = Math.max(sel.a, sel.b);
				for (let k = lo; k <= hi; k++) mark(k, 32);
			}
			find.hits.forEach((h, i) => {
				for (let j = 0; j < h.len; j++) mark(h.start + j, i === find.cur ? 128 : 64);
			});
			for (let k = 0; k < overlay.length; k++) gridData[k * 4 + 2] = doc.flags[k] | overlay[k];
			gridTex.needsUpdate = true;
		}
		function updateBar() {
			const m = find.mode;
			u.uBarOn.value = m === "off" ? 0 : 1;
			if (m === "off") return;
			const n = find.hits.length;
			const count = n ? `[${find.cur + 1}/${n}]` : "";
			const bar = {};
			if (m === "input") {
				Object.assign(bar, { prefix: find.kind === "f" ? "find:" : find.kind, text: find.text, cursor: true });
				if (find.kind !== ":") Object.assign(bar, find.text ? (n ? { right: count } : { right: "no match", rightStyle: 5 }) : { right: "esc cancel" });
			} else if (m === "active") {
				Object.assign(bar, { prefix: find.dir > 0 ? "/" : "?", text: find.pattern });
				Object.assign(bar, n ? { right: find.note ? `${find.note}  ${count}` : count } : { right: "E486: Pattern not found", rightStyle: 5 });
			} else {
				Object.assign(bar, { text: find.msg, textStyle: 5 });
			}
			barData.set(barRow(totalCols, bar));
			barTex.needsUpdate = true;
		}
		function showRow(row) {
			const y = row * cell.h, vh = u.uRes.value.y;
			if (y < scroll.target + cell.h || y > scroll.target + vh - cell.h * 3) scroll.target = y - vh * 0.35;
		}
		const hitRow = () => Math.floor(find.hits[find.cur].start / stride(doc));

		// run a pattern; the first hit is the nearest one from `from` (scroll px) in find.dir
		function search(pattern, { scrollTo = true, from = scroll.target } = {}) {
			find.hits = findAll(flat, pattern);
			const top = Math.floor(from / cell.h) * stride(doc);
			let i = find.dir > 0 ? find.hits.findIndex((h) => h.start >= top) : find.hits.findLastIndex((h) => h.start < top);
			if (i < 0) i = find.dir > 0 ? 0 : find.hits.length - 1; // wrapscan
			find.cur = Math.max(0, i);
			find.note = "";
			if (scrollTo && find.hits.length) showRow(hitRow());
			paint();
			updateBar();
		}
		function step(dir) {
			const n = find.hits.length;
			if (!n) return;
			const raw = find.cur + dir;
			find.note = raw >= n ? "hit BOTTOM, continuing at TOP" : raw < 0 ? "hit TOP, continuing at BOTTOM" : "";
			find.cur = (raw + n) % n;
			showRow(hitRow());
			paint();
			updateBar();
		}
		function clearFind(msg = "") {
			find.mode = msg ? "msg" : "off";
			find.msg = msg;
			find.pattern = "";
			find.hits = [];
			paint();
			updateBar();
		}
		function openPrompt(kind) {
			find.mode = "input";
			find.kind = kind;
			find.text = "";
			find.msg = "";
			find.origin = scroll.target;
			find.histIdx = -1;
			if (kind !== ":") find.dir = kind === "?" ? -1 : 1;
			find.hits = [];
			paint();
			updateBar();
		}
		const livePrompt = () => {
			if (find.kind === ":") return updateBar();
			// ctrl+F: literal + always case-insensitive (\c\V); / and ?: full vim patterns
			search(find.kind === "f" ? "\\c\\V" + find.text : find.text, { from: find.origin }); // incsearch
		};
		function cancelPrompt() {
			scroll.target = find.origin;
			if (find.pattern) { find.mode = "active"; search(find.pattern, { scrollTo: false, from: find.origin }); }
			else clearFind();
		}
		function runCommand(cmd) {
			if (!cmd) return clearFind();
			if (/^\d+$/.test(cmd)) { scroll.target = (+cmd - 1) * cell.h; return clearFind(); }
			if (cmd === "$") { scroll.target = maxScroll; return clearFind(); }
			if (cmd === "noh" || cmd === "nohlsearch") return clearFind();
			if (onCommandRef.current?.(cmd)) return clearFind();
			clearFind(`E492: Not an editor command: ${cmd}`);
		}
		function commitPrompt() {
			const text = find.text;
			const hist = history[find.kind === ":" ? ":" : "/"];
			if (text && hist[hist.length - 1] !== text) hist.push(text);
			if (find.kind === ":") return runCommand(text.trim());
			const pattern = text || find.last; // empty repeats the last pattern, like vim
			if (!pattern) return clearFind();
			find.pattern = find.last = pattern;
			find.mode = "active";
			search(pattern, { from: find.origin });
		}
		// n / N: continue in the search's own direction / against it
		function repeatSearch(reverse) {
			if (!find.last) return;
			const dir = find.dir * (reverse ? -1 : 1);
			if (find.mode !== "active") { // after :noh — search again from the view
				find.mode = "active";
				find.pattern = find.last;
				const d = find.dir;
				find.dir = dir;
				search(find.pattern);
				find.dir = d;
			} else step(dir);
		}
		const selectedText = () => (sel ? textOf(flat, doc, Math.min(sel.a, sel.b), Math.max(sel.a, sel.b)) : "");

		function frame(now) {
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			// drag-select near the top/bottom edge autoscrolls, and the head follows
			if (drag?.moved && lastPtr) {
				const y = lastPtr.clientY * dpr, vh = u.uRes.value.y;
				const edge = y < cell.h * 1.5 ? -1 : y > vh - cell.h * 2.5 ? 1 : 0;
				if (edge) {
					scroll.target += edge * dt * cell.h * 24;
					sel = { a: drag.anchor, b: flatAt(lastPtr, true) };
					paint();
				}
			}
			if (fling.v) {
				scroll.target += fling.v * dt;
				fling.v *= Math.exp(-dt / FLING_TAU);
				if (Math.abs(fling.v) < FLING_MIN || scroll.target <= 0 || scroll.target >= maxScroll) fling.v = 0;
			}
			scroll.target = clamp(scroll.target, 0, maxScroll);
			if (fling.v) scroll.cur = scroll.target; // coasting is already smooth: no lerp lag
			else scroll.cur += (scroll.target - scroll.cur) * (1 - Math.exp(-dt * 14));
			shown = scroll.cur;
			const totalPx = doc.rows * cell.h;
			const size = Math.min(1, u.uRes.value.y / totalPx);
			u.uScroll.value = shown;
			u.uTime.value = now / 1000;
			u.uThumbSize.value = size;
			u.uThumb.value = maxScroll > 0 ? (shown / maxScroll) * (1 - size) : 0;
			const rv = revealRef.current;
			reveal01 = clamp(reveal01 + ((rv.on ? 1 : -1) * dt * 1000) / rv.ms, 0, 1);
			u.uReveal.value = reveal01;
			if (reveal01 > 0) wasShown = true;
			else if (wasShown && !rv.on) {
				wasShown = false;
				onHiddenRef.current?.(); // fully dissolved (not merely "not yet revealed")
			}
			renderer.render(scene, camera);
			if (!dead) raf = requestAnimationFrame(frame);
		}

		// ---- pointer: links, drag-select, double-click word ----
		const rawCell = (e) => ({
			col: Math.floor((e.clientX * dpr) / cell.w) - colOff,
			row: Math.floor((e.clientY * dpr + shown) / cell.h),
		});
		const inDoc = ({ col, row }) => col >= 0 && col < doc.cols && row >= 0 && row < doc.rows;
		const linkAt = (e) => {
			const c = rawCell(e);
			return inDoc(c) ? doc.link[c.row * doc.cols + c.col] : 0;
		};
		const flatAt = (e, clampToDoc) => {
			let { col, row } = rawCell(e);
			if (!clampToDoc && !inDoc({ col, row })) return -1;
			col = clamp(col, 0, doc.cols - 1);
			row = clamp(row, 0, doc.rows - 1);
			return row * stride(doc) + col;
		};
		const onDown = (e) => {
			if (e.button !== 0 || e.pointerType !== "mouse") return;
			const k = flatAt(e, true);
			if (e.detail === 2) {
				const w = wordAt(flat, doc, k);
				sel = w ? { a: w[0], b: w[1] } : null;
				paint();
				return;
			}
			canvas.setPointerCapture(e.pointerId);
			drag = { anchor: k, x: e.clientX, y: e.clientY, moved: false };
			lastPtr = e;
		};
		const onMove = (e) => {
			hover = linkAt(e);
			u.uHover.value = hover;
			canvas.style.cursor = hover ? "pointer" : "default";
			if (!drag || !(e.buttons & 1)) return;
			lastPtr = e;
			if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 3) drag.moved = true;
			if (drag.moved) {
				sel = { a: drag.anchor, b: flatAt(e, true) };
				paint();
			}
		};
		const onUp = () => {
			if (drag && !drag.moved && sel) { sel = null; paint(); } // plain click clears
			justDragged = !!drag?.moved;
			drag = null;
		};
		const onClick = (e) => {
			if (justDragged) { justDragged = false; return; } // a drag-select is not a link click
			const id = linkAt(e);
			if (!id) return;
			const url = doc.links[id - 1];
			if (onLinkRef.current) onLinkRef.current(url);
			else if (/^https?:/.test(url)) window.open(url, "_blank", "noopener");
		};
		const onWheel = (e) => {
			e.preventDefault();
			scroll.target += (e.deltaMode === 1 ? e.deltaY * cell.h : e.deltaY) * dpr;
		};

		// capture phase on window: runs before page-level handlers (Devlog's Esc),
		// and `eat` stops them when we consumed the key. typing in a real input
		// (the console) is left alone entirely.
		const eat = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };
		const onKey = (e) => {
			if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]")) return;
			const k = e.key;
			const mod = e.ctrlKey || e.metaKey;
			if (["Shift", "Control", "Alt", "Meta"].includes(k)) return;

			if (find.mode === "msg") { // an error line: any key dismisses it, Esc only that
				clearFind();
				if (k === "Escape") return eat(e);
			}
			const lower = k.toLowerCase();
			if (mod && lower === "f") { openPrompt("f"); return eat(e); } // plain browser-style find
			if (mod && lower === "a") {
				sel = { a: 0, b: doc.rows * stride(doc) - 1 };
				paint();
				return eat(e);
			}
			if (mod && lower === "c") {
				const t = selectedText();
				if (!t) return;
				navigator.clipboard?.writeText(t);
				return eat(e);
			}

			if (find.mode === "input") {
				const hist = history[find.kind === ":" ? ":" : "/"];
				if (k === "Escape") { find.kind === "f" ? clearFind() : cancelPrompt(); return eat(e); }
				if (k === "Enter") {
					// ctrl+F stays open and steps (browser-style); / and ? commit, then n / N
					if (find.kind === "f") step(e.shiftKey ? -1 : 1);
					else commitPrompt();
					return eat(e);
				}
				if (k === "Backspace") {
					if (!find.text) cancelPrompt(); // backspace on an empty prompt leaves it, like vim
					else { find.text = find.text.slice(0, -1); livePrompt(); }
					return eat(e);
				}
				if (mod && lower === "u") { find.text = ""; livePrompt(); return eat(e); }
				if (mod && lower === "w") { find.text = find.text.replace(/\S*\s*$/, ""); livePrompt(); return eat(e); }
				if (k === "ArrowUp" || k === "ArrowDown") {
					find.histIdx = clamp(find.histIdx + (k === "ArrowUp" ? 1 : -1), -1, hist.length - 1);
					find.text = find.histIdx < 0 ? "" : hist[hist.length - 1 - find.histIdx];
					livePrompt();
					return eat(e);
				}
				if (k.length === 1 && !mod) { find.text += k; livePrompt(); return eat(e); }
			} else if (!mod) {
				// normal mode
				if (k !== "g") pendingG = 0;
				if (k === "Escape") {
					if (find.mode === "active") { clearFind(); return eat(e); } // like :noh
					if (sel) { sel = null; paint(); return eat(e); } // next Esc leaves the page
				} else if (k === "/" || k === "?" || k === ":") { openPrompt(k); return eat(e); }
				else if (k === "n" || k === "N") { repeatSearch(k === "N"); return eat(e); }
				else if (k === "j") { scroll.target += cell.h; return eat(e); }
				else if (k === "k") { scroll.target -= cell.h; return eat(e); }
				else if (k === "G") { scroll.target = maxScroll; return eat(e); }
				else if (k === "g") {
					const now = performance.now();
					if (now - pendingG < 600) { scroll.target = 0; pendingG = 0; }
					else pendingG = now;
					return eat(e);
				}
			} else if (lower === "d" || lower === "u") {
				const half = (u.uRes.value.y - cell.h * 2) / 2;
				scroll.target += lower === "d" ? half : -half;
				return eat(e);
			}

			const page = u.uRes.value.y - cell.h * 2;
			if (k === "ArrowDown") scroll.target += cell.h * 3;
			else if (k === "ArrowUp") scroll.target -= cell.h * 3;
			else if (k === "PageDown" || (k === " " && !e.shiftKey)) scroll.target += page;
			else if (k === "PageUp" || (k === " " && e.shiftKey)) scroll.target -= page;
			else if (k === "Home") scroll.target = 0;
			else if (k === "End") scroll.target = maxScroll;
			else return;
			e.preventDefault();
		};
		// touch: 1:1 while the finger is down, tracking a smoothed velocity (device
		// px/s); on release frame() coasts on it. a new touch catches the fling.
		let touchY = 0, touchT = 0;
		const fling = { v: 0 };
		const onTouchStart = (e) => {
			touchY = e.touches[0].clientY;
			touchT = performance.now();
			fling.v = 0;
			scroll.target = scroll.cur; // stop any lerp in flight under the finger
		};
		const onTouchMove = (e) => {
			const y = e.touches[0].clientY;
			const now = performance.now();
			const dtMs = Math.max(1, now - touchT);
			fling.vel = 0.8 * ((-(y - touchY) * dpr * 1000) / dtMs) + 0.2 * (fling.vel || 0);
			touchT = now;
			scroll.target -= (y - touchY) * dpr;
			scroll.cur = scroll.target; // 1:1 finger tracking
			touchY = y;
			e.preventDefault();
		};
		const onTouchEnd = (e) => {
			if (e.touches.length) return;
			// finger held still before lifting: no fling
			fling.v = performance.now() - touchT < 80 ? fling.vel || 0 : 0;
			fling.vel = 0;
		};
		let resizeRaf = 0;
		const onResize = () => {
			cancelAnimationFrame(resizeRaf);
			resizeRaf = requestAnimationFrame(build);
		};

		build();
		raf = requestAnimationFrame(frame);
		canvas.addEventListener("pointerdown", onDown);
		canvas.addEventListener("pointermove", onMove);
		canvas.addEventListener("pointerup", onUp);
		canvas.addEventListener("click", onClick);
		window.addEventListener("wheel", onWheel, { passive: false }); // window, not canvas: slots sit above it
		canvas.addEventListener("touchstart", onTouchStart, { passive: true });
		canvas.addEventListener("touchmove", onTouchMove, { passive: false });
		canvas.addEventListener("touchend", onTouchEnd, { passive: true });
		canvas.addEventListener("touchcancel", onTouchEnd, { passive: true });
		window.addEventListener("keydown", onKey, true);
		window.addEventListener("resize", onResize);
		return () => {
			dead = true;
			cancelAnimationFrame(raf);
			cancelAnimationFrame(resizeRaf);
			window.removeEventListener("wheel", onWheel);
			window.removeEventListener("keydown", onKey, true);
			window.removeEventListener("resize", onResize);
			gridTex?.dispose();
			barTex?.dispose();
			imgTex.dispose();
			u.uMini.value.dispose();
			atlas?.texture.dispose();
			mesh.geometry.dispose();
			material.dispose();
			renderer.dispose();
			canvas.remove();
		};
	}, [blocks, maxCols, fontPx]);

	return (
		<>
			<div ref={host} style={{ position: "fixed", inset: 0, zIndex: 1 }} />
			<Mirror blocks={blocks} />
		</>
	);
}

// the grid is pixels; this is the real text, for screen readers only (find,
// selection and copy are handled in the grid). visually hidden, not display:none (that would hide it from assistive tech).
const HIDDEN = { position: "fixed", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)", whiteSpace: "nowrap" };
function Mirror({ blocks }) {
	return (
		<div style={HIDDEN}>
			{blocks.map((b, i) => {
				switch (b.type) {
					case "h": { const H = `h${b.level}`; return <H key={i}>{plain(b.text)}</H>; }
					case "p": return <p key={i}>{plain(b.text)}</p>;
					case "ul": return <ul key={i}>{b.items.map((t, j) => <li key={j}>{plain(t)}</li>)}</ul>;
					case "quote": return <blockquote key={i}>{plain(b.text)}</blockquote>;
					case "code": return <pre key={i}>{b.lines.join("\n")}</pre>;
					case "hr": return <hr key={i} />;
					case "img": return <img key={i} src={b.src} alt={b.alt} />;
					default: return null;
				}
			})}
		</div>
	);
}
