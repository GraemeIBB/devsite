import { useEffect, useState } from 'react'
import { STAGE_MS } from './config'

// staged instantiation without a mount gate: every object is created up front
// (geometry + shaders warm during the initial scene spin-up), but higher levels
// stay frozen — RigidBody type "fixed", parked above the frame — until
// `level * STAGE_MS` has passed. releasing just flips the body to "dynamic" and
// it drops in, so nothing hitches on the frame a wave appears.
//
// level 0 = GRAEME (released immediately). the timer resets on scene remount
// (orientation flip), so the stagger replays.
export function useStaged(level = 0) {
	const [released, setReleased] = useState(level <= 0)
	useEffect(() => {
		if (level <= 0) return
		const id = setTimeout(() => setReleased(true), level * STAGE_MS)
		return () => clearTimeout(id)
	}, [level])
	return released
}
