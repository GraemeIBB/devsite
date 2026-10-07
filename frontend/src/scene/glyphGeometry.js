import { TextGeometry } from 'three-stdlib'
import { BASE } from './config'

// one TextGeometry per (char, factor); shared across letters and word blocks,
// reused across StrictMode / remounts.
const cache = new Map()

// two build profiles. BIG keeps the rounded bevel — reads fine at GRAEME size.
// SMALL drops it: below full size the bevel is only ~1 glyph cell wide, so its
// normal gradient sparkles across the ascii two-tone cutoff. a flat cap + square
// sides give a clean 1-cell ink/inkDark edge instead.
const BIG_MIN = 1
const PROFILE = {
	big: { bevel: true, curveSegments: 8 },
	small: { bevel: false, curveSegments: 10 },
}

export function glyphGeometry(font, char, factor) {
	const key = `${char}|${factor}`
	let g = cache.get(key)
	if (!g) {
		const p = factor >= BIG_MIN ? PROFILE.big : PROFILE.small
		const s = BASE * factor
		g = new TextGeometry(char, {
			font,
			size: s,
			height: 0.6 * s,
			curveSegments: p.curveSegments,
			bevelEnabled: p.bevel,
			bevelSize: 0.18 * s,
			bevelThickness: 0.18 * s,
			bevelSegments: 6,
		})
		g.center()
		cache.set(key, g)
	}
	return g
}
