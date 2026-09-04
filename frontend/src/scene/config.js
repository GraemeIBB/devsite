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
  position: [-4, 8], // left of centre — OKMR's word letters are biased right (letterBiasX)
  spin: 0,
  tilt: [0.2, 0], // static visual rotation [x, y] — y (yaw toward camera) off for now
  canister: 0.85, // translucent hull: multiplies what's behind it by this (lower = darker)
  colors: {
    hull: "#4d4d4d", // look "Gray"  (gray 0.3)
    rail: "#004dcc", // look "Blue"  (rgb 0.0 0.3 0.8)
    dvl: "#1a1a1a", // look "Black" (gray 0.0, nudged up so it renders)
    thruster: "#4d4d4d", // look "Gray"
  },
  // keyboard flight (arrows / WASD, okmr scene). up/down ramp a depth setpoint
  // that a PID holds against gravity; left/right thrust horizontally (x runs
  // free); the hull banks toward horizontal input via a PD on heading.
  ctl: {
    hoverY: 1, // initial depth setpoint (world y)
    depthRange: [-3.5, 1.6], // clamp the setpoint clear of seabed / surface
    depthRate: 4, // units/s the setpoint moves while up/down held
    // oMax is the motor authority — gravity is ~14, so 20 leaves little headroom:
    // a letter barging in shoves the AUV off station and it has to fight back.
    depth: { kp: 40, ki: 10, kd: 11, iMax: 4, oMax: 20 }, // -> accel (mass-scaled)
    surge: 8, // horizontal thrust accel while left/right held
    bank: 0.4, // rad the hull leans toward horizontal input
    heading: { kp: 12, kd: 5, oMax: 7 }, // PD -> clamped torque impulse
    dtMax: 0.05, // clamp frame dt fed to the controllers
  },
};

// robosub-style qualification gate (okmr_stonefish/data/objects/gate.scn):
// two poles joined by a bottom crossbar, sized in the same real-world/stonefish
// units as AUV (see gate.jsx — its own remap note explains why it differs from
// AUV's [x, z, y]). placed partway into the extended okmr level (see
// okmrRightX) so the camera-follow has something to reveal.
export const GATE = Object.freeze({
  scale: 1.75,
  positionX: 14,
  positionY: 0, // gate's vertical centre (world y) — fully submerged, a short dive below AUV.ctl.hoverY
  colors: {
    red: "#e63946", // look "Red"
    black: "#1a1a1a", // look "Black"
    gray: "#4d4d4d", // look "Gray"
  },
});

// pit that keeps letters on screen — CuboidCollider half-extents.
// floor sits flush with the bottom edge of the window (floorCenterY, below);
// side walls track the visible width (see pit.jsx): landscape parks them at
// ±wallX, portrait snaps them to the window edges.
export const PIT = Object.freeze({
  floor: { halfW: 12, halfH: 2, halfD: 3 },
  wallX: 8.5, // |x| of each side wall in landscape
  wallHalf: [0.5, 30, 3], // clears the off-frame spawn height
});

// perspective camera. `followLerp`: how fast the okmr camera rig (SceneCanvas)
// eases toward its target x (/s, exp-approach — see water.jsx's riseSpeed for
// the same pattern).
export const CAMERA = Object.freeze({ z: 13, fov: 45, followLerp: 3 });

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

// okmr — the water scene (scene/water.jsx). a #03b787 body of water that rises
// from below the frame on entrance and drains back down on exit (exits/drain,
// the reverse). all tunable; `surfaceY - depth` is the sea floor.
export const OKMR = Object.freeze({
  color: "#65bbdd", // sea green
  floorColor: "#0b2b4a", // dark blue sea floor
  surfaceY: 2, // water-surface rest height (world y) — ~2/3 up the frame
  depth: 7, // surface -> sea floor (floor top y = -5)
  screens: 3, // level width, in screens — the camera pans across it (see okmrRightX, SceneCanvas' CameraRig)
  slabZ: 2, // visual z-thickness of the water body
  floorHalfH: 1.5, // sea-floor collider half-height
  riseSpeed: 2.5, // exp-approach rate of the level tween (/s), both directions
  // buoyancy on every dynamic body below the surface: a spring toward the
  // surface minus vertical drag. rest submersion ~= |gravity| / buoyLift.
  buoyLift: 16, // upward accel per unit submersion
  buoyDamp: 5, // vertical-velocity drag while submerged
  buoyMax: 3, // submersion depth the lift saturates at
  buoyPoint: 0.6, // apply the lift this far above the body origin (keeps bodies upright)
  chain: 4.5, // bound-letter tether length (anchor -> letter's bottom edge);
  //             shorter than the free-float distance, so it holds letters low + upright
  fadeMs: 800, // bound letters dissolve in over this long once unfrozen
  letterBiasX: 2.2, // shift the word right of centre (landscape only) — clears the left side for the AUV
});

// okmr level bounds (world x, landscape only — portrait stays single-screen).
// left edge = the ordinary left wall, same x every other scene uses; right
// edge is `screens` screen-widths further out, with no wall there — water and
// the sea floor span this range (+ OKMR_BLEED so they still run offscreen),
// and the camera rig (SceneCanvas) pans between the two, pinning at each end.
export const OKMR_BLEED = 4.5;
export const okmrLeftX = () => -PIT.wallX;
export const okmrRightX = (size) =>
  okmrLeftX() + OKMR.screens * 2 * visibleHalfWidth(size);

export const ASCII = {
  chars: " .:-=+*#%@",
  cell: 4,
  ink: "#c8ff9b",
  inkDark: "#5c8a34",
  cutoffDeg: 15,
  contrast: 1.5, // pivot-0.5 contrast on the final tone
  // multiplies the resolved ink colour (post ink/inkDark, not the raw normal
  // buffer) for any cell below the okmr waterline — see SceneCanvas'
  // AsciiEffects (uWaterLineV) and asciiShader.js's uWaterTint.
  waterTint: "#bfe8ff",
};
