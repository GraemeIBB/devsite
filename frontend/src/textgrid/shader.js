import * as THREE from "three";
import { GLYPH_COUNT } from "./atlas";
import { MAX_IMAGES } from "./layout";
import { makeGlyphAtlas } from "../scene/asciiShader";
import { ASCII } from "../scene/config";

// palette index = layout.js STYLE. hex -> raw sRGB vec3 (no colour management:
// the shader writes final display values straight to the canvas).
const PALETTE = ["#c8ff9b", "#eaffd4", "#5c8a34", "#89CFF0", "#e8d9a0", "#ffb454", "#9bb88a"];
const BG = "#050a05";
const v3 = (hex) => {
	const c = parseInt(hex.slice(1), 16);
	return new THREE.Vector3((c >> 16) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255);
};

// scene-window plasma reuses the scene's luminance ramp
const RAMP = " .:-=+*#%@";
// photo contrast, pivot 0.5 (as the scene's ASCII.contrast), on glyph pick + colour
const IMG_CONTRAST = 1.8;
// photo brightness, added after contrast (0 = unchanged, + brighter)
const IMG_BRIGHTNESS = 0.15;
// photo colour behind each glyph, so the gaps between strokes aren't page bg
// (0 = page bg, 1 = solid photo with no visible glyphs)
const IMG_FILL = 0.4;
const rampGlsl = RAMP.split("").map((c) => (c.charCodeAt(0) - 32).toFixed(1)).join(", ");

