import * as THREE from 'three'

// ---- glyph atlas -----------------------------------------------------------
// luminance ramp of monospace chars in a horizontal strip.
// index 0 = darkest (space), last = brightest (@). NearestFilter, no mips.
export function makeGlyphAtlas(chars = ' .:-=+*#%@', cellPx = 16) {
	const n = chars.length
	const cvs = document.createElement('canvas')
	cvs.width = cellPx * n
	cvs.height = cellPx
	const ctx = cvs.getContext('2d')
	ctx.fillStyle = '#000'
	ctx.fillRect(0, 0, cvs.width, cvs.height)
	ctx.fillStyle = '#fff'
	ctx.font = `${cellPx}px monospace`
	ctx.textAlign = 'center'
	ctx.textBaseline = 'middle'
	for (let i = 0; i < n; i++) {
		ctx.fillText(chars[i], i * cellPx + cellPx / 2, cellPx / 2 + 1)
	}
	const tex = new THREE.CanvasTexture(cvs)
	tex.minFilter = THREE.NearestFilter
	tex.magFilter = THREE.NearestFilter
	tex.generateMipmaps = false
	tex.colorSpace = THREE.NoColorSpace
	return { texture: tex, count: n }
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
`

// how much darker an extruded side face is vs the camera-facing cap, in the
// flat-colour materials (surfaceColor). the two-tone material has its own ramp.
const SIDE_MUL = 0.6

function normalMaterial(flag) {
	return new THREE.ShaderMaterial({
		vertexShader: VERT,
		fragmentShader: /* glsl */ `
			varying vec3 vWN;
			void main() {
				gl_FragColor = vec4(normalize(vWN) * 0.5 + 0.5, ${flag.toFixed(2)});
			}
		`,
	})
}

export const SURFACE_TWO_TONE = normalMaterial(1.0)
export const SURFACE_SOLID = normalMaterial(0.33)

// flat colour, one shared instance per hex. the cap keeps the colour; extruded
// side faces are darkened by SIDE_MUL so the depth reads. still "flat" to the
// ascii pass (alpha 0.66) — the shading is baked into rgb here.
const colorCache = new Map()
export function surfaceColor(hex) {
	let m = colorCache.get(hex)
	if (!m) {
		const c = new THREE.Color(hex)
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
		})
		colorCache.set(hex, m)
	}
	return m
}

// ---- ascii pass -------------------------------------------------------
// two-tone: a directional "sun" along the camera's forward axis. cells whose
// normal points within +/- cutoffDeg of the camera are drawn in `ink`; every
// other lit cell is drawn in `inkDark`. background stays empty.
// perspective projection is untouched.
export function makeAsciiShader({
	chars = ' .:-=+*#%@',
	cell = 6,
	ink = '#c8ff9b',
	inkDark = '#5c8a34',
	cutoffDeg = 15,
	contrast = 1.0,
	gain = 1.0,
	dither = 0,
} = {}) {
	const { texture, count } = makeGlyphAtlas(chars, 16)
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
	}
}
