import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { PIT, visibleHalfWidth } from '../config'

// a kinematic wall that starts at the left edge and drives across to the right
// over `duration` ms, shoving everything out the open (right) side. doubles as
// the left bound while it travels.
export default function Sweeper({ portrait, duration }) {
	const body = useRef()
	const t0 = useRef(0)
	const size = useThree((s) => s.size)
	const halfW = portrait ? visibleHalfWidth(size) + PIT.wallHalf[0] : PIT.wallX
	const from = -halfW
	const to = halfW + 2

	useFrame((state) => {
		const rb = body.current
		if (!rb) return
		if (!t0.current) t0.current = state.clock.elapsedTime
		const p = Math.min(1, (state.clock.elapsedTime - t0.current) / (duration / 1000))
		rb.setNextKinematicTranslation({ x: from + (to - from) * p, y: 0, z: 0 })
	})

	return (
		<RigidBody
			ref={body}
			type="kinematicPosition"
			colliders={false}
			position={[from, 0, 0]}
		>
			<CuboidCollider args={PIT.wallHalf} />
		</RigidBody>
	)
}
