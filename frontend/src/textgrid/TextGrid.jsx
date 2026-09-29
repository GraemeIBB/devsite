import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { makeTextAtlas } from "./atlas";
import { parse, layout, pack, plain } from "./layout";
import { makeTextGridMaterial } from "./shader";

// full-screen text grid: one texel per glyph cell, drawn through a font atlas.
// spike — owns its own canvas (not yet folded into the scene's ascii pass).
// scroll is lerp-only (wheel/keys/touch move a target, the view eases to it).
// keys: arrows / pgup / pgdn / space / home / end.
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// `reveal` true dithers the doc in over `revealMs` (cell-stipple, transparent
// until revealed so whatever is underneath shows through); false hides it again.
export default function TextGrid({ source, maxCols = 88, fontPx = 15, onLink, reveal = true, revealMs = 900 }) {
	const host = useRef();
	const blocks = useMemo(() => parse(source), [source]);
	const onLinkRef = useRef(onLink);
	onLinkRef.current = onLink;
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

		let dpr = 1, cell = { w: 9, h: 21 }, doc, atlas, gridTex, maxScroll = 0, colOff = 0, shown = 0;
		let reveal01 = 0, hover = 0, raf, last = performance.now(), dead = false;
		const scroll = { cur: 0, target: 0 };

		function build() {
			dpr = Math.min(window.devicePixelRatio || 1, 2);
			renderer.setPixelRatio(dpr);
			renderer.setSize(window.innerWidth, window.innerHeight);
			const res = renderer.getDrawingBufferSize(new THREE.Vector2());

			atlas?.texture.dispose();
			atlas = makeTextAtlas(Math.round(fontPx * dpr));
			cell = atlas.cell;

			const totalCols = Math.floor(res.x / cell.w);
			const cols = Math.max(20, Math.min(maxCols, totalCols - 2)); // last col = scrollbar
			colOff = Math.floor((totalCols - cols) / 2);
			doc = layout(blocks, cols);
			if (doc.rows > renderer.capabilities.maxTextureSize) console.warn("textgrid: doc taller than max texture size");

			gridTex?.dispose();
			gridTex = new THREE.DataTexture(pack(doc), doc.cols, doc.rows, THREE.RGBAFormat);
			gridTex.needsUpdate = true;

			u.uGrid.value = gridTex;
			u.uAtlas.value = atlas.texture;
			u.uRes.value.copy(res);
			u.uCell.value.set(cell.w, cell.h);
			u.uGridSize.value.set(doc.cols, doc.rows);
			u.uColOff.value = colOff;
			maxScroll = Math.max(0, doc.rows * cell.h - res.y + cell.h);
			scroll.target = clamp(scroll.target, 0, maxScroll);
			scroll.cur = clamp(scroll.cur, 0, maxScroll);
		}

		function frame(now) {
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			scroll.target = clamp(scroll.target, 0, maxScroll);
			scroll.cur += (scroll.target - scroll.cur) * (1 - Math.exp(-dt * 14));
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
			renderer.render(scene, camera);
			if (!dead) raf = requestAnimationFrame(frame);
		}

		const linkAt = (e) => {
			const col = Math.floor((e.clientX * dpr) / cell.w) - colOff;
			const row = Math.floor((e.clientY * dpr + shown) / cell.h);
			if (col < 0 || col >= doc.cols || row < 0 || row >= doc.rows) return 0;
			return doc.link[row * doc.cols + col];
		};
		const onMove = (e) => {
			hover = linkAt(e);
			u.uHover.value = hover;
			canvas.style.cursor = hover ? "pointer" : "default";
		};
		const onClick = (e) => {
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
		const onKey = (e) => {
			const page = u.uRes.value.y - cell.h * 2;
			const k = e.key;
			if (k === "ArrowDown") scroll.target += cell.h * 3;
			else if (k === "ArrowUp") scroll.target -= cell.h * 3;
			else if (k === "PageDown" || (k === " " && !e.shiftKey)) scroll.target += page;
			else if (k === "PageUp" || (k === " " && e.shiftKey)) scroll.target -= page;
			else if (k === "Home") scroll.target = 0;
			else if (k === "End") scroll.target = maxScroll;
			else return;
			e.preventDefault();
		};
		let touchY = 0;
		const onTouchStart = (e) => { touchY = e.touches[0].clientY; };
		const onTouchMove = (e) => {
			const y = e.touches[0].clientY;
			scroll.target -= (y - touchY) * dpr;
			scroll.cur = scroll.target; // 1:1 finger tracking
			touchY = y;
			e.preventDefault();
		};
		let resizeRaf = 0;
		const onResize = () => {
			cancelAnimationFrame(resizeRaf);
			resizeRaf = requestAnimationFrame(build);
		};

		build();
		raf = requestAnimationFrame(frame);
		canvas.addEventListener("pointermove", onMove);
		canvas.addEventListener("click", onClick);
		window.addEventListener("wheel", onWheel, { passive: false }); // window, not canvas: slots sit above it
		canvas.addEventListener("touchstart", onTouchStart, { passive: true });
		canvas.addEventListener("touchmove", onTouchMove, { passive: false });
		window.addEventListener("keydown", onKey);
		window.addEventListener("resize", onResize);
		return () => {
			dead = true;
			cancelAnimationFrame(raf);
			cancelAnimationFrame(resizeRaf);
			window.removeEventListener("wheel", onWheel);
			window.removeEventListener("keydown", onKey);
			window.removeEventListener("resize", onResize);
			gridTex?.dispose();
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

// the grid is pixels; this is the real text, for screen readers / find / copy.
// visually hidden, not display:none (that would hide it from assistive tech).
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
					default: return null;
				}
			})}
		</div>
	);
}
