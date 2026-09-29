import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useFont } from '@react-three/drei'
import { surfaceFade } from './asciiShader'
import { FONT, HALF, OKMR, playHalfWidth } from './config'
import { glyphGeometry } from './glyphGeometry'
import SceneObject from './SceneObject'
import { useStaged } from './useStaged'
import { getWaterSurfaceY } from './waterLevel'
import { isFocused } from './focus'

// BoundLetter — a letter moored to a point on the sea floor by a chain, tied
// to the letter's BOTTOM edge. buoyancy (water.jsx) floats the letter up; past
// `chainLen` the chain goes taut and pulls it back down, so it rides the water
// standing upright like a marker buoy. drag it and the chain reins it in.
// okmr scene only — Letters is the plain version.
//
// the chain is a hand-rolled hard distance clamp (position + outward-velocity
// correction, applied directly at the letter's bottom edge), NOT a rapier
// rope joint. an earlier version used a real useRopeJoint between the letter
// and a separate anchor RigidBody. two problems came from that: (1) a joint
// to a truly FIXED anchor holds the letter near the rest floor height
// forever, so it never sinks away during the drain exit (exits/drain.jsx);
// (2) far worse, EVERY exit fully unmounts OkmrScene on completion (not just
// the drain — this is how every page transition works), and rapier auto-
// removes a body's joints when either connected body is removed. if react-
// three-rapier's OWN joint-cleanup effect then runs afterward on that
// already-gone joint (an ordering react-three-rapier doesn't fully guard
// against across sibling components — its own `getImpulseJoint` liveness
// check doesn't save it, likely a stale/recycled handle), you get a wasm-
// bindgen use-after-free — "recursive use of an object... unsafe aliasing"
// — that kills the whole WebGL context. reproduced by leaving /okmr and
// re-entering once the landing page settled. DO NOT bring useRopeJoint back
// for this — it's not a tuning problem, it's a real crash.
//
// a first pass at a JS-side replacement used a spring (stiffness/damping/
// max-impulse, same shape as drag.js's cursor spring) instead of a hard
// clamp. that's a force sharing the same integrator as gravity/buoyancy, so
// unlike a solver-native joint it COULD overshoot chainLen and ring — and
// underdamped as first tuned, it did, visibly. clamping position directly
// (and killing the outward velocity component, like a taut rope snapping a
// falling weight to a stop) can't overshoot by construction — nothing to
// tune, no oscillation to chase. bonus: the anchor is now just a formula
// (anchorLiveY), not a RigidBody, so it naturally tracks the live water
// surface instead of a stale fixed position — letters sink away with the
// floor during the drain instead of being held near its rest height.

const seg = new THREE.Vector3()
const base = new THREE.Vector3()
const top = new THREE.Vector3()
const quat = new THREE.Quaternion()
const LINKS = 9 // chain links drawn along a parabolic sag
const LINK_R = 0.09
const SPAWN_DROP = 1 // spawn the letter this far below its anchor point

// live anchor height: the rest sea-floor top, offset by however far the water
// surface currently sits from ITS rest height — 0 at rest (identical to the
// old fixed anchor), tracking the surface down during the drain exit so the
// chain pulls the letter down with it instead of holding it at a stale
// position. guards getWaterSurfaceY()'s pre-first-<Water>-frame -Infinity
// default (else the anchor — and the letter it pulls toward itself — would
// teleport for a frame).
function anchorLiveY(restY) {
	const surf = getWaterSurfaceY()
	return Number.isFinite(surf) ? restY + (surf - OKMR.surfaceY) : restY
}

