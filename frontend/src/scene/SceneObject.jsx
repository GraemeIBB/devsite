import { forwardRef, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RigidBody, CuboidCollider, BallCollider } from '@react-three/rapier'
import { BODY, LAUNCH } from './config'
import { grabOrClick, hoverCursor } from './drag'

const asVec = (launch) => (Array.isArray(launch) ? launch : LAUNCH[launch])

// the scene primitive: a plane-locked rapier body under the ascii pass. xy
// translation + z spin only, coplanar at z=0, shared restitution/friction/
// damping (config.BODY). callers pass the visual meshes as children; this adds
// the collider and, when interactive, an invisible hit target for grab / click.
//
// letters, logos and nav buttons are all just <SceneObject> + children.

const HIT_MAT = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })

// collider: { shape: 'cuboid', half: [x, y, z] } | { shape: 'ball', radius }
const SceneObject = forwardRef(function SceneObject(
	{
		collider,
		position,
		spin = 0,
		ccd = false,
		grabbable = false,
		onClick,
		frozen = false,
		launch, // 'down' | 'left' | 'right' | [x,y,z] — kick at release
		children,
	},
	fwd,
) {
	const inner = useRef()
	const body = fwd ?? inner
	const ball = collider.shape === 'ball'
	const interactive = grabbable || !!onClick

	// once, the moment the body is live (unfrozen): apply the launch impulse,
	// mass-scaled so Δv is `launch` regardless of the object's size.
	const launched = useRef(false)
	useEffect(() => {
		if (frozen || launched.current) return
		launched.current = true
		const v = asVec(launch)
		if (!v || (v[0] === 0 && v[1] === 0 && v[2] === 0)) return
		const rb = body.current
		if (!rb) return
		const m = rb.mass() || 1
		rb.applyImpulse({ x: v[0] * m, y: v[1] * m, z: 0 }, true)
	}, [frozen, launch, body])

	return (
		<RigidBody
			ref={body}
			// frozen: parked as a fixed body (no gravity, out of frame) until its
			// stage releases it -> dynamic, and it drops in. see useStaged
			type={frozen ? 'fixed' : 'dynamic'}
			position={[position[0], position[1], 0]}
			rotation={[0, 0, spin]}
			colliders={false}
			ccd={ccd}
			enabledTranslations={[true, true, false]}
			enabledRotations={[false, false, true]}
			restitution={BODY.restitution}
			friction={BODY.friction}
			linearDamping={BODY.linearDamping}
			angularDamping={BODY.angularDamping}
		>
			{/* frozen -> no collider at all: the parked body is inert, letters and
			    other objects pass through it until its stage releases it */}
			{!frozen &&
				(ball ? (
					<BallCollider args={[collider.radius]} />
				) : (
					<CuboidCollider args={collider.half} />
				))}

			{/* invisible hit target sized to the collider. shared geom/mat -> dispose={null} */}
			{interactive && !frozen && (
				<mesh
					material={HIT_MAT}
					scale={
						ball
							? [collider.radius, collider.radius, collider.radius]
							: collider.half.map((h) => h * 2)
					}
					dispose={null}
					onPointerDown={(e) => grabOrClick(e, body.current, onClick)}
					{...hoverCursor}
				>
					{ball ? <sphereGeometry args={[1, 16, 12]} /> : <boxGeometry />}
				</mesh>
			)}

			{children}
		</RigidBody>
	)
})

export default SceneObject
