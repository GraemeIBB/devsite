// shared "is the tab focused" flag, set by SceneCanvas's visibilitychange
// listener. same module-scoped pattern as waterLevel.js/auvTrack.js.
//
// physics-adjacent per-frame systems that apply their own impulses outside
// <Physics> itself (water.jsx's buoyancy, boundLetters.jsx's chain spring)
// gate on this and skip entirely while hidden, instead of scaling by dt —
// <Physics paused> stops rapier from stepping, but these run in their own
// useFrame and would otherwise still shove a multi-second dt's worth of
// impulse into a body's velocity on the frame the tab comes back, which then
// lands in one shot the moment stepping resumes.
let focused = true

export const setFocused = (v) => {
	focused = v
}

export const isFocused = () => focused
