// shared 0..1 fill level for the okmr water (scene/water.jsx):
//   0 = surface parked just below the frame,  1 = rest pose.
// OkmrScene drives it to 1 (rise), exits/drain drives it to 0 (drain); <Water>
// eases toward it every frame. module-scoped so it survives the scene <-> exit
// handoff, when both OkmrScene and the exit Stage are mounted at once.
let level = 0

export const setWaterLevel = (v) => {
	level = v
}

export const getWaterLevel = () => level

// live world-y of the water surface, eased (see water.jsx) — not just the 0..1
// target above. lets bodies that fly themselves (the AUV — it opts out of
// water.jsx's buoyancy loop) tell whether they're currently submerged. defaults
// low so nothing reads as submerged before <Water> has run its first frame.
let surfaceY = -Infinity

export const setWaterSurfaceY = (v) => {
	surfaceY = v
}

export const getWaterSurfaceY = () => surfaceY
