import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import { surfaceColor } from './asciiShader'
import { DEPTH } from './config'
import SceneObject from './SceneObject'
import { slabGeometry } from './slabGeometry'

// a colourable, sizable rectangular slab — same plane-locked physics as every
// other SceneObject, cuboid collider matched to the mesh.
//
// the mesh is an extruded rounded rect with a chamfered front edge (not a plain
// box): viewed dead-on a box shows only its flat face, but the chamfer's angled
// facets let surfaceColor's cap/side shading read as depth, like the letters.
// rounded outer corners soften the silhouette. `size` is [w, h] world units;
// total depth is the shared DEPTH. geometry itself lives in slabGeometry.js so
// other primitives (e.g. Callout) can share it.
//
// `children` render in a drei <Html transform> anchored to the slab front face —
// real DOM (untouched by the ascii pass) but 3D-transformed, so it tracks the
// slab's position AND rotation as physics tumbles it. shown only once live.
// `distanceFactor` scales the content; bump it for larger text.

export default function Box({
	size,
	inset = 0, // shrink the visual slab inside its collider — packed slabs then
	           // show `inset` of space between them while physics stays tight
	radius = 0.3, // outer corner radius of the visual slab
	color = '#efeee6', // off-white
	position,
	spin = 0,
	frozen = false,
	grabbable = true,
	onClick,
	launch,
	children,
}) {
	const [w, h] = size
	const geometry = useMemo(
		() => slabGeometry(w - inset, h - inset, radius),
		[w, h, inset, radius],
	)

	return (
		<SceneObject
			collider={{ shape: 'cuboid', half: [w / 2, h / 2, DEPTH / 2] }}
			position={position}
			spin={spin}
			frozen={frozen}
			grabbable={grabbable}
			onClick={onClick}
			launch={launch}
			ccd
		>
			<mesh geometry={geometry} material={surfaceColor(color)} dispose={null} />
			{children && !frozen && (
				// transform: follows the slab's rotation too. wrapper ignores
				// pointers so the slab stays draggable; content opts back in
				// with pointerEvents:'auto'.
				<Html
					transform
					center
					position={[0, 0, DEPTH / 2]} // anchor on the front face, not the
					// slab mid-plane — else an off-axis slab shows the text parallax-
					// shifted toward screen centre
					distanceFactor={10}
					zIndexRange={[50, 0]}
					style={{ pointerEvents: 'none', opacity: 'var(--scene-fade, 1)' }}
				>
					{children}
				</Html>
			)}
		</SceneObject>
	)
}
