import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { PIT, floorCenterY, visibleHalfWidth } from '../config'

// the floor re-anchored to hinge on its left corner, then whipped up about that
// corner over `duration` ms — everything resting on it gets lobbed up and to
// the right, off screen.
export default function PivotFloor({ portrait, duration }) {
	const body = useRef()
	const t0 = useRef(0)
	const size = useThree((s) => s.size)

	const halfW = portrait ? visibleHalfWidth(size) + PIT.wallHalf[0] : PIT.wallX
	const { halfH, halfD } = PIT.floor
	const y = floorCenterY()
	const MAX = 1.0 // radians the free end swings through

	useFrame((state) => {
		const rb = body.current
		if (!rb) return
		if (!t0.current) t0.current = state.clock.elapsedTime
		const p = Math.min(1, (state.clock.elapsedTime - t0.current) / (duration / 1000))
		const a = MAX * p * p // ease-in so it whips
		rb.setNextKinematicTranslation({ x: -halfW, y, z: 0 })
		rb.setNextKinematicRotation({ x: 0, y: 0, z: Math.sin(a / 2), w: Math.cos(a / 2) })
	})

	return (
		<RigidBody
			ref={body}
			type="kinematicPosition"
			colliders={false}
			position={[-halfW, y, 0]}
		>
			{/* plank spans from the hinge (body origin) rightward */}
			<CuboidCollider args={[halfW, halfH, halfD]} position={[halfW, 0, 0]} />
		</RigidBody>
	)
}
