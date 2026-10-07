import * as THREE from "three";

// printable ascii 32..126 -> glyph index = charCode - 32. two atlas rows:
// 0 regular, 1 bold. one cell per glyph at the text grid's own cell size in
// device px, sampled 1:1 (nearest) so text stays crisp — no minify/magnify.
export const GLYPH_FIRST = 32;
export const GLYPH_COUNT = 95;
export const glyphIndex = (ch) => {
	const c = ch.charCodeAt(0);
	return c >= 32 && c <= 126 ? c - GLYPH_FIRST : 63 - GLYPH_FIRST; // '?'
};

const FONT = 'ui-monospace, "JetBrains Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace';

export function makeTextAtlas(fontPx) {
	const probe = document.createElement("canvas").getContext("2d");
	probe.font = `${fontPx}px ${FONT}`;
	const w = Math.ceil(probe.measureText("M").width);
	const h = Math.ceil(fontPx * 1.4);

	const cvs = document.createElement("canvas");
	cvs.width = w * GLYPH_COUNT;
	cvs.height = h * 2;
	const ctx = cvs.getContext("2d");
	ctx.fillStyle = "#000";
	ctx.fillRect(0, 0, cvs.width, cvs.height);
	ctx.fillStyle = "#fff";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	for (let r = 0; r < 2; r++) {
		ctx.font = `${r ? "bold " : ""}${fontPx}px ${FONT}`;
		for (let i = 0; i < GLYPH_COUNT; i++) {
			ctx.fillText(String.fromCharCode(GLYPH_FIRST + i), i * w + w / 2, r * h + h / 2 + 1);
		}
	}
	const tex = new THREE.CanvasTexture(cvs);
	tex.minFilter = tex.magFilter = THREE.NearestFilter;
	tex.generateMipmaps = false;
	tex.flipY = false; // atlas row 0 = top, matches the shader's top-origin math
	tex.colorSpace = THREE.NoColorSpace;
	return { texture: tex, cell: { w, h } };
}
