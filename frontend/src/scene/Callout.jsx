import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { FONT_MONOGRAM } from './config'

// a floating label wired to a moving point: a drei <Html> textbox that trails
// its target on a lerp (so it doesn't jitter 1:1 with physics), joined to the
// pin by an elbow leader line — a 45° diagonal out of the pin, then a straight
// horizontal-or-vertical run into the box. everything is repainted
// imperatively each frame (style/attribute writes, no React state) — same
// style as the camera rig / auv controller.
//
// the <Html fullscreen> is mounted as a child of the CAMERA, not the scene
// root: fullscreen's `top:-height/2;left:-height/2` only lines up with the
// true viewport if the wrapper's own world-position anchor projects to dead
// screen-center — true for a point sitting on the camera's local forward
// axis, at any camera position/pan, but NOT for a point fixed at the world
// origin (drifts across the screen as SceneCanvas's CameraRig pans). anchored
// to the camera, the wrapper is always exactly viewport-aligned, so our own
// pixel math (camera.project()) is the only thing moving the line/box.
//
// `target`: a ref to a rapier RigidBody (its `.translation()` is read every
// frame) OR a static [x, y, z?] point — so a Callout can hang off any
// SceneObject (pass its forwarded ref) or a fixed spot in the scene.
// `pinOffset`: world-unit offset from target -> pin (not to be confused with
// boundLetters.jsx's `anchor` — that's a fixed rope/chain mooring point, an
// unrelated concept). `offset`: world-unit offset from pin -> the box's
// resting point (before lerp). `lerp`: a followLerp-style chase speed
// (config.CAMERA.followLerp is the same idea) — higher snaps faster to
// `offset`, lower trails more.

const scratch = new THREE.Vector3()

function targetPosition(target, out) {
	if (Array.isArray(target)) return out.set(target[0], target[1], target[2] ?? 0)
	const rb = target?.current
	if (rb?.translation) {
		const t = rb.translation()
		return out.set(t.x, t.y, t.z)
	}
	return out.set(0, 0, 0)
}

function toScreen(world, camera, size) {
	scratch.copy(world).project(camera)
	return {
		x: (scratch.x * 0.5 + 0.5) * size.width,
		y: (-scratch.y * 0.5 + 0.5) * size.height,
	}
}

// bend point for the leader: equal diagonal run up to the shorter axis, then
// a straight run (horizontal if x is the longer leg, else vertical) into `b`.
function elbow(p, b) {
	const dx = b.x - p.x
	const dy = b.y - p.y
	const s = Math.min(Math.abs(dx), Math.abs(dy))
	const sx = dx < 0 ? -1 : 1
	const sy = dy < 0 ? -1 : 1
	return Math.abs(dx) >= Math.abs(dy)
		? { x: p.x + sx * s, y: b.y }
		: { x: b.x, y: p.y + sy * s }
}

export default function Callout({
	target,
	pinOffset = [0, 0, 0],
	offset = [2, 1.4],
	lerp = 6,
	font = FONT_MONOGRAM,
	fontSize = 14,
	color = '#111111',
	background = '#efeee6',
	padding = '3px 7px',
	radius = 2,
	lineColor,
	lineWidth = 6,
	children,
}) {
	const { camera, size } = useThree()
	const pathRef = useRef()
	const boxRef = useRef()
	const pin = useMemo(() => new THREE.Vector3(), [])
	const boxWorld = useMemo(() => new THREE.Vector3(), [])
	const lerped = useRef(null) // seeded on first frame — no snap-in from the origin

	useFrame((_, delta) => {
		// three only recomputes camera.matrixWorld during the renderer's own
		// traversal, which runs after every useFrame callback — force it so a
		// panning camera (CameraRig) doesn't leave us reading last frame's
		// transform, a lag that'd otherwise grow with camera speed
		camera.updateMatrixWorld()

		targetPosition(target, pin)
		pin.x += pinOffset[0]
		pin.y += pinOffset[1]
		pin.z += pinOffset[2] ?? 0

		// floor: the box (and so the leader line) never sinks below the pin's own
		// height — the pin's y is the floor, not the target's raw y, so a low
		// `pinOffset` still lets the label sit under a tall object if wanted
		boxWorld.set(pin.x + offset[0], Math.max(pin.y + offset[1], pin.y), pin.z)
		if (!lerped.current) lerped.current = boxWorld.clone()
		const k = Math.min(1, delta * lerp)
		lerped.current.x += (boxWorld.x - lerped.current.x) * k
		lerped.current.y += (boxWorld.y - lerped.current.y) * k
		lerped.current.y = Math.max(lerped.current.y, pin.y)
		lerped.current.z = boxWorld.z

		const p = toScreen(pin, camera, size)
		const b = toScreen(lerped.current, camera, size)
		const j = elbow(p, b)

		pathRef.current?.setAttribute('d', `M${p.x},${p.y} L${j.x},${j.y} L${b.x},${b.y}`)

		if (boxRef.current) {
			// anchor the box's corner nearest the pin at the line's end, so it
			// always grows away from the pin rather than straddling it
			const nx = b.x < p.x ? -100 : 0
			const ny = b.y < p.y ? -100 : 0
			boxRef.current.style.transform = `translate(${b.x}px, ${b.y}px) translate(${nx}%, ${ny}%)`
		}
	})

	return (
		<primitive object={camera}>
			{/* z=-1: on the camera's forward axis, so it always projects to dead
			    centre — z=0 (the camera's own origin) is degenerate/behind-near-plane */}
			<Html position={[0, 0, -1]} fullscreen zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
				<svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
					<path ref={pathRef} fill="none" stroke={lineColor ?? color} strokeWidth={lineWidth} />
				</svg>
				<div
					ref={boxRef}
					style={{
						position: 'absolute',
						left: 0,
						top: 0,
						fontFamily: font,
						fontSize,
						color,
						background,
						padding,
						borderRadius: radius,
						whiteSpace: 'nowrap',
						lineHeight: 1.3,
					}}
				>
					{children}
				</div>
			</Html>
		</primitive>
	)
}
