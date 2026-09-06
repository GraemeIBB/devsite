import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RigidBody, CuboidCollider, useRapier } from '@react-three/rapier'
import { surfaceColor, surfaceTexture } from './asciiShader'
import { GATE, OKMR, OKMR_BLEED, PIT, okmrLeftX, okmrRightX, visibleHalfHeight } from './config'
import { getWaterLevel, setWaterSurfaceY } from './waterLevel'

// the okmr body of water: a flat-shaded slab (#03b787) with a kinematic
// sea-floor collider at its base. both track the shared 0..1 level (waterLevel.js)
//   0 = surface parked just below the frame (nothing to stand on)
//   1 = rest pose (surface at OKMR.surfaceY, sea floor OKMR.depth below it)
// OkmrScene drives it to 1 (rise); exits/drain drives it to 0 (sink out the
// bottom — everything riding the sea floor goes with it).

const REST_MID = OKMR.surfaceY - OKMR.depth / 2
const FLOOR_CENTER = OKMR.surfaceY - OKMR.depth - OKMR.floorHalfH
// sit the slab behind the z=0 actor plane so letters / the AUV render in front
// of the water, not occluded by it (the ascii pass has no alpha blend). the
// gate's two posts straddle z=0 (gate.jsx — the AUV's z is locked there), so
// the slab's front face has to clear the far post too, not just z=0.
const GATE_FAR_Z = 1.55 * GATE.scale // far post centre + its own half-thickness
const SLAB_Z = -OKMR.slabZ / 2 - Math.max(0.5, GATE_FAR_Z + 0.5)

// pool-tile preview (slab material, below)
const TILE = 3 // world units per tile
const SATURATION = 1.6

export function Water() {
	const { world } = useRapier()
	const size = useThree((s) => s.size)
	const slab = useRef()
	const floor = useRef()
	const lvl = useRef(0)
	// travel from "surface one unit below the frame" up to the rest pose
	const rise = visibleHalfHeight() + 1 + OKMR.surfaceY

	// spans the whole level (okmrLeftX -> okmrRightX), bleeding past both ends
	// same as the old fixed-width slab did past the single-screen walls
	const left = okmrLeftX() - OKMR_BLEED
	const right = okmrRightX(size) + OKMR_BLEED
	const width = right - left
	const centerX = (left + right) / 2

	useFrame((_, dt) => {
		lvl.current +=
			(getWaterLevel() - lvl.current) * Math.min(1, dt * OKMR.riseSpeed)
		const dy = (lvl.current - 1) * rise
		if (slab.current) slab.current.position.y = REST_MID + dy
		floor.current?.setNextKinematicTranslation({
			x: centerX,
			y: FLOOR_CENTER + dy,
			z: 0,
		})

		// buoyancy: lift every dynamic body that's below the current surface so
		// letters / the AUV bob up and settle near it. spring - drag, mass-scaled
		// so it's size-independent. drains away with the surface on exit. applied
		// `buoyPoint` above the body origin so bodies float roughly upright.
		const surf = OKMR.surfaceY + dy
		setWaterSurfaceY(surf)
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
				position={[centerX, REST_MID - rise, SLAB_Z]}
				// preview: pool-tile texture in place of the flat colour — see if
				// it's a fit for the back water face before committing to it
				material={surfaceTexture(
					'/textures/pool-tiles.jpg',
					[width / TILE, OKMR.depth / TILE],
					SATURATION,
				)}
				dispose={null}
			>
				<boxGeometry args={[width, OKMR.depth, OKMR.slabZ]} />
			</mesh>
			<RigidBody
				ref={floor}
				type="kinematicPosition"
				colliders={false}
				position={[centerX, FLOOR_CENTER - rise, 0]}
				friction={0.8}
			>
				<CuboidCollider args={[width / 2, OKMR.floorHalfH, PIT.floor.halfD]} />
				<mesh material={surfaceColor(OKMR.floorColor)} dispose={null}>
					<boxGeometry
						args={[width, OKMR.floorHalfH * 2, PIT.floor.halfD * 2]}
					/>
				</mesh>
			</RigidBody>
		</>
	)
}
