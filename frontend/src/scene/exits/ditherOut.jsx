import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Pit } from '../pit'
import { dither, DITHER_MS as DURATION } from '../dither'

// whole-scene dither-out: bounds stay put (nothing falls), the ascii pass drops
// cells on a stipple hash until the frame is empty. `timed`: the swap fires
// when `duration` elapses, not when bodies clear (nothing leaves the frame).
function DitherStage({ portrait }) {
	const t0 = useRef(null)
	useFrame((state) => {
		t0.current ??= state.clock.elapsedTime
		dither.scene = Math.max(0, 1 - ((state.clock.elapsedTime - t0.current) * 1000) / DURATION)
	})
	// swap follows unmount; the next scene starts fully drawn
	useEffect(() => () => { dither.scene = 1; dither.dir = 0 }, [])
	return <Pit portrait={portrait} />
}

export default { name: 'dither-out', duration: DURATION, timed: true, Stage: DitherStage }
