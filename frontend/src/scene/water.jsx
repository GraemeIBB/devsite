import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider, useRapier } from '@react-three/rapier'
import { surfaceColor } from './asciiShader'
import { OKMR, PIT, visibleHalfHeight } from './config'
import { getWaterLevel } from './waterLevel'

// the okmr body of water: a flat-shaded slab (#03b787) with a kinematic
// sea-floor collider at its base. both track the shared 0..1 level (waterLevel.js)
//   0 = surface parked just below the frame (nothing to stand on)
//   1 = rest pose (surface at OKMR.surfaceY, sea floor OKMR.depth below it)
// OkmrScene drives it to 1 (rise); exits/drain drives it to 0 (sink out the
// bottom — everything riding the sea floor goes with it).

const REST_MID = OKMR.surfaceY - OKMR.depth / 2
const FLOOR_CENTER = OKMR.surfaceY - OKMR.depth - OKMR.floorHalfH
// sit the slab behind the z=0 actor plane so letters / the AUV render in front
// of the water, not occluded by it (the ascii pass has no alpha blend)
const SLAB_Z = -OKMR.slabZ / 2 - 0.5

export function Water() {
	const { world } = useRapier()
	const slab = useRef()
	const floor = useRef()
	const lvl = useRef(0)
	// travel from "surface one unit below the frame" up to the rest pose
	const rise = visibleHalfHeight() + 1 + OKMR.surfaceY

	useFrame((_, dt) => {
		lvl.current +=
			(getWaterLevel() - lvl.current) * Math.min(1, dt * OKMR.riseSpeed)
		const dy = (lvl.current - 1) * rise
		if (slab.current) slab.current.position.y = REST_MID + dy
		floor.current?.setNextKinematicTranslation({
			x: 0,
			y: FLOOR_CENTER + dy,
			z: 0,
		})

		// buoyancy: lift every dynamic body that's below the current surface so
		// letters / the AUV bob up and settle near it. spring - drag, mass-scaled
		// so it's size-independent. drains away with the surface on exit. applied
		// `buoyPoint` above the body origin so bodies float roughly upright.
		const surf = OKMR.surfaceY + dy
		world.forEachRigidBody((b) => {
			if (!b.isDynamic() || b.userData?.noBuoyancy) return
			const t = b.translation()
			const sub = surf - t.y
			if (sub <= 0) return
			const a = OKMR.buoyLift * Math.min(sub, OKMR.buoyMax) - OKMR.buoyDamp * b.linvel().y
			const m = b.mass() || 1
			b.applyImpulseAtPoint(
				{ x: 0, y: a * m * dt, z: 0 },
				{ x: t.x, y: t.y + OKMR.buoyPoint, z: t.z },
				true,
			)
		})
	})

	return (
		<>
			<mesh
				ref={slab}
				position={[0, REST_MID - rise, SLAB_Z]}
				material={surfaceColor(OKMR.color)}
				dispose={null}
			>
				<boxGeometry args={[OKMR.width, OKMR.depth, OKMR.slabZ]} />
			</mesh>
			<RigidBody
				ref={floor}
				type="kinematicPosition"
				colliders={false}
				position={[0, FLOOR_CENTER - rise, 0]}
				friction={0.8}
			>
				<CuboidCollider args={[OKMR.width / 2, OKMR.floorHalfH, PIT.floor.halfD]} />
			</RigidBody>
		</>
	)
}
