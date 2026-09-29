import * as THREE from "three";
import { GLYPH_COUNT } from "./atlas";

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
const rampGlsl = RAMP.split("").map((c) => (c.charCodeAt(0) - 32).toFixed(1)).join(", ");

export function makeTextGridMaterial() {
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
			uThumb: { value: 0 },
			uThumbSize: { value: 1 },
			uBg: { value: v3(BG) },
			uPalette: { value: PALETTE.map(v3).concat([v3("#ffffff")]) },
		},
		vertexShader: /* glsl */ `
			void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
		`,
		fragmentShader: /* glsl */ `
			uniform sampler2D uGrid;
			uniform sampler2D uAtlas;
			uniform vec2 uRes;
			uniform vec2 uCell;
			uniform vec2 uGridSize;
			uniform float uColOff, uScroll, uTime, uHover, uThumb, uThumbSize, uReveal;
			uniform vec3 uBg;
			uniform vec3 uPalette[8];

			const float RAMP[10] = float[10](${rampGlsl});

			// same stipple hash as asciiShader's surfaceFade (okmr letters)
			float h21(vec2 p) { return fract(sin(dot(p, vec2(41.13, 289.7))) * 43758.5); }

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

				if (scol == totalCols - 1.0) {
					// ascii scrollbar in the last screen column
					if (uThumbSize < 0.999) {
						float srow = floor(p.y / uCell.y);
						float t = srow / floor(uRes.y / uCell.y);
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
						if (link > 0.5 && abs(link - uHover) < 0.5) { bg = fg; fg = uBg; }

						float g = cov(gi, ar, vec2(lx, ly));
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
