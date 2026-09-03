// spike scene config — pulled out of the components so it survives
// fast-refresh and is easy to tune.

export const FONT = '/fonts/helvetiker_bold.typeface.json'

export const BASE = 1.5 // GRAEME letter size
export const WORD = [...'GRAEME']

// portrait (window taller than wide): GRAEME can't fit inline, so it drops in
// as two rows — GRA above EME. GRA spawns higher so it lands on top.
// spawn y values sit above the top of the view (~5.4 at the default camera) so
// every letter drops in from off-frame.
export const PORTRAIT = Object.freeze({
	split: 3, // GRAEME -> 'GRA' | 'EME'
	spacing: 1.7, // x gap between letters within a row
	rows: [16, 12], // spawn y for [GRA, EME] — GRA higher so it lands on top
	spawnHalfWidth: 3, // confetti x-spawn range, ± this
})

// landscape spawn: single inline row
export const LANDSCAPE = Object.freeze({
	spacing: 2.6,
	y: 9,
	spawnHalfWidth: 7,
})
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

// staged instantiation: things spawn in levels, `STAGE_MS` apart, so an earlier
// level settles before the next drops in and disturbs it. level 0 = GRAEME
// (immediate); logos / buttons default to level 1. see Staged.jsx
export const STAGE_MS = 1100

// shared rigid-body feel for every SceneObject (letters, logos, buttons).
export const BODY = Object.freeze({
	restitution: 0.15,
	friction: 0.8,
	linearDamping: 0.3,
	angularDamping: 0.6,
})

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

// pit that keeps letters on screen — CuboidCollider half-extents.
// floor is fixed; side walls track the visible width (see Pit in Spike.jsx):
// landscape parks them at ±wallX, portrait snaps them to the window edges.
export const PIT = Object.freeze({
	floor: { position: [0, -5, 0], args: [12, 2, 3] },
	wallX: 8.5, // |x| of each side wall in landscape
	wallHalf: [0.5, 30, 3], // clears the off-frame spawn height + scroll range
})

// perspective camera
export const CAMERA = Object.freeze({ z: 13, fov: 45 })

// shared extrude depth for non-letter scene objects (logos, buttons).
// matches GRAEME's extrusion at BASE so the two-tone sun reads the same on
// everything. per-object override via descriptor.depth. see objects/README.md
export const DEPTH = 0.9

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
