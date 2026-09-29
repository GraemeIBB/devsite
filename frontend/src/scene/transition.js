import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { pickExit, exitTo } from './exits'
import { SCENE_EXIT } from './pages'

// how long past an exit's own duration to keep waiting for the scene to clear
// before forcing the swap (a body wedged on a ledge shouldn't hang the site).
const SAFETY_MS = 5000

// what the scene is showing, readable outside the canvas (Devlog waits for the
// scene's exit to finish before dithering its text in).
let shownStore = null
const subs = new Set()
const setShownStore = (p) => {
	if (p === shownStore) return
	shownStore = p
	subs.forEach((f) => f())
}
export const useShownPath = () =>
	useSyncExternalStore(
		(cb) => (subs.add(cb), () => subs.delete(cb)),
		() => shownStore,
	)

// drives the persistent scene: `shownPath` is what the scene currently renders;
// `exit` is the exit module playing before it swaps to the router's location
// (null = idle). the swap fires when ClearWatch reports every body has left the
// frame, or the safety timeout — whichever first. mid-exit nav folds into the
// pending swap (you land on the final destination).
export function useSceneTransition() {
	const { pathname } = useLocation()
	const [shownPath, setShownPath] = useState(pathname)
	const [exit, setExit] = useState(null)

	useEffect(() => setShownStore(shownPath), [shownPath])

	const latest = useRef(pathname)
	useEffect(() => {
		latest.current = pathname
	}, [pathname])

	// route diverged and nothing playing -> pick an exit (guarded, converges).
	// the scene being left can pin its exit (SCENE_EXIT), else it's random.
	if (pathname !== shownPath && !exit) {
		setExit(exitTo(pathname) ?? SCENE_EXIT[shownPath] ?? pickExit())
	}

	const clear = useCallback(() => {
		setShownPath(latest.current)
		setExit(null)
	}, [])

	// safety cap on the position-based clear
	useEffect(() => {
		if (!exit) return
		const id = setTimeout(clear, exit.timed ? exit.duration : exit.duration + SAFETY_MS)
		return () => clearTimeout(id)
	}, [exit, clear])

	return { shownPath, exit, clear }
}
