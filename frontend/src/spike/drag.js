import { useEffect } from 'react'
import * as THREE from 'three'
import { useThree, useFrame } from '@react-three/fiber'
import { DRAG } from './config'

// one grabbed body at a time, driven by a single controller.
const DRAG_PLANE = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
const _q = new THREE.Quaternion()
const _r = new THREE.Vector3()
const _hit = new THREE.Vector3()
let held = null // { body, anchor } — anchor is the grab point in body-local space

export function grab(e, body) {
	if (!body) return
	e.stopPropagation()
	e.nativeEvent.target.setPointerCapture?.(e.nativeEvent.pointerId)
	const t = body.translation()
	const rot = body.rotation()
	_q.set(rot.x, rot.y, rot.z, rot.w).invert()
	const anchor = new THREE.Vector3(e.point.x - t.x, e.point.y - t.y, 0).applyQuaternion(_q)
	held = { body, anchor }
	document.body.style.cursor = 'grabbing'
	body.wakeUp()
}

// stable hover handlers for a grabbable object's hit mesh (no ref involved)
export const hoverCursor = {
	onPointerOver: () => !held && (document.body.style.cursor = 'grab'),
	onPointerOut: () => !held && (document.body.style.cursor = ''),
}

// grab + fling always; if the pointer barely moved between down and up it was a
// tap, so also fire onClick. onClick omitted -> plain grab.
const CLICK_SLOP = 6 // px
const CLICK_MS = 350

export function grabOrClick(e, body, onClick) {
	grab(e, body)
	if (!onClick) return
	const { clientX: x0, clientY: y0 } = e.nativeEvent
	const t0 = performance.now()
	const up = (ev) => {
		window.removeEventListener('pointerup', up)
		if (
			Math.hypot(ev.clientX - x0, ev.clientY - y0) <= CLICK_SLOP &&
			performance.now() - t0 <= CLICK_MS
		) {
			onClick()
		}
	}
	window.addEventListener('pointerup', up)
}

export function DragController() {
	const { camera, raycaster, pointer } = useThree()

	useFrame(() => {
		if (!held) return
		raycaster.setFromCamera(pointer, camera)
		if (!raycaster.ray.intersectPlane(DRAG_PLANE, _hit)) return

		const { body, anchor } = held
		const t = body.translation()
		const rot = body.rotation()
		_r.copy(anchor).applyQuaternion(_q.set(rot.x, rot.y, rot.z, rot.w))
		const ax = t.x + _r.x
		const ay = t.y + _r.y

		// velocity at the grabbed point (linear + angular contribution)
		const lv = body.linvel()
		const w = body.angvel().z
		const vax = lv.x - w * _r.y
		const vay = lv.y + w * _r.x

		// damped spring pulling the anchor to the cursor, applied at the anchor
		let fx = (_hit.x - ax) * DRAG.stiff - vax * DRAG.damp
		let fy = (_hit.y - ay) * DRAG.stiff - vay * DRAG.damp
		const m = Math.hypot(fx, fy) / 60
		if (m > DRAG.maxImpulse) {
			fx *= DRAG.maxImpulse / m
			fy *= DRAG.maxImpulse / m
		}
		body.applyImpulseAtPoint({ x: fx / 60, y: fy / 60, z: 0 }, { x: ax, y: ay, z: 0 }, true)
	})

	useEffect(() => {
		const release = () => {
			held = null
			document.body.style.cursor = ''
		}
		window.addEventListener('pointerup', release)
		return () => window.removeEventListener('pointerup', release)
	}, [])

	return null
}
