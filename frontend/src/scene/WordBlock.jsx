import { useMemo } from 'react'
import * as THREE from 'three'
import { useFont } from '@react-three/drei'
import { SURFACE_TWO_TONE } from './asciiShader'
import { BASE, DEPTH, FONT, HALF } from './config'
import { glyphGeometry } from './glyphGeometry'
import SceneObject from './SceneObject'

// a word rendered as glyphs but LOCKED into one rigid body — it tumbles and
// collides as a single big character. same plane-locked physics as a Letter;
// one cuboid collider spanning the whole word.
//
// `factor` scales the glyphs (shared glyph cache with letters). `spacing` is the
// glyph gap in world units — defaults tight so it reads as one word.
//
// `inverted`: instead of solid glyphs, a rounded slab with the phrase punched
// straight through it — you read the word as the empty cells in a field of
// glyphs. counters (the hole in an O / A / R) come back as solid islands so the
// shapes stay legible. font kerning is used, so `spacing` is ignored.

const GAP_FRAC = 0.8 // gap as a fraction of glyph size (BASE * factor)

// ---- inverted: one slab, phrase cut out ------------------------------
const PAD = [0.55, 0.4] // slab margin around the text on each axis, × factor
const RADIUS = 0.22 // slab outer corner radius, × factor
const COUNTER_INSET = 0.97 // shrink counter islands toward their centre so their
                           // walls don't sit exactly on the cutout walls (z-fight)

const invCache = new Map() // `word|factor` -> { slab, islands, half }

function roundedRect(hw, hh, r) {
	r = Math.max(0, Math.min(r, hw - 0.01, hh - 0.01))
	const s = new THREE.Shape()
	s.moveTo(-hw + r, -hh)
	s.lineTo(hw - r, -hh)
	s.quadraticCurveTo(hw, -hh, hw, -hh + r)
	s.lineTo(hw, hh - r)
	s.quadraticCurveTo(hw, hh, hw - r, hh)
	s.lineTo(-hw + r, hh)
	s.quadraticCurveTo(-hw, hh, -hw, hh - r)
	s.lineTo(-hw, -hh + r)
	s.quadraticCurveTo(-hw, -hh, -hw + r, -hh)
	return s
}

const shiftPts = (src, dx, dy) =>
	src.getPoints(16).map((p) => new THREE.Vector2(p.x + dx, p.y + dy))

function insetToward(pts, k) {
	const c = pts
		.reduce((a, p) => a.add(p), new THREE.Vector2())
		.divideScalar(pts.length || 1)
	return pts.map((p) => c.clone().lerp(p, k))
}

function buildInverted(font, word, factor) {
	const key = `${word}|${factor}`
	const hit = invCache.get(key)
	if (hit) return hit

	const size = BASE * factor
	const glyphs = font.generateShapes(word, size)

	const box = new THREE.Box2()
	for (const g of glyphs) for (const p of g.getPoints(16)) box.expandByPoint(p)
	const c = box.getCenter(new THREE.Vector2())
	const sz = box.getSize(new THREE.Vector2())

	const hw = sz.x / 2 + PAD[0] * factor
	const hh = sz.y / 2 + PAD[1] * factor

	const slab = roundedRect(hw, hh, RADIUS * factor)
	const islandShapes = []
	for (const g of glyphs) {
		slab.holes.push(new THREE.Path(shiftPts(g, -c.x, -c.y))) // glyph outline -> cutout
		for (const h of g.holes) {
			islandShapes.push(
				new THREE.Shape(insetToward(shiftPts(h, -c.x, -c.y), COUNTER_INSET)),
			)
		}
	}

	const opts = { depth: DEPTH, bevelEnabled: false, curveSegments: 6 }
	const slabGeo = new THREE.ExtrudeGeometry(slab, opts)
	slabGeo.translate(0, 0, -DEPTH / 2) // straddle z=0, like every scene object
	let islands = null
	if (islandShapes.length) {
		islands = new THREE.ExtrudeGeometry(islandShapes, opts)
		islands.translate(0, 0, -DEPTH / 2)
	}

	const v = { slabGeo, islands, half: [hw, hh, DEPTH / 2] }
	invCache.set(key, v)
	return v
}

export default function WordBlock({
	word,
	factor = 1,
	spacing,
	inverted = false,
	position,
	spin = 0,
	frozen = false,
	grabbable = true,
	onClick,
	launch,
}) {
	const font = useFont(FONT)
	const chars = [...word]
	const gap = spacing ?? GAP_FRAC * BASE * factor

	const inv = useMemo(
		() => (inverted ? buildInverted(font, word, factor) : null),
		[font, word, factor, inverted],
	)

	const glyphs = useMemo(() => {
		if (inverted) return []
		const mid = (chars.length - 1) / 2
		return chars.map((c, i) => ({
			geometry: glyphGeometry(font, c, factor),
			x: (i - mid) * gap,
		}))
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [font, word, factor, gap, inverted])

	const collider = inv
		? { shape: 'cuboid', half: inv.half }
		: {
				shape: 'cuboid',
				half: [(chars.length * gap) / 2, HALF[1] * factor, DEPTH / 2],
			}

	return (
		<SceneObject
			collider={collider}
			position={position}
			spin={spin}
			frozen={frozen}
			grabbable={grabbable}
			onClick={onClick}
			launch={launch}
			ccd
		>
			{inv ? (
				<>
					<mesh geometry={inv.slabGeo} material={SURFACE_TWO_TONE} dispose={null} />
					{inv.islands && (
						<mesh
							geometry={inv.islands}
							material={SURFACE_TWO_TONE}
							position={[0, 0, 0.015]} // hair forward: counter walls clear the cutout walls
							dispose={null}
						/>
					)}
				</>
			) : (
				glyphs.map((g, i) => (
					<mesh
						key={i}
						geometry={g.geometry}
						material={SURFACE_TWO_TONE}
						position={[g.x, 0, i * 0.02]} // tiny z step: adjacent glyphs don't z-fight
						dispose={null}
					/>
				))
			)}
		</SceneObject>
	)
}
