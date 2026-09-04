// scene config — pulled out of the components so it survives fast-refresh and
// is easy to tune.

export const FONT = "/fonts/helvetiker_bold.typeface.json";

export const BASE = 1.5; // GRAEME letter size

// a word taller than wide -> drops in as two stacked rows (top row lands on the
// bottom one). spawn y values sit above the view (~5.4 at the default camera) so
// letters fall in from off-frame. spacing tightens to keep a long word within
// fitWidth; GRAEME's natural spacing is under it and unaffected.
export const PORTRAIT = Object.freeze({
  spacing: 1.7, // natural x gap between letters within a row
  fitWidth: 5.2, // max row span before spacing tightens
  rows: [16, 12], // spawn y for [top, bottom] row
  spawnHalfWidth: 3, // confetti x-spawn range, ± this
});

// landscape: a single inline row, centred
export const LANDSCAPE = Object.freeze({
  spacing: 2, // natural x gap
  fitWidth: 15.6, // max word span before spacing tightens (GRAEME sits at exactly this)
  y: 9,
  spawnHalfWidth: 7,
});
// chars the helvetiker_bold typeface actually has glyphs for
export const POOL = "GRAEMEDEVLOG0123456789.,:;+-=*/#!?()";

// collider / hit-box half-extents at BASE size (scaled by each letter's factor)
export const HALF = [0.85, 1.0, 0.3];

// how a character's glyph cells are coloured by the ascii pass
export const SHADING = Object.freeze({
  TWO_TONE: "two-tone", // ink on the camera-facing cap, inkDark on the sides
  SOLID: "solid", // single ink everywhere
});

// confetti size tiers below GRAEME — geometric sequence, ratio 1/2.
// ccd + grab only on the big tier; the small ones jitter/fling when dragged.
export const TIERS = Object.freeze([
  {
    factor: 1 / 2,
    count: 3,
    shading: SHADING.TWO_TONE,
    ccd: true,
    grabbable: true,
  },
  {
    factor: 1 / 4,
    count: 5,
    shading: SHADING.TWO_TONE,
    ccd: false,
    grabbable: false,
  },
  {
    factor: 1 / 8,
    count: 8,
    shading: SHADING.SOLID,
    ccd: false,
    grabbable: false,
  },
]);

export const PHYSICS = { gravity: [0, -14, 0] };

// staged instantiation: things spawn in levels, `STAGE_MS` apart, so an earlier
// level settles before the next drops in and disturbs it. level 0 = GRAEME
// (immediate); logos / buttons default to level 1. see useStaged.js
export const STAGE_MS = 1100;

// optional kick a SceneObject gets the moment it's released (unfrozen / spawned).
// descriptor / prop `launch` is a named key here or a raw [x,y,z] velocity.
// applied as a mass-scaled impulse so the resulting Δv matches regardless of size.
export const LAUNCH = Object.freeze({
  down: [0, 0, 0], // gravity only — the default
  left: [-9, 2, 0], // sideways + a little up so it arcs in
  right: [9, 2, 0],
});

// shared rigid-body feel for every SceneObject (letters, logos, buttons).
export const BODY = Object.freeze({
  restitution: 0.15,
  friction: 0.8,
  linearDamping: 0.3,
  angularDamping: 0.6,
});

// low-poly ogopogo (okmr_stonefish ogopogo.scn), thrown in like the letters.
// per-part colours are the scn <look> values (simple.scn <looks> block).
export const AUV = {
  scale: 3.5,
  position: [1, 8],
  spin: -0.35,
  tilt: [0.32, -0.55], // static visual rotation [x, y] for a 3/4 view
  colors: {
    hull: "#4d4d4d", // look "Gray"  (gray 0.3)
    rail: "#004dcc", // look "Blue"  (rgb 0.0 0.3 0.8)
    dvl: "#1a1a1a", // look "Black" (gray 0.0, nudged up so it renders)
    thruster: "#4d4d4d", // look "Gray"
  },
};

// pit that keeps letters on screen — CuboidCollider half-extents.
// floor sits flush with the bottom edge of the window (floorCenterY, below);
// side walls track the visible width (see pit.jsx): landscape parks them at
// ±wallX, portrait snaps them to the window edges.
export const PIT = Object.freeze({
  floor: { halfW: 12, halfH: 2, halfD: 3 },
  wallX: 8.5, // |x| of each side wall in landscape
  wallHalf: [0.5, 30, 3], // clears the off-frame spawn height
});

// perspective camera
export const CAMERA = Object.freeze({ z: 13, fov: 45 });

// visible half-extents at the z=0 drag plane. constant as the camera pans in y,
// so from fov + z (+ pixel aspect for width), not r3f's viewport helper.
// vertical fov is fixed, so height is the same on every window size.
export const visibleHalfHeight = () =>
  Math.tan((CAMERA.fov * Math.PI) / 360) * CAMERA.z;
export const visibleHalfWidth = (size) =>
  visibleHalfHeight() * (size.width / size.height);

// |x| of the side-wall inner face = half the playable width. landscape: fixed
// at wallX; portrait: the walls snap to the visible edge. size content off this,
// not the raw window, so it fits the pit.
export const playHalfWidth = (size, portrait) =>
  portrait ? visibleHalfWidth(size) : PIT.wallX - PIT.wallHalf[0];

// floor collider centre — top surface `FLOOR_LIFT` above the window's bottom
// edge (a letter's visual glyph is taller than its collider, so 0 leaves the
// pile poking past the edge). raise to sit the pile higher.
export const FLOOR_LIFT = 1;
export const floorCenterY = () =>
  -(visibleHalfHeight() + PIT.floor.halfH) + FLOOR_LIFT;

// a body this far past the visible edge (bottom or either side) counts as gone.
// an exit finishes only once every dynamic body is past it — see ClearWatch.
export const CLEAR_MARGIN = 3;

// shared extrude depth for non-letter scene objects (logos, buttons).
// matches GRAEME's extrusion at BASE so the two-tone sun reads the same on
// everything. per-object override via descriptor.depth. see objects/README.md
export const DEPTH = 0.9;

// pointer-drag spring
export const DRAG = { stiff: 90, damp: 12, maxImpulse: 8 };

export const ASCII = {
  chars: " .:-=+*#%@",
  cell: 6,
  ink: "#c8ff9b",
  inkDark: "#5c8a34",
  cutoffDeg: 15,
  contrast: 1.5, // pivot-0.5 contrast on the final tone
};
