import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFont } from '@react-three/drei'
import { TextGeometry } from 'three-stdlib'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { SURFACE_SOLID, SURFACE_TWO_TONE } from './asciiShader'
import { BASE, FONT, HALF, LANDSCAPE, POOL, PORTRAIT, SHADING, TIERS, WORD } from './config'
import { grab, hoverCursor } from './drag'

// ---- geometry cache ---------------------------------------------------
// one TextGeometry per (char, factor); shared across letters and reused
// across StrictMode / remounts.
const geomCache = new Map()

function letterGeometry(font, char, factor) {
	const key = `${char}|${factor}`
	let g = geomCache.get(key)
	if (!g) {
		const hi = factor >= 1
		g = new TextGeometry(char, {
			font,
			size: BASE * factor,
			height: 0.6 * BASE * factor,
			bevelEnabled: true,
			bevelSize: 0.18 * BASE * factor,
			bevelThickness: 0.18 * BASE * factor,
			bevelSegments: hi ? 6 : 3,
			curveSegments: hi ? 8 : 5,
		})
		g.center()
		geomCache.set(key, g)
	}
	return g
}

const HITBOX = new THREE.BoxGeometry(1, 1, 1)
const HIT_MAT = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
const MATERIAL = { [SHADING.TWO_TONE]: SURFACE_TWO_TONE, [SHADING.SOLID]: SURFACE_SOLID }

// ---- letter ----------------------------------------------------------
function Letter({ font, char, factor, shading, position, spin, ccd, grabbable }) {
	const body = useRef()
	const geometry = useMemo(
		() => letterGeometry(font, char, factor),
		[font, char, factor],
	)
	const half = useMemo(() => HALF.map((h) => h * factor), [factor])

	return (
		<RigidBody
			ref={body}
			position={[position[0], position[1], 0]}
			rotation={[0, 0, spin]}
			colliders={false}
			ccd={ccd}
			enabledTranslations={[true, true, false]}
			enabledRotations={[false, false, true]}
			restitution={0.15}
			friction={0.8}
			linearDamping={0.3}
			angularDamping={0.6}
		>
			<CuboidCollider args={half} />
			{/* invisible box hit-box. pointer handlers only on grabbable tiers.
			    dispose={null}: geometry + material are shared, don't free on unmount */}
			<mesh
				geometry={HITBOX}
				material={HIT_MAT}
				scale={[half[0] * 2, half[1] * 2, half[2] * 2]}
				dispose={null}
				onPointerDown={grabbable ? (e) => grab(e, body.current) : undefined}
				{...(grabbable ? hoverCursor : null)}
			/>
			<mesh geometry={geometry} material={MATERIAL[shading]} dispose={null} />
		</RigidBody>
	)
}

// ---- scene content -------------------------------------------------
function confetti(spawnHalfWidth) {
	return TIERS.flatMap(({ factor, count, shading, ccd, grabbable }) =>
		Array.from({ length: count }, () => ({
			char: POOL[(Math.random() * POOL.length) | 0],
			factor,
			shading,
			ccd,
			grabbable,
			position: [
				(Math.random() * 2 - 1) * spawnHalfWidth,
				5 + Math.random() * 9,
			],
			spin: (Math.random() - 0.5) * Math.PI,
		})),
	)
}

const bigLetter = (char, position) => ({
	char,
	factor: 1,
	shading: SHADING.TWO_TONE,
	ccd: true,
	grabbable: true,
	position,
	spin: 0,
})

// landscape: GRAEME inline. portrait: 'GRA' row spawned above 'EME' row so the
// word drops in stacked and still fits a narrow window.
function graeme(portrait) {
	if (!portrait) {
		return WORD.map((char, i) =>
			bigLetter(char, [-6.5 + i * LANDSCAPE.spacing, LANDSCAPE.y]),
		)
	}
	const { split, spacing, rows } = PORTRAIT
	return [WORD.slice(0, split), WORD.slice(split)].flatMap((row, r) =>
		row.map((char, j) =>
			bigLetter(char, [(j - (row.length - 1) / 2) * spacing, rows[r]]),
		),
	)
}

const CONFETTI = false // spike toggle — off while dialing in the GRAEME layout

function buildLetters(portrait) {
	const cfg = portrait ? PORTRAIT : LANDSCAPE
	return [
		...graeme(portrait),
		...(CONFETTI ? confetti(cfg.spawnHalfWidth) : []),
	]
}

export function Letters({ portrait = false }) {
	const font = useFont(FONT)
	const letters = useMemo(() => buildLetters(portrait), [portrait])
	return letters.map((item, i) => <Letter key={i} font={font} {...item} />)
}
