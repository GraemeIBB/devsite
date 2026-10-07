import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { setStick, setStickRect, getKnob, getStickRect } from './auvInput'
import { surfaceColor } from './asciiShader'
import { ASCII } from './config'
import './Joystick.css'

const LIMIT = 0.65 // ring radius = knob travel, fraction of the hit area (rest is touch slop)
const DEADZONE = 0.15 // fraction of travel ignored, so a resting thumb doesn't drift
const DIST = 2 // world units in front of the camera the mesh floats at — ahead of the whole scene
const RING = [0.88, 1] // ring inner/outer, fraction of radius
const DOT = 0.2 // dot radius, fraction of radius

// touch-only devices; mouse/trackpad users have the keyboard
export const isTouch = () => window.matchMedia('(pointer: coarse)').matches

// on-screen analog stick for the AUV (okmr, landscape, touch) — two halves:
// Joystick is the invisible DOM hit area (input), JoystickMesh draws it inside
// the canvas so it goes through the ascii pass like everything else. they meet
// in auvInput.js; auv.jsx merges the stick with the arrow/WASD keys.
export default function Joystick() {
	const base = useRef()

	// publish the hit area's screen box for the mesh; release the stick on
	// unmount / blur so the AUV doesn't keep flying on a stale input
	useEffect(() => {
		const measure = () => {
			const r = base.current.getBoundingClientRect()
			setStickRect({ cx: r.left + r.width / 2, cy: r.top + r.height / 2, rad: (r.width / 2) * LIMIT })
		}
		const clear = () => setStick(0, 0)
		measure()
		window.addEventListener('resize', measure)
		window.addEventListener('blur', clear)
		return () => {
			window.removeEventListener('resize', measure)
			window.removeEventListener('blur', clear)
			setStick(0, 0)
			setStickRect(null)
		}
	}, [])

	function move(e) {
		const r = base.current.getBoundingClientRect()
		const half = r.width / 2
		const rad = half * LIMIT
		let dx = (e.clientX - (r.left + half)) / rad
		let dy = (e.clientY - (r.top + half)) / rad
		const len = Math.hypot(dx, dy)
		if (len > 1) {
			dx /= len
			dy /= len
		}
		// rescale past the deadzone so output still reaches 1 at the rim
		const mag = Math.min(1, len)
		const k = mag < DEADZONE ? 0 : (mag - DEADZONE) / (1 - DEADZONE) / (mag || 1)
		setStick(dx * k, -dy * k, dx, dy)
	}

	function down(e) {
		e.currentTarget.setPointerCapture(e.pointerId)
		move(e)
	}

	const up = () => setStick(0, 0)

	return (
		<div
			ref={base}
			className="joystick"
			onPointerDown={down}
			onPointerMove={(e) => e.buttons && move(e)}
			onPointerUp={up}
			onPointerCancel={up}
		/>
	)
}

const MAT = { ring: surfaceColor(ASCII.inkDark), dot: surfaceColor(ASCII.ink) }

// screen px -> a point DIST in front of the camera under that pixel
function place(obj, camera, size, px, py, v) {
	v.set((px / size.width) * 2 - 1, -(py / size.height) * 2 + 1, 0.5).unproject(camera)
	v.sub(camera.position).normalize().multiplyScalar(DIST).add(camera.position)
	obj.position.copy(v)
	obj.quaternion.copy(camera.quaternion)
}

// the stick's visuals, camera-locked over the DOM hit area. not in a
// RigidBody, so physics never sees it.
export function JoystickMesh() {
	const ring = useRef()
	const dot = useRef()
	const v = useMemo(() => new THREE.Vector3(), [])

	useFrame(({ camera, size }) => {
		const r = getStickRect()
		const vis = !!r
		ring.current.visible = dot.current.visible = vis
		if (!vis) return
		// CameraRig moved the camera this frame; unproject reads matrixWorld,
		// which otherwise only refreshes at render -> stick would lag the pan
		camera.updateMatrixWorld()
		const k = getKnob()
		const pxWorld = (2 * DIST * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / size.height
		const s = r.rad * pxWorld
		place(ring.current, camera, size, r.cx, r.cy, v)
		place(dot.current, camera, size, r.cx + k.x * r.rad, r.cy + k.y * r.rad, v)
		ring.current.scale.setScalar(s)
		dot.current.scale.setScalar(s)
	})

	return (
		<>
			<mesh ref={ring} material={MAT.ring} dispose={null}>
				<ringGeometry args={[RING[0], RING[1], 48]} />
			</mesh>
			<mesh ref={dot} material={MAT.dot} dispose={null}>
				<circleGeometry args={[DOT, 24]} />
			</mesh>
		</>
	)
}
