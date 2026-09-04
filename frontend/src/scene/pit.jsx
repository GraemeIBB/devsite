import { useThree } from '@react-three/fiber'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { PIT, floorCenterY, visibleHalfWidth } from './config'

// ---- primitives -----------------------------------------------------------
// composable fixed bounds. exits (exits/*.jsx) build their Stage from these,
// leaving pieces out or adding actors of their own.

export function Floor() {
	const { halfW, halfH, halfD } = PIT.floor
	return (
		<RigidBody
			type="fixed"
			colliders={false}
			position={[0, floorCenterY(), 0]}
			friction={0.8}
		>
			<CuboidCollider args={[halfW, halfH, halfD]} />
		</RigidBody>
	)
}

// side: -1 left, +1 right. landscape parks at ±wallX; portrait snaps to the
// window edge. keyed on rounded x so a width change re-seats the wall.
export function Wall({ side, portrait }) {
	const size = useThree((s) => s.size)
	const x =
		side * (portrait ? visibleHalfWidth(size) + PIT.wallHalf[0] : PIT.wallX)
	return (
		<RigidBody
			key={Math.round(x * 100)}
			type="fixed"
			colliders={false}
			position={[x, 0, 0]}
			friction={0.8}
		>
			<CuboidCollider args={PIT.wallHalf} />
		</RigidBody>
	)
}

export function Walls({ portrait }) {
	return (
		<>
			<Wall side={-1} portrait={portrait} />
			<Wall side={1} portrait={portrait} />
		</>
	)
}

// the complete idle bounds. flags let an exit reuse it with pieces missing.
export function Pit({ portrait, floor = true, walls = true }) {
	return (
		<>
			{floor && <Floor />}
			{walls && <Walls portrait={portrait} />}
		</>
	)
}
