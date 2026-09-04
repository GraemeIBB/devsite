import { useRef } from 'react'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { surfaceColor } from './asciiShader'
import { AUV } from './config'
import { grab, hoverCursor } from './drag'

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
	hull: surfaceColor(AUV.colors.hull),
	rail: surfaceColor(AUV.colors.rail),
	dvl: surfaceColor(AUV.colors.dvl),
	thruster: surfaceColor(AUV.colors.thruster),
}

function Body() {
	return (
		<group>
			<mesh material={MAT.hull} rotation={[0, 0, Math.PI / 2]} dispose={null}>
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

export function Auv() {
	const body = useRef()
	const s = AUV.scale
	return (
		<RigidBody
			ref={body}
			position={[AUV.position[0], AUV.position[1], 0]}
			rotation={[0, 0, AUV.spin]}
			colliders={false}
			ccd
			enabledTranslations={[true, true, false]}
			enabledRotations={[false, false, true]}
			restitution={0.15}
			friction={0.8}
			linearDamping={0.3}
			angularDamping={0.6}
		>
			{/* box ~ rails + thruster spread + DVL nub */}
			<CuboidCollider args={[0.3 * s, 0.16 * s, 0.2 * s]} position={[0, 0.05 * s, 0]} />
			{/* invisible grab target */}
			<mesh
				position={[0, 0.05 * s, 0]}
				onPointerDown={(e) => grab(e, body.current)}
				{...hoverCursor}
			>
				<boxGeometry args={[0.6 * s, 0.32 * s, 0.4 * s]} />
				<meshBasicMaterial colorWrite={false} depthWrite={false} />
			</mesh>
			<group scale={s} rotation={[AUV.tilt[0], AUV.tilt[1], 0]}>
				<Body />
			</group>
		</RigidBody>
	)
}
