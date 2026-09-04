import * as THREE from "three";

// ---- glyph atlas -----------------------------------------------------------
// luminance ramp of monospace chars in a horizontal strip.
// index 0 = darkest (space), last = brightest (@). NearestFilter, no mips.
export function makeGlyphAtlas(chars = " .:-=+*#%@", cellPx = 16) {
	const n = chars.length;
	const cvs = document.createElement("canvas");
	cvs.width = cellPx * n;
	cvs.height = cellPx;
	const ctx = cvs.getContext("2d");
	ctx.fillStyle = "#000";
	ctx.fillRect(0, 0, cvs.width, cvs.height);
	ctx.fillStyle = "#fff";
	// bold: at small cellPx a regular-weight stroke anti-aliases to low coverage,
	// which reads as dim once multiplied into the ink colour downstream
	ctx.font = `bold ${cellPx}px monospace`;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	for (let i = 0; i < n; i++) {
		ctx.fillText(chars[i], i * cellPx + cellPx / 2, cellPx / 2 + 1);
	}
	const tex = new THREE.CanvasTexture(cvs);
	tex.minFilter = THREE.NearestFilter;
	tex.magFilter = THREE.NearestFilter;
	tex.generateMipmaps = false;
	tex.colorSpace = THREE.NoColorSpace;
	return { texture: tex, count: n };
}

// ---- surface materials -------------------------------------------------
// what the scene renders for the ascii pass. the alpha channel is a mode:
//   0.0  background (nothing rendered — clear alpha is 0)
//   0.33 solid: single global ink                (rgb = normal, ignored)
//   0.66 flat colour: rgb IS the colour, unshaded (no sun, no two-tone)
//   1.0  two-tone: shaded against the sun         (rgb = encoded normal)
const VERT = /* glsl */ `
	varying vec3 vWN;
	varying vec3 vVN;
	void main() {
		vWN = normalize(mat3(modelMatrix) * normal);
		vVN = normalize(normalMatrix * normal); // view-space: .z ~ 1 faces camera
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	}
`;

// how much darker an extruded side face is vs the camera-facing cap, in the
// flat-colour materials (surfaceColor). the two-tone material has its own ramp.
export const SIDE_MUL = 0.6;

function normalMaterial(flag) {
	return new THREE.ShaderMaterial({
		vertexShader: VERT,
		fragmentShader: /* glsl */ `
			varying vec3 vWN;
			void main() {
				gl_FragColor = vec4(normalize(vWN) * 0.5 + 0.5, ${flag.toFixed(2)});
			}
		`,
	});
}

export const SURFACE_TWO_TONE = normalMaterial(1.0);
export const SURFACE_SOLID = normalMaterial(0.33);

// two-tone that dissolves in: `uFade` 0..1 stipples fragments (screen-space hash
// + discard) so through the glyph pass the object fills in cell by cell. one
// fresh instance per fading object — it owns its uniform; dispose it on unmount.
export function surfaceFade() {
	return new THREE.ShaderMaterial({
		vertexShader: VERT,
		uniforms: { uFade: { value: 0 } },
		fragmentShader: /* glsl */ `
			varying vec3 vWN;
			uniform float uFade;
			float h21(vec2 p) { return fract(sin(dot(p, vec2(41.13, 289.7))) * 43758.5); }
			void main() {
				if (uFade < 0.999 && h21(floor(gl_FragCoord.xy / 5.0)) > uFade) discard;
				gl_FragColor = vec4(normalize(vWN) * 0.5 + 0.5, 1.0);
			}
		`,
	});
}

// flat colour, one shared instance per hex. the cap keeps the colour; extruded
// side faces are darkened by SIDE_MUL so the depth reads. still "flat" to the
// ascii pass (alpha 0.66) — the shading is baked into rgb here.
const colorCache = new Map();
export function surfaceColor(hex) {
	let m = colorCache.get(hex);
	if (!m) {
		const c = new THREE.Color(hex);
		m = new THREE.ShaderMaterial({
			vertexShader: VERT,
			fragmentShader: /* glsl */ `
				varying vec3 vVN;
				void main() {
					vec3 base = vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)});
					float f = smoothstep(0.35, 0.8, vVN.z); // 1 = cap, 0 = side
					gl_FragColor = vec4(base * mix(${SIDE_MUL.toFixed(2)}, 1.0, f), 0.66);
				}
			`,
		});
		colorCache.set(hex, m);
	}
	return m;
}

// flat colour pinned at the SIDE_MUL tone always — for a face a front-on
// camera can never actually see edge-on (a slab's top), so a thin front-facing
// strip stands in for it: shaded like a side face, reading as a raised/shadowed
// lip at that edge instead of a flat cap.
const flatSideCache = new Map();
export function surfaceColorSide(hex, mul = SIDE_MUL) {
	const key = `${hex}:${mul}`;
	let m = flatSideCache.get(key);
	if (!m) {
		const c = new THREE.Color(hex);
		m = new THREE.ShaderMaterial({
			vertexShader: VERT,
			fragmentShader: /* glsl */ `
				void main() {
					vec3 base = vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)});
					gl_FragColor = vec4(base * ${mul.toFixed(4)}, 0.66);
				}
			`,
		});
		flatSideCache.set(key, m);
	}
	return m;
}

