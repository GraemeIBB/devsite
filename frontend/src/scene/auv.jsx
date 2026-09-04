import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { surfaceColor, surfaceTint } from './asciiShader'
import { AUV } from './config'
import { grab, hoverCursor } from './drag'
import { pid } from './pid'
import { useStaged } from './useStaged'
import { getWaterSurfaceY } from './waterLevel'
import { setAuvX } from './auvTrack'

const NO_BUOYANCY = { noBuoyancy: true } // water.jsx skips this body — the AUV flies itself

// arrows / WASD -> intent flags
const KEYMAP = {
	ArrowUp: 'up', KeyW: 'up',
	ArrowDown: 'down', KeyS: 'down',
	ArrowLeft: 'left', KeyA: 'left',
	ArrowRight: 'right', KeyD: 'right',
}

// low-poly ogopogo, rebuilt from okmr_stonefish/data/robots/ogopogo.scn
// (primitives only). stonefish is Z-up / X-forward; remapped here to
// three's Y-up as [x, z, y] and viewed side-on. per-part colour = scn <look>.
const HULL = { r: 0.075, len: 0.3 }
const RAIL = [0.5, 0.05, 0.075]
const DVL = { r: 0.035, h: 0.08 }
const TH = { r: 0.045, h: 0.06 }

// [x, y(up), z(depth)] + rotation. inner 4 = vertical heave, outer 4 = vectored
const THRUSTERS = [
	{ p: [0.2, 0.05, -0.1], r: [0, 0, 0] },
	{ p: [0.2, 0.05, 0.1], r: [0, 0, 0] },
	{ p: [-0.2, 0.05, -0.1], r: [0, 0, 0] },
	{ p: [-0.2, 0.05, 0.1], r: [0, 0, 0] },
	{ p: [0.25, 0.05, -0.15], r: [0, 0.45, Math.PI / 2] },
	{ p: [0.25, 0.05, 0.15], r: [0, -0.45, Math.PI / 2] },
	{ p: [-0.25, 0.05, -0.15], r: [0, -0.45, Math.PI / 2] },
	{ p: [-0.25, 0.05, 0.15], r: [0, 0.45, Math.PI / 2] },
]

const MAT = {
	hull: surfaceTint(AUV.canister), // translucent tube — darkens what's behind it
	rail: surfaceColor(AUV.colors.rail),
	dvl: surfaceColor(AUV.colors.dvl),
	thruster: surfaceColor(AUV.colors.thruster),
}

function Body() {
	return (
		<group>
			<mesh
				material={MAT.hull}
				rotation={[0, 0, Math.PI / 2]}
				renderOrder={10} // after opaque geometry: it tints what's already drawn
				dispose={null}
			>
				<capsuleGeometry args={[HULL.r, HULL.len, 4, 12]} />
			</mesh>
			<mesh material={MAT.rail} position={[0, 0.035, -0.1]} dispose={null}>
				<boxGeometry args={RAIL} />
			</mesh>
			<mesh material={MAT.rail} position={[0, 0.035, 0.1]} dispose={null}>
				<boxGeometry args={RAIL} />
			</mesh>
			<mesh material={MAT.dvl} position={[-0.06, 0.12, 0]} dispose={null}>
				<cylinderGeometry args={[DVL.r, DVL.r, DVL.h, 10]} />
			</mesh>
			{THRUSTERS.map(({ p, r }, i) => (
				<mesh key={i} material={MAT.thruster} position={p} rotation={r} dispose={null}>
					<cylinderGeometry args={[TH.r, TH.r, TH.h, 8]} />
				</mesh>
			))}
		</group>
	)
}

