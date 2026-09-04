import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { CLEAR_MARGIN, visibleHalfHeight, visibleHalfWidth } from './config'

// while an exit runs, watches every dynamic body and fires `onClear` once they
// have ALL left the frame — past any edge, in any direction. the page swap that
// follows unmounts them all, so a body flung off the top never falls back in.
// a safety timeout in transition.js caps the wait if a body gets stuck.
export default function ClearWatch({ active, onClear }) {
	const { world } = useRapier()
	const size = useThree((s) => s.size)
	const fired = useRef(false)

	useEffect(() => {
		fired.current = false // reset each time an exit starts / ends
	}, [active])

	useFrame(() => {
		if (!active || fired.current || !world) return

		const halfX = visibleHalfWidth(size) + CLEAR_MARGIN
		const halfY = visibleHalfHeight() + CLEAR_MARGIN

		let cleared = true
		world.forEachRigidBody((b) => {
			if (!cleared || !b.isDynamic()) return
			const { x, y } = b.translation()
			if (Math.abs(x) < halfX && Math.abs(y) < halfY) cleared = false // still on screen
		})

		if (cleared) {
			fired.current = true
			onClear()
		}
	})

	return null
}
