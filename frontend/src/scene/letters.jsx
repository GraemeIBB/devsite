import { useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { useFont } from '@react-three/drei'
import { SURFACE_SOLID, SURFACE_TWO_TONE } from './asciiShader'
import {
	FONT,
	HALF,
	LANDSCAPE,
	playHalfWidth,
	POOL,
	PORTRAIT,
	SHADING,
	TIERS,
} from './config'
import { glyphGeometry } from './glyphGeometry'
import SceneObject from './SceneObject'

const MATERIAL = { [SHADING.TWO_TONE]: SURFACE_TWO_TONE, [SHADING.SOLID]: SURFACE_SOLID }

// physics locks every letter to z=0, so piled/overlapping letters render
// coplanar and z-fight (mottled two-tone patches). nudge each letter's *visual*
// mesh to its own z by index — collider stays on the plane, faces separate.
const Z_STEP = 0.03

// ---- letter ----------------------------------------------------------
// a letter is a SceneObject with a cached TextGeometry for its visual mesh.
function Letter({ font, char, factor, shading, position, spin, ccd, grabbable, index, launch }) {
	const geometry = useMemo(
		() => glyphGeometry(font, char, factor),
		[font, char, factor],
	)
	const collider = useMemo(
		() => ({ shape: 'cuboid', half: HALF.map((h) => h * factor) }),
		[factor],
	)

	return (
		<SceneObject
			collider={collider}
			position={position}
			spin={spin}
			ccd={ccd}
			grabbable={grabbable}
			launch={launch}
		>
			{/* dispose={null}: geometry + material are shared, don't free on unmount */}
			<mesh
				geometry={geometry}
				material={MATERIAL[shading]}
				position={[0, 0, index * Z_STEP]}
				dispose={null}
			/>
		</SceneObject>
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

const bigLetter = (char, factor, position) => ({
	char,
	factor,
	shading: SHADING.TWO_TONE,
	ccd: true,
	grabbable: true,
	position,
	spin: 0,
})

// gap between letters: explicit `spacing` (world units) wins; else the natural
// factor-scaled gap clamped so a row of `n` stays within fitWidth. the collider
// is HALF[0]*factor wide, so a gap below 2*that will let rapier nudge them.
const rowGap = (cfg, n, factor, spacing) =>
	spacing ?? Math.min(cfg.spacing * factor, cfg.fitWidth / n)

// landscape: the word inline. portrait: split into stacked rows so it fits a
// narrow window (`rows` overrides the row count — 1 for a single line).
// align: 'center' (+ `bias`, capped so nothing spawns inside a wall) | 'left' |
// 'right' — the latter two pack the row against that wall.
// `inner` = |x| of a wall's inner face (playHalfWidth).
function layout(word, portrait, factor, opts, inner) {
	const { bias = 0, align = 'center', spacing, rows: rowCount } = opts
	const chars = [...word]
	const n = rowCount ?? (portrait ? 2 : 1)
	const per = Math.ceil(chars.length / n)
	const rows = Array.from({ length: n }, (_, r) =>
		chars.slice(r * per, (r + 1) * per),
	).filter((r) => r.length)
	const ys = portrait ? PORTRAIT.rows : [LANDSCAPE.y]
	const cfg = portrait ? PORTRAIT : LANDSCAPE

	const widest = Math.max(...rows.map((r) => r.length))
	const gap = rowGap(cfg, widest, factor, spacing)
	const half = HALF[0] * factor
	const edge = half + 0.05 // end letter sits just off the wall

	return rows.flatMap((row, r) => {
		const mid = (row.length - 1) / 2
		let shift
		if (align === 'left') shift = -inner + edge + mid * gap
		else if (align === 'right') shift = inner - edge - mid * gap
		else {
			const room = Math.max(0, inner - (mid * gap + half))
			shift = Math.max(-room, Math.min(room, bias))
		}
		return row.map((char, j) =>
			bigLetter(char, factor, [
				shift + (j - mid) * gap,
				ys[r] ?? ys[ys.length - 1],
			]),
		)
	})
}

const CONFETTI = false // toggle — off while dialing in the letter layout

function buildLetters(word, portrait, factor, opts, inner) {
	const cfg = portrait ? PORTRAIT : LANDSCAPE
	return [
		...layout(word, portrait, factor, opts, inner),
		...(CONFETTI ? confetti(cfg.spawnHalfWidth) : []),
	]
}

export function Letters({
	word = 'GRAEME',
	portrait = false,
	scale = 1,
	bias = 0,
	align = 'center', // 'center' (+bias) | 'left' | 'right'
	spacing, // explicit world-unit gap, overrides the auto spacing
	rows, // row count — overrides the portrait 2 / landscape 1 default (1 = single line)
	launch, // 'down' | 'left' | 'right' | [x,y,z] — applied to every letter at spawn
}) {
	const font = useFont(FONT)
	const size = useThree((s) => s.size)
	const inner = playHalfWidth(size, portrait)
	const letters = useMemo(
		() =>
			buildLetters(word, portrait, scale, { bias, align, spacing, rows }, inner),
		[word, portrait, scale, bias, align, spacing, rows, inner],
	)
	return letters.map((item, i) => (
		<Letter key={i} index={i} font={font} launch={launch} {...item} />
	))
}
