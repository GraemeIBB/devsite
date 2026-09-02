// spike scene config — pulled out of the components so it survives
// fast-refresh and is easy to tune.

export const FONT = '/fonts/helvetiker_bold.typeface.json'

export const BASE = 1.5 // GRAEME letter size
export const WORD = [...'GRAEME']
// chars the helvetiker_bold typeface actually has glyphs for
export const POOL = 'GRAEMEDEVLOG0123456789.,:;+-=*/#!?()'

// collider / hit-box half-extents at BASE size (scaled by each letter's factor)
export const HALF = [0.85, 1.0, 0.3]

// how a character's glyph cells are coloured by the ascii pass
export const SHADING = Object.freeze({
	TWO_TONE: 'two-tone', // ink on the camera-facing cap, inkDark on the sides
	SOLID: 'solid', // single ink everywhere
})

// confetti size tiers below GRAEME — geometric sequence, ratio 1/2.
// ccd + grab only on the big tier; the small ones jitter/fling when dragged.
export const TIERS = Object.freeze([
	{ factor: 1 / 2, count: 3, shading: SHADING.TWO_TONE, ccd: true, grabbable: true },
	{ factor: 1 / 4, count: 5, shading: SHADING.TWO_TONE, ccd: false, grabbable: false },
	{ factor: 1 / 8, count: 8, shading: SHADING.SOLID, ccd: false, grabbable: false },
])

export const PHYSICS = { gravity: [0, -14, 0] }

// low-poly ogopogo (okmr_stonefish ogopogo.scn), thrown in like the letters.
// per-part colours are the scn <look> values (simple.scn <looks> block).
export const AUV = {
	scale: 3.5,
	position: [1, 8],
	spin: -0.35,
	tilt: [0.32, -0.55], // static visual rotation [x, y] for a 3/4 view
	colors: {
		hull: '#4d4d4d', // look "Gray"  (gray 0.3)
		rail: '#004dcc', // look "Blue"  (rgb 0.0 0.3 0.8)
		dvl: '#1a1a1a', // look "Black" (gray 0.0, nudged up so it renders)
		thruster: '#4d4d4d', // look "Gray"
	},
}

// pit that keeps letters on screen — CuboidCollider half-extents
export const PIT = [
	{ position: [0, -5, 0], args: [12, 2, 3] },
	{ position: [-8.5, 0, 0], args: [0.5, 8, 3] },
	{ position: [8.5, 0, 0], args: [0.5, 8, 3] },
]

// pointer-drag spring
export const DRAG = { stiff: 90, damp: 12, maxImpulse: 8 }

export const ASCII = {
	chars: ' .:-=+*#%@',
	cell: 6,
	ink: '#c8ff9b',
	inkDark: '#5c8a34',
	cutoffDeg: 15,
	contrast: 1.5, // pivot-0.5 contrast on the final tone
}
