import { useMemo } from 'react'
import * as THREE from 'three'
import { useLoader } from '@react-three/fiber'
import { SVGLoader } from 'three-stdlib'
import { surfaceColor, SURFACE_TWO_TONE } from '../asciiShader'
import { DEPTH } from '../config'
import SceneObject from '../SceneObject'
import Box from '../Box'
import WordBlock from '../WordBlock'
import { useStaged } from '../useStaged'

// renders object descriptors (objects/<name>.js). dispatches on `kind`:
//   'svg' (default) — extrude the descriptor's SVG, wrap <SceneObject>
//   'box'           — a coloured sizable slab (the <Box> primitive)
//   'word'          — a word locked into one rigid body (the <WordBlock> primitive)
// the primitives own body / collider / hit target + the drei <Html> anchor;
// this owns geometry + the `to` -> navigation mapping. see objects/README.md

const navTo = (to, navigate) =>
	to == null
		? undefined
		: () => {
				if (typeof to === 'number') navigate(to)
				else if (/^https?:/.test(to)) window.open(to, '_blank', 'noopener')
				else navigate(to)
			}

// ---- svg objects --------------------------------------------------------
const cache = new Map() // src|depth|shading -> { meshes, norm, center }

function build(paths, depth, twoTone, edge) {
	const meshes = []
	const bbox = new THREE.Box3()
	// `edge`: extrude side walls (ExtrudeGeometry group 1) render this hex
	// (still cap/side-shaded by surfaceColor) instead of their own path's fill —
	// so the object's depth reads as one colour, not e.g. shaded white.
	const sideMat = edge ? surfaceColor(edge) : null
	let layer = 0 // later paths sit slightly in front so overlapping fills (e.g.
	              // white lettering on a coloured tile) don't z-fight
	for (const p of paths) {
		if (p.userData?.style?.fill === 'none') continue // skip decoy bg rects
		const cap = twoTone
			? SURFACE_TWO_TONE
			: surfaceColor('#' + p.color.getHexString())
		const mat = sideMat ? [cap, sideMat] : cap // [caps, walls]
		const z = -depth / 2 + layer++ * depth * 0.05
		for (const shape of SVGLoader.createShapes(p)) {
			const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
			g.translate(0, 0, z) // straddle z=0, like the letters
			g.computeBoundingBox()
			bbox.union(g.boundingBox)
			meshes.push({ material: mat, geometry: g })
		}
	}
	const size = new THREE.Vector3()
	const center = new THREE.Vector3()
	bbox.getSize(size)
	bbox.getCenter(center)
	if (import.meta.env.DEV) console.log('[objects] extrude bbox', size)
	return { meshes, norm: 1 / size.y, center }
}

function SvgObject({ d, navigate }) {
	const data = useLoader(SVGLoader, d.src)
	const depth = d.depth ?? DEPTH
	const released = useStaged(d.level ?? 1) // drop in after GRAEME (level 0) settles

	const { meshes, norm, center } = useMemo(() => {
		const key = `${d.src}|${depth}|${d.shading ?? 'flat'}|${d.edge ?? ''}`
		let v = cache.get(key)
		if (!v) {
			v = build(data.paths, depth, d.shading === 'two-tone', d.edge)
			cache.set(key, v)
		}
		return v
	}, [data, d.src, depth, d.shading, d.edge])

	const s = d.scale ?? 1

	return (
		<SceneObject
			collider={d.collider}
			position={[d.spawn.x, d.spawn.y]}
			spin={d.spawn.spin ?? 0}
			ccd={d.ccd ?? false}
			grabbable
			onClick={navTo(d.to, navigate)}
			frozen={!released}
			launch={d.launch}
		>
			{/* x/y: normalise artwork to ~1u then apply scale. y flipped (svg is y-down).
			    z: depth already centred in build(), never scaled. */}
			<group scale={[s, s, 1]}>
				<group
					scale={[norm, -norm, 1]}
					position={[-center.x * norm, center.y * norm, 0]}
				>
					{meshes.map((m, i) => (
						<mesh key={i} geometry={m.geometry} material={m.material} dispose={null} />
					))}
				</group>
			</group>
		</SceneObject>
	)
}

// ---- box objects ------------------------------------------------------
function BoxObject({ d, navigate }) {
	const released = useStaged(d.level ?? 1)
	return (
		<Box
			size={d.size}
			color={d.color}
			position={[d.spawn.x, d.spawn.y]}
			spin={d.spawn.spin ?? 0}
			frozen={!released}
			grabbable={d.grabbable ?? true}
			onClick={navTo(d.to, navigate)}
			launch={d.launch}
		>
			{d.html}
		</Box>
	)
}

// ---- word objects ---------------------------------------------------
function WordObject({ d, navigate }) {
	const released = useStaged(d.level ?? 1)
	return (
		<WordBlock
			word={d.word}
			factor={d.factor ?? 1}
			spacing={d.spacing}
			inverted={d.inverted ?? false}
			position={[d.spawn.x, d.spawn.y]}
			spin={d.spawn.spin ?? 0}
			frozen={!released}
			grabbable={d.grabbable ?? true}
			onClick={navTo(d.to, navigate)}
			launch={d.launch}
		/>
	)
}

const KIND = { box: BoxObject, word: WordObject }

export default function SceneObjects({ items, navigate }) {
	// all mounted up front (geometry + shaders warm during the initial spin-up);
	// each stays frozen until its level releases it — see useStaged
	return items.map((d) => {
		const Obj = KIND[d.kind] ?? SvgObject
		return <Obj key={d.name} d={d} navigate={navigate} />
	})
}