// translucent "tinted glass": multiplies whatever the ascii G-buffer already
// holds behind it by `k` (custom ZERO / SRC_COLOR blend, no depth write), so the
// glyph pass then draws a darker version of what's behind it — and nothing where
// the background was empty. render it after the opaque geometry (renderOrder).
const tintCache = new Map();
export function surfaceTint(k = 0.55) {
	let m = tintCache.get(k);
	if (!m) {
		m = new THREE.ShaderMaterial({
			transparent: true,
			depthWrite: false,
			blending: THREE.CustomBlending,
			blendEquation: THREE.AddEquation,
			blendSrc: THREE.ZeroFactor,
			blendDst: THREE.SrcColorFactor,
			vertexShader: /* glsl */ `
				void main() {
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				}
			`,
			fragmentShader: /* glsl */ `
				void main() { gl_FragColor = vec4(${k.toFixed(4)}, ${k.toFixed(4)}, ${k.toFixed(4)}, 1.0); }
			`,
		});
		tintCache.set(k, m);
	}
	return m;
}

// ---- ascii pass -------------------------------------------------------
// two-tone: a directional "sun" along the camera's forward axis. cells whose
// normal points within +/- cutoffDeg of the camera are drawn in `ink`; every
// other lit cell is drawn in `inkDark`. background stays empty.
// perspective projection is untouched.
export function makeAsciiShader({
	chars = " .:-=+*#%@",
	cell = 6,
	ink = "#c8ff9b",
	inkDark = "#5c8a34",
	cutoffDeg = 15,
	contrast = 1.0,
	gain = 1.0,
	dither = 0,
	waterTint = "#ffffff",
} = {}) {
	// atlas glyph cell must match the display cell (uCell, in device px) 1:1 —
	// any mismatch forces a nearest-filtered minify/magnify step at sample time,
	// which aliases into diagonal moire even over flat, single-colour fills.
	const { texture, count } = makeGlyphAtlas(chars, cell);
	return {
		uniforms: {
			tDiffuse: { value: null },
			uGlyph: { value: texture },
			uGlyphCount: { value: count },
			uCell: { value: cell },
			uResolution: { value: new THREE.Vector2(1, 1) },
			uInk: { value: new THREE.Color(ink) },
			uInkDark: { value: new THREE.Color(inkDark) },
			uCosCutoff: { value: Math.cos((cutoffDeg * Math.PI) / 180) },
			uContrast: { value: contrast },
			uGain: { value: gain },
			uDither: { value: dither },
			// world-space travel direction of the sun; set to camera forward
			uSunDir: { value: new THREE.Vector3(0, 0, -1) },
			uWaterTint: { value: new THREE.Color(waterTint) },
			// screen-space v (0 bottom -> 1 top) of the okmr waterline; -Infinity
			// off-okmr so the tint below never trips. set live in SceneCanvas.
			uWaterLineV: { value: -Infinity },
		},
		vertexShader: /* glsl */ `
			varying vec2 vUv;
			void main() {
				vUv = uv;
				gl_Position = vec4(position, 1.0);
			}
		`,
		fragmentShader: /* glsl */ `
			uniform sampler2D tDiffuse;
			uniform sampler2D uGlyph;
			uniform float uGlyphCount;
			uniform float uCell;
			uniform vec2 uResolution;
			uniform vec3 uInk;
			uniform vec3 uInkDark;
			uniform float uCosCutoff;
			uniform float uContrast;
			uniform float uGain;
			uniform float uDither;
			uniform vec3 uSunDir;
			uniform vec3 uWaterTint;
			uniform float uWaterLineV;
			varying vec2 vUv;

			// 4x4 Bayer via recursion, no arrays (WebGL1-safe)
			float b2(vec2 p) { return mod(2.0 * p.x + 3.0 * p.y, 4.0); }
			float bayer4(vec2 p) {
				p = floor(mod(p, 4.0));
				return (4.0 * b2(floor(p / 2.0)) + b2(mod(p, 2.0))) / 16.0;
			}

			void main() {
				vec2 frag = vUv * uResolution;
				vec2 cellId = floor(frag / uCell);
				// snap to a texel centre so the bilinear-filtered normal buffer
				// isn't blended with the background -> no ink halo past the bevel
				vec2 centerPx = floor(cellId * uCell + 0.5 * uCell) + 0.5;
				vec2 centerUv = centerPx / uResolution;

				vec4 s = texture2D(tDiffuse, centerUv);

				// alpha selects the mode (see surface materials); a ~ 0 = background.
				// for two-tone, also reject rgb ~ 0 in case the clear alpha leaks.
				bool bg = s.a < 0.1 || (s.a > 0.8 && length(s.rgb * 2.0 - 1.0) > 1.6);

				vec3 tone = uInk;
				float luma = 0.0;
				if (!bg) {
					if (s.a < 0.5) {
						tone = uInk; // solid: global ink
					} else if (s.a < 0.8) {
						// flat colour: rgb is the colour, with its own contrast
						tone = clamp((s.rgb - 0.5) * uContrast + 0.5, 0.0, 1.0);
					} else {
						// two-tone: shade the world normal against the sun
						vec3 n = normalize(s.rgb * 2.0 - 1.0);
						float d = dot(n, -uSunDir);
						tone = d < uCosCutoff ? uInkDark : uInk;
					}
					// tint the resolved colour, not the raw buffer — doing this before
					// the two-tone branch above would corrupt the encoded normal (it's
					// not a colour) and scramble the ink/inkDark pick instead of just
					// tinting it. bg cells are already skipped: nothing's drawn there.
					if (vUv.y < uWaterLineV) tone *= uWaterTint;
					luma = uGain; // every lit cell draws a full glyph
				}

				luma = clamp(luma + uDither * (bayer4(cellId) - 0.5) / uGlyphCount, 0.0, 1.0);
				float gi = floor(luma * (uGlyphCount - 1.0) + 0.5);

				vec2 local = fract(frag / uCell);
				vec2 atlasUv = vec2((gi + local.x) / uGlyphCount, local.y);
				float g = texture2D(uGlyph, atlasUv).r;

				gl_FragColor = vec4(tone * g, 1.0);
			}
		`,
	};
}
