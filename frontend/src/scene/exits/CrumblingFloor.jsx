import { useEffect, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { PIT, floorCenterY, visibleHalfWidth } from '../config'

const SECTIONS = 5
const GAP_MS = 150 // between each section dropping away

// the floor split into SECTIONS spanning the pit width; they vanish left to
// right, GAP_MS apart, so bodies fall through in a cascade. walls stay (see the
// exit) so everything drops straight down.
export default function CrumblingFloor({ portrait }) {
	const size = useThree((s) => s.size)
	const [gone, setGone] = useState(0)

	useEffect(() => {
		if (gone >= SECTIONS) return
		const id = setTimeout(() => setGone((g) => g + 1), GAP_MS)
		return () => clearTimeout(id)
	}, [gone])

	const halfW = portrait ? visibleHalfWidth(size) + PIT.wallHalf[0] : PIT.wallX
	const { halfH, halfD } = PIT.floor
	const y = floorCenterY()
	const segHalf = halfW / SECTIONS

	return Array.from({ length: SECTIONS }, (_, i) =>
		i < gone ? null : (
			<RigidBody
				key={i}
				type="fixed"
				colliders={false}
				position={[-halfW + segHalf * (2 * i + 1), y, 0]}
				friction={0.8}
			>
				<CuboidCollider args={[segHalf, halfH, halfD]} />
			</RigidBody>
		),
	)
}