export function Auv({ level = 0 }) {
	const body = useRef()
	const keys = useRef(new Set())
	const targetY = useRef(AUV.ctl.hoverY) // depth setpoint the up/down keys ramp
	const [depthPid] = useState(() => pid(AUV.ctl.depth))
	const released = useStaged(level)
	const s = AUV.scale

	useEffect(() => {
		const down = (e) => {
			const k = KEYMAP[e.code]
			if (!k) return
			keys.current.add(k)
			e.preventDefault()
		}
		const up = (e) => keys.current.delete(KEYMAP[e.code])
		window.addEventListener('keydown', down)
		window.addEventListener('keyup', up)
		return () => {
			window.removeEventListener('keydown', down)
			window.removeEventListener('keyup', up)
		}
	}, [])

	useFrame((_, delta) => {
		const rb = body.current
		if (!rb || !released || !rb.isDynamic()) return
		setAuvX(rb.translation().x) // camera rig follow target (SceneCanvas) — track even out of water/falling

		// no water, no control — same as a real thruster losing its medium. covers
		// the okmr drain exit for free (surface sinks out from under it) and lets
		// the player fly it out of the water and just fall.
		if (rb.translation().y >= getWaterSurfaceY()) {
			depthPid.reset()
			return
		}

		const dt = Math.min(delta, AUV.ctl.dtMax)
		const k = keys.current
		const m = rb.mass() || 1

		// vertical — keys ramp the setpoint, PID holds it (I term cancels gravity)
		const [lo, hi] = AUV.ctl.depthRange
		if (k.has('up')) targetY.current += AUV.ctl.depthRate * dt
		if (k.has('down')) targetY.current -= AUV.ctl.depthRate * dt
		targetY.current = Math.max(lo, Math.min(hi, targetY.current))
		const fy = depthPid.step(targetY.current - rb.translation().y, dt)
		rb.applyImpulse({ x: 0, y: fy * m * dt, z: 0 }, true)

		// horizontal — direct thrust, x drifts free
		const sx = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0)
		if (sx) rb.applyImpulse({ x: sx * AUV.ctl.surge * m * dt, y: 0, z: 0 }, true)

		// heading — bank toward the horizontal input, PD hold, clamped authority
		const r = rb.rotation()
		const ang = 2 * Math.atan2(r.z, r.w)
		const { kp, kd, oMax } = AUV.ctl.heading
		const tq = kp * (-sx * AUV.ctl.bank - ang) - kd * rb.angvel().z
		rb.applyTorqueImpulse(
			{ x: 0, y: 0, z: Math.max(-oMax, Math.min(oMax, tq)) * dt },
			true,
		)
	})

	return (
		<RigidBody
			ref={body}
			// parked as a fixed body above the frame until its level releases it
			type={released ? 'dynamic' : 'fixed'}
			userData={NO_BUOYANCY}
			position={[AUV.position[0], AUV.position[1], 0]}
			rotation={[0, 0, AUV.spin]}
			colliders={false}
			ccd
			enabledTranslations={[true, true, false]}
			enabledRotations={[false, false, true]} // z only — heading PD drives it
			restitution={0.15}
			friction={0.8}
			linearDamping={1.1}
			angularDamping={3}
		>
			{/* box ~ rails + thruster spread + DVL nub — model is rolled 180° below,
			    so its mass sits at -0.05*s */}
			<CuboidCollider args={[0.3 * s, 0.16 * s, 0.2 * s]} position={[0, -0.05 * s, 0]} />
			{/* invisible grab target */}
			<mesh
				position={[0, -0.05 * s, 0]}
				onPointerDown={(e) => grab(e, body.current)}
				{...hoverCursor}
			>
				<boxGeometry args={[0.6 * s, 0.32 * s, 0.4 * s]} />
				<meshBasicMaterial colorWrite={false} depthWrite={false} />
			</mesh>
			<group scale={s} rotation={[AUV.tilt[0], AUV.tilt[1], 0]}>
				{/* the .scn remap came out inverted — roll 180° about the nose axis
				    (keeps +x forward, no negative scale so normals stay correct) */}
				<group rotation={[Math.PI, 0, 0]}>
					<Body />
				</group>
			</group>
		</RigidBody>
	)
}
