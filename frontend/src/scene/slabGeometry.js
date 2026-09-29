import * as THREE from 'three'
import { DEPTH } from './config'

// chamfered rounded-rect slab geometry shared by every ascii-pass slab (<Box>,
// <Callout>'s label). a plain box only shows its flat face dead-on; the
// chamfer's angled facets let surfaceColor's cap/side shading read as depth,
// like the letters. rounded outer corners soften the silhouette. `w`/`h` are
// world units; total depth is the shared DEPTH.
const BEVEL = 0.12
const geomCache = new Map()

export function slabGeometry(w, h, radius) {
	const key = `${w}|${h}|${radius}`
	let g = geomCache.get(key)
	if (!g) {
		const iw = Math.max(0.02, w / 2 - BEVEL)
		const ih = Math.max(0.02, h / 2 - BEVEL)
		const r = Math.max(0, Math.min(radius, iw - 0.01, ih - 0.01))
		const s = new THREE.Shape()
		// rounded rect centred on origin, half-extents iw/ih, corner r
		s.moveTo(-iw + r, -ih)
		s.lineTo(iw - r, -ih)
		s.quadraticCurveTo(iw, -ih, iw, -ih + r)
		s.lineTo(iw, ih - r)
		s.quadraticCurveTo(iw, ih, iw - r, ih)
		s.lineTo(-iw + r, ih)
		s.quadraticCurveTo(-iw, ih, -iw, ih - r)
		s.lineTo(-iw, -ih + r)
		s.quadraticCurveTo(-iw, -ih, -iw + r, -ih)
		g = new THREE.ExtrudeGeometry(s, {
			depth: DEPTH - 2 * BEVEL,
			bevelEnabled: true,
			bevelSize: BEVEL,
			bevelThickness: BEVEL,
			bevelSegments: 2,
			curveSegments: 6,
		})
		g.center()
		geomCache.set(key, g)
	}
	return g
}
