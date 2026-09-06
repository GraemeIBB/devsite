import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useFont } from '@react-three/drei'
import { RigidBody, useRopeJoint } from '@react-three/rapier'
import { surfaceFade } from './asciiShader'
import { FONT, HALF, OKMR, playHalfWidth } from './config'
import { glyphGeometry } from './glyphGeometry'
import SceneObject from './SceneObject'
import { useStaged } from './useStaged'

// BoundLetter — a letter moored to a fixed anchor on the sea floor by a chain
// (rope joint) tied to the letter's BOTTOM edge. buoyancy (water.jsx) floats the
// letter up; the chain goes taut and pulls its base back down, so it rides the
// water standing upright like a marker buoy. drag it and the chain reins it in.
// okmr scene only — Letters is the plain version.

const seg = new THREE.Vector3()
const base = new THREE.Vector3()
const quat = new THREE.Quaternion()
const LINKS = 9 // chain links drawn along a parabolic sag
const LINK_R = 0.09
const SPAWN_DROP = 1 // spawn the letter this far below its anchor

function BoundLetter({ font, char, factor, x, anchorY, chainLen, frozen }) {
	const letter = useRef()
	const anchor = useRef()
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

	// tie the chain to the letter's underside, not its centre
	useRopeJoint(letter, anchor, [[0, -half, 0], [0, 0, 0], chainLen])

	useFrame((state) => {
		const now = state.clock.elapsedTime
		if (!frozen && !born.current) born.current = now
		if (born.current && glyph.current) {
			glyph.current.material.uniforms.uFade.value = Math.min(
				1,
				(now - born.current) / (OKMR.fadeMs / 1000),
			)
		}

		const a = anchor.current?.translation()
		const l = letter.current?.translation()
		const r = letter.current?.rotation()
		if (!a || !l || !r) return
		// world-space bottom edge of the letter
		base.set(0, -half, 0).applyQuaternion(quat.set(r.x, r.y, r.z, r.w))
		base.set(l.x + base.x, l.y + base.y, l.z + base.z)

		seg.set(base.x - a.x, base.y - a.y, base.z - a.z)
		const sag = Math.max(0, chainLen - seg.length()) * 0.6 // belly when slack
		for (let i = 0; i < LINKS; i++) {
			const m = links.current[i]
			if (!m) continue
			const t = i / (LINKS - 1)
			// floor: the sag belly can otherwise dip a link below the sea floor —
			// the anchor's own y (it sits on the floor) is the clamp
			const y = Math.max(a.y + seg.y * t - sag * 4 * t * (1 - t), a.y)
			m.position.set(a.x + seg.x * t, y, a.z + seg.z * t)
		}
	})

	return (
		<>
			{/* invisible mooring point on the sea floor */}
			<RigidBody
				ref={anchor}
				type="fixed"
				colliders={false}
				position={[x, anchorY, 0]}
			/>

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
