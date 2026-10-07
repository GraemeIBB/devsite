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
//
// holds: named freezes requested from outside the scene (e.g. FpsWarning's
// popup). any active hold pauses physics like a blur AND stops rendering, so
// the last frame stays on screen. keyed so independent callers don't clobber
// each other.
import { useSyncExternalStore } from 'react'

let focused = true
const holds = new Set()
const subs = new Set()

export const setFocused = (v) => {
	focused = v
}

export const isFocused = () => focused && holds.size === 0

export const setHold = (key, on) => {
	if (on === holds.has(key)) return
	on ? holds.add(key) : holds.delete(key)
	subs.forEach((f) => f())
}

export const isHeld = () => holds.size > 0

const subscribe = (f) => {
	subs.add(f)
	return () => subs.delete(f)
}

export const useHeld = () => useSyncExternalStore(subscribe, isHeld)