function BoundLetter({ font, char, factor, x, anchorY, chainLen, frozen }) {
	const letter = useRef()
	const glyph = useRef()
	const links = useRef([])
	const born = useRef(0) // clock time the letter was unfrozen (0 = still frozen)
	const [mat] = useState(() => surfaceFade()) // per-letter: owns its uFade uniform
	const geometry = useMemo(
		() => glyphGeometry(font, char, factor),
		[font, char, factor],
	)
	useEffect(() => () => mat.dispose(), [mat])
	const half = HALF[1] * factor // origin -> bottom edge

	useFrame((state, delta) => {
		const now = state.clock.elapsedTime
		if (!frozen && !born.current) born.current = now
		if (born.current && glyph.current) {
			glyph.current.material.uniforms.uFade.value = Math.min(
				1,
				(now - born.current) / (OKMR.fadeMs / 1000),
			)
		}

		// tab backgrounded: <Physics paused> already stops rapier stepping —
		// skip the chain impulse too, else this still shoves a multi-second
		// dt's worth of correction into the letter's velocity (dist/vel read
		// live off the frozen body, undamped by any dt scaling), landing in
		// one shot the moment stepping resumes. see focus.js.
		if (!isFocused()) return

		const rb = letter.current
		const l = rb?.translation()
		const r = rb?.rotation()
		if (!l || !r) return
		const ay = anchorLiveY(anchorY)

		// world-space bottom edge of the letter
		base.set(0, -half, 0).applyQuaternion(quat.set(r.x, r.y, r.z, r.w))
		base.set(l.x + base.x, l.y + base.y, l.z + base.z)

		seg.set(base.x - x, base.y - ay, base.z)
		const dist = seg.length()

		// past chainLen: clamp the bottom edge back onto the chain radius and
		// drop the outward component of velocity — a hard, un-overshootable
		// stop instead of a force to tune. re-derives the anchor direction fresh
		// every frame off the live (possibly moving) anchor, so a sinking anchor
		// during the drain exit just drags the letter down with it frame by
		// frame, same as a real taut rope would. gated to dynamic bodies only
		// (frozen letters have no meaningful linvel yet)
		if (dist > chainLen && rb.isDynamic()) {
			const dirX = seg.x / dist
			const dirY = seg.y / dist
			const excess = dist - chainLen

			rb.setTranslation(
				{ x: l.x - excess * dirX, y: l.y - excess * dirY, z: l.z },
				true,
			)

			const lv = rb.linvel()
			const vOut = lv.x * dirX + lv.y * dirY
			if (vOut > 0) {
				rb.setLinvel({ x: lv.x - vOut * dirX, y: lv.y - vOut * dirY, z: 0 }, true)
			}
		}

		// extra lift right at the top edge, on top of water.jsx's generic
		// per-body buoyancy (which applies at a single point below centre,
		// buoyPoint) — makes the letters float up more eagerly instead of
		// just riding low against the chain.
		if (rb.isDynamic()) {
			const surf = getWaterSurfaceY()
			top.set(0, half, 0).applyQuaternion(quat)
			top.set(l.x + top.x, l.y + top.y, l.z + top.z)
			const topSub = surf - top.y
			if (topSub > 0) {
				const lift = OKMR.buoyTopLift * Math.min(topSub, OKMR.buoyMax)
				const m = rb.mass() || 1
				rb.applyImpulseAtPoint(
					{ x: 0, y: lift * m * delta, z: 0 },
					{ x: top.x, y: top.y, z: top.z },
					true,
				)
			}
		}

		// chain-link visual, sagging along the segment from anchor to bottom edge
		const sag = Math.max(0, chainLen - dist) * 0.6 // belly when slack
		for (let i = 0; i < LINKS; i++) {
			const m = links.current[i]
			if (!m) continue
			const t = i / (LINKS - 1)
			// floor: the sag belly can otherwise dip a link below the sea floor —
			// the anchor's own y is the clamp
			const y = Math.max(ay + seg.y * t - sag * 4 * t * (1 - t), ay)
			m.position.set(x + seg.x * t, y, seg.z * t)
		}
	})

	return (
		<>
			{/* chain links share the letter's fade material -> dissolve in together */}
			{Array.from({ length: LINKS }, (_, i) => (
				<mesh
					key={i}
					ref={(el) => (links.current[i] = el)}
					material={mat}
					dispose={null}
				>
					<sphereGeometry args={[LINK_R, 6, 5]} />
				</mesh>
			))}

			<SceneObject
				ref={letter}
				collider={{ shape: 'cuboid', half: HALF.map((h) => h * factor) }}
				position={[x, anchorY - SPAWN_DROP]}
				frozen={frozen}
				grabbable
				ccd
			>
				<mesh ref={glyph} geometry={geometry} material={mat} dispose={null} />
			</SceneObject>
		</>
	)
}

export function BoundLetters({ word = 'OKMR', portrait = false, level = 2 }) {
	const font = useFont(FONT)
	const size = useThree((s) => s.size)
	const released = useStaged(level)
	const chars = [...word]
	const n = chars.length

	const factor = portrait ? 0.6 : 1
	const inner = playHalfWidth(size, portrait)
	const bias = portrait ? 0 : OKMR.letterBiasX // keep the word centred on narrow/portrait screens
	const gap = Math.min(portrait ? 1.9 : 2.8, (2 * (inner - 0.8 - bias)) / n)
	const anchorY = OKMR.surfaceY - OKMR.depth // sea-floor top

	return chars.map((char, i) => (
		<BoundLetter
			key={i}
			font={font}
			char={char}
			factor={factor}
			x={(i - (n - 1) / 2) * gap + bias}
			anchorY={anchorY}
			chainLen={OKMR.chain}
			frozen={!released}
		/>
	))
}
