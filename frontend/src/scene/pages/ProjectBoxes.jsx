import { useThree } from '@react-three/fiber'
import { playHalfWidth, visibleHalfHeight } from '../config'
import { useStaged } from '../useStaged'
import Box from '../Box'

// project-content slabs. sized off the width BETWEEN the pit walls (playHalfWidth),
// not the raw window, so they fit the pit exactly.
//   portrait  — full-width slabs that stack into rows
//   landscape — narrower slabs side by side as columns
// dropped in one at a time (useStaged levels). each slab anchors its own drei
// <Html> content (Box handles that).
const PORTRAIT_FILL = 0.7 // share of window height the row stack occupies
const LANDSCAPE_FILL = { w: 0.98, h: 0.62 }
const GAP = 0.35 // visible buffer between slabs (physics stays tight, see Box inset)
const SLAB_START = 2 // stage level of the first slab (after title=0, back=1)
const SLAB_STEP = 0.4 // fraction of STAGE_MS between successive slabs

export default function ProjectBoxes({ items, portrait, onSelect }) {
	const size = useThree((s) => s.size)
	const halfW = playHalfWidth(size, portrait)
	const halfH = visibleHalfHeight()
	const n = items.length

	return items.map((it, i) => (
		<Slab
			key={it.id}
			i={i}
			n={n}
			it={it}
			portrait={portrait}
			halfW={halfW}
			halfH={halfH}
			onSelect={onSelect}
		/>
	))
}

function Slab({ i, n, it, portrait, halfW, halfH, onSelect }) {
	// level 0 = title + back button, then slabs SLAB_STEP*STAGE_MS apart
	const released = useStaged(SLAB_START + i * SLAB_STEP)

	let w, h, x, y, inset
	if (portrait) {
		// full-width rows that stack; collider fills the row so they pile flush,
		// Box insets the visual slab for the gap. spawn each higher so it lands
		// on the growing stack.
		w = 2 * halfW * (it.widthFraction ?? 1) - GAP
		h = (2 * halfH * PORTRAIT_FILL) / n
		x = 0
		y = halfH + 2 + h * (i + 1)
		inset = GAP
	} else {
		// columns: the collider is band-minus-GAP so neighbours have real
		// clearance (no jostling as each drops). spawn straight above its column,
		// just off-frame, so it drops cleanly into its slot left to right.
		const band = (2 * halfW * LANDSCAPE_FILL.w) / n
		w = band - GAP
		h = 2 * halfH * LANDSCAPE_FILL.h
		x = -halfW * LANDSCAPE_FILL.w + band * (i + 0.5)
		y = halfH + h / 2 + 0.5
		inset = 0
	}

	return (
		<Box
			size={[w, h]}
			inset={inset}
			color={it.color}
			position={[x, y]}
			frozen={!released}
			onClick={onSelect && (() => onSelect(it))}
		>
			{it.content}
		</Box>
	)
}
