import { useMemo } from 'react'
import * as THREE from 'three'
import { useLoader } from '@react-three/fiber'
import { SVGLoader } from 'three-stdlib'
import { surfaceColor, SURFACE_TWO_TONE } from '../asciiShader'
import { DEPTH } from '../config'
import SceneObject from '../SceneObject'
import { useStaged } from '../useStaged'

// loads + extrudes each descriptor's SVG, then wraps the shared <SceneObject>.
// the primitive owns the body / collider / hit target; this owns geometry and
// the `to` -> navigation mapping. see objects/README.md

const cache = new Map() // src|depth|shading -> { meshes, norm, center }

function build(paths, depth, twoTone) {
	const meshes = []
	const bbox = new THREE.Box3()
	let layer = 0 // later paths sit slightly in front so overlapping fills (e.g.
	              // white lettering on a coloured tile) don't z-fight
	for (const p of paths) {
		if (p.userData?.style?.fill === 'none') continue // skip decoy bg rects
		const mat = twoTone
			? SURFACE_TWO_TONE
			: surfaceColor('#' + p.color.getHexString())
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

function Logo({ d, navigate }) {
	const data = useLoader(SVGLoader, d.src)
	const depth = d.depth ?? DEPTH
	const released = useStaged(d.level ?? 1) // drop in after GRAEME (level 0) settles

	const { meshes, norm, center } = useMemo(() => {
		const key = `${d.src}|${depth}|${d.shading ?? 'flat'}`
		let v = cache.get(key)
		if (!v) {
			v = build(data.paths, depth, d.shading === 'two-tone')
			cache.set(key, v)
		}
		return v
	}, [data, d.src, depth, d.shading])

	const onClick =
		d.to == null
			? undefined
			: () => {
					if (typeof d.to === 'number') navigate(d.to)
					else if (/^https?:/.test(d.to)) window.open(d.to, '_blank', 'noopener')
					else navigate(d.to)
				}

	const s = d.scale ?? 1

	return (
		<SceneObject
			collider={d.collider}
			position={[d.spawn.x, d.spawn.y]}
			spin={d.spawn.spin ?? 0}
			ccd={d.ccd ?? false}
			grabbable
			onClick={onClick}
			frozen={!released}
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

export default function SceneObjects({ items, navigate }) {
	// all mounted up front (geometry + shaders warm during the initial spin-up);
	// each Logo stays frozen until its level releases it — see useStaged
	return items.map((d) => <Logo key={d.name} d={d} navigate={navigate} />)
}