export function makeTextGridMaterial() {
	// images draw at the scene's own cell size + ramp (device px, same as the
	// scene's ascii pass), not the text cell — far more definition
	const mini = makeGlyphAtlas(ASCII.chars, ASCII.cell);
	return new THREE.ShaderMaterial({
		depthTest: false,
		depthWrite: false,
		uniforms: {
			uGrid: { value: null },
			uAtlas: { value: null },
			uRes: { value: new THREE.Vector2(1, 1) },
			uCell: { value: new THREE.Vector2(9, 21) },
			uGridSize: { value: new THREE.Vector2(1, 1) },
			uColOff: { value: 0 },
			uScroll: { value: 0 },
			uTime: { value: 0 },
			uHover: { value: 0 },
			uReveal: { value: 1 },
			uBar: { value: null },
			uBarOn: { value: 0 },
			uThumb: { value: 0 },
			uThumbSize: { value: 1 },
			uBg: { value: v3(BG) },
			uPalette: { value: PALETTE.map(v3).concat([v3("#ffffff")]) },
			uImg: { value: null },
			uImgRect: { value: Array.from({ length: MAX_IMAGES }, () => new THREE.Vector4()) },
			uMini: { value: mini.texture },
			uMiniCount: { value: mini.count },
			uMiniCell: { value: ASCII.cell },
			uImgContrast: { value: IMG_CONTRAST },
			uImgBrightness: { value: IMG_BRIGHTNESS },
			uImgFill: { value: IMG_FILL },
		},
		vertexShader: /* glsl */ `
			void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
		`,
		fragmentShader: /* glsl */ `
			uniform sampler2D uGrid;
			uniform sampler2D uAtlas;
			uniform sampler2D uBar;
			uniform vec2 uRes;
			uniform vec2 uCell;
			uniform vec2 uGridSize;
			uniform float uColOff, uScroll, uTime, uHover, uThumb, uThumbSize, uReveal, uBarOn;
			uniform vec3 uBg;
			uniform vec3 uPalette[8];
			uniform sampler2D uImg; // image atlas: one slot per image, stacked vertically
			uniform vec4 uImgRect[${MAX_IMAGES}]; // fitted image box per id, grid cells (col, row, w, h)
			uniform sampler2D uMini; // scene glyph ramp (asciiShader makeGlyphAtlas)
			uniform float uMiniCount, uMiniCell, uImgContrast, uImgBrightness, uImgFill;

			const float RAMP[10] = float[10](${rampGlsl});

			// same stipple hash as asciiShader's surfaceFade (okmr letters)
			float h21(vec2 p) { return fract(sin(dot(p, vec2(41.13, 289.7))) * 43758.5); }

			// 4x4 ordered dither, as asciiShader: in-between tones across the 10-glyph ramp
			float b2(vec2 p) { return mod(2.0 * p.y + p.x * (1.0 + 2.0 * p.y), 4.0) / 4.0; }
			float bayer4(vec2 p) {
				p = mod(p, 4.0);
				return (4.0 * b2(floor(p / 2.0)) + b2(mod(p, 2.0))) / 16.0;
			}

			float cov(float gi, float atlasRow, vec2 local) {
				vec2 uv = vec2((gi + local.x / uCell.x) / ${GLYPH_COUNT}.0, (atlasRow + local.y / uCell.y) / 2.0);
				return texture2D(uAtlas, uv).r;
			}

			void main() {
				vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y); // top-left origin, device px
				float totalCols = floor(uRes.x / uCell.x);
				float scol = floor(p.x / uCell.x);
				float lx = p.x - scol * uCell.x;
				vec3 outc = uBg;

				float totalRows = floor(uRes.y / uCell.y);
				float srow = floor(p.y / uCell.y);

				if (uBarOn > 0.5 && srow == totalRows - 1.0) {
					// find bar: one screen-fixed row of cells (own texture), over everything
					vec4 t = texture2D(uBar, vec2((scol + 0.5) / totalCols, 0.5));
					int flags = int(t.b * 255.0 + 0.5);
					float g = cov(floor(t.r * 255.0 + 0.5), (flags & 1) != 0 ? 1.0 : 0.0, vec2(lx, p.y - srow * uCell.y));
					outc = mix(mix(uBg, uPalette[2], 0.22), uPalette[int(t.g * 255.0 + 0.5)], g);
				} else if (scol == totalCols - 1.0) {
					// ascii scrollbar in the last screen column
					if (uThumbSize < 0.999) {
						float t = srow / totalRows;
						bool inThumb = t >= uThumb && t < uThumb + uThumbSize;
						float g = cov(inThumb ? 3.0 : 26.0, inThumb ? 1.0 : 0.0, vec2(lx, p.y - srow * uCell.y));
						outc = mix(uBg, inThumb ? uPalette[5] : uPalette[2], g);
					}
				} else {
					float yT = p.y + uScroll;
					float row = floor(yT / uCell.y);
					float ly = yT - row * uCell.y;
					float col = scol - uColOff;
					if (col >= 0.0 && col < uGridSize.x && row >= 0.0 && row < uGridSize.y) {
						vec4 t = texture2D(uGrid, (vec2(col, row) + 0.5) / uGridSize);
						float gi = floor(t.r * 255.0 + 0.5);
						int style = int(t.g * 255.0 + 0.5);
						int flags = int(t.b * 255.0 + 0.5);
						float link = floor(t.a * 255.0 + 0.5);
						vec3 fg = uPalette[style];
						vec3 bg = uBg;
						float ar = (flags & 1) != 0 ? 1.0 : 0.0;

						if ((flags & 4) != 0) bg = mix(uBg, uPalette[4], 0.10);
						if ((flags & 8) != 0) {
							// scene window: the grid steps aside, another glyph source draws here
							float v = 0.5 + 0.5 * (sin(col * 0.35 + uTime * 1.1) + sin(row * 0.45 - uTime * 0.8) + sin((col + row) * 0.2 + uTime * 0.5)) / 3.0;
							gi = RAMP[int(clamp(v * 10.0, 0.0, 9.0))];
							fg = mix(uPalette[2], uPalette[5], v);
							ar = v > 0.6 ? 1.0 : 0.0;
						}
						float mini = -1.0; // >= 0: coverage from the scene-size sub-grid (image cells)
						if ((flags & 16) != 0) {
							// image: its own grid of scene-size cells over the box, one sample each;
							// brightness (+ ordered dither) picks the ramp glyph, the photo gives colour
							vec4 R = uImgRect[style];
							vec2 local = vec2(col * uCell.x + lx, yT) - R.xy * uCell; // px from the image's top-left
							vec2 size = R.zw * uCell;
							vec2 sub = floor(local / uMiniCell);
							vec2 q = (sub + 0.5) * uMiniCell / max(size, vec2(1e-3));
							mini = 0.0;
							if (R.z > 0.0 && local.x >= 0.0 && local.y >= 0.0 && q.x < 1.0 && q.y < 1.0) {
								vec3 c = texture2D(uImg, vec2(q.x, (float(style) + q.y) / ${MAX_IMAGES}.0)).rgb;
								c = clamp((c - 0.5) * uImgContrast + 0.5 + uImgBrightness, 0.0, 1.0);
								float v = dot(c, vec3(0.299, 0.587, 0.114));
								v = clamp(v + (bayer4(sub) - 0.5) / uMiniCount, 0.0, 1.0);
								float mg = floor(v * (uMiniCount - 1.0) + 0.5);
								vec2 ml = fract(local / uMiniCell);
								mini = texture2D(uMini, vec2((mg + ml.x) / uMiniCount, 1.0 - ml.y)).r; // atlas is y-up
								fg = c;
								bg = mix(uBg, c, uImgFill);
							}
						}
						// selection / find highlights (overlay bits, set CPU-side in TextGrid)
						if ((flags & 32) != 0) bg = mix(bg, uPalette[3], 0.4);
						if ((flags & 64) != 0) bg = mix(bg, uPalette[5], 0.4);
						if ((flags & 128) != 0) { bg = uPalette[5]; fg = uBg; }
						if (link > 0.5 && abs(link - uHover) < 0.5) { bg = fg; fg = uBg; }

						float g = mini >= 0.0 ? mini : cov(gi, ar, vec2(lx, ly));
						if ((flags & 2) != 0 && ly >= uCell.y - max(1.0, floor(uCell.y / 14.0))) g = 1.0;
						outc = mix(bg, fg, g);
					}
				}
				// dither reveal: whole cells fade in on the hash, rest stay transparent
				float a = (uReveal >= 0.999 || h21(floor(gl_FragCoord.xy / uCell)) <= uReveal) ? 1.0 : 0.0;
				gl_FragColor = vec4(outc * a, a);
			}
		`,
	});
}
