import { Letters } from '../letters'
import SceneObjects from '../objects/SceneObjects'
import { back } from '../objects'
import { DEPTH } from '../config'
import ProjectBoxes from './ProjectBoxes'

const card = (label) => (
	<div
		style={{
			font: '600 15px/1.3 "Roboto Mono", monospace',
			color: '#0b0b0b',
			padding: '4px 8px',
			whiteSpace: 'nowrap',
		}}
	>
		{label}
	</div>
)

// placeholder content — off-white slabs (Box default) + a floating label
const PROJECTS = [
	{ id: 'p1', content: card('project one') },
	{ id: 'p2', content: card('project two') },
	{ id: 'p3', content: card('project three') },
]

// PROJECTS text lands left. the back button comes in with it (level 0). portrait:
// a tall slab spanning both text rows, settling in the gap between the text and
// the right wall. the full-width project slabs then stack on that bottom row.
const backLandscape = {
	...back,
	level: 0,
	scale: 1.6,
	collider: { shape: 'ball', radius: 0.8 },
	spawn: { ...back.spawn, x: 7 },
}
const backPortrait = {
	...back,
	level: 0,
	scale: 1.6,
	collider: { shape: 'cuboid', half: [0.8, 1.0, DEPTH / 2] }, // ~2 rows tall
	spawn: { x: 1.5, y: 15, spin: 0 },
}

export default function ProjectsScene({ portrait, navigate }) {
	return (
		<>
			{/* Projects override: pack the letters tight, align P to the left wall
			    — keeps the right side clear for the back button + slabs. gap is
			    just above the collider width (0.85 * scale) so no collision. */}
			<Letters
				word="PROJECTS"
				portrait={portrait}
				scale={portrait ? 0.5 : 1}
				align="left"
				spacing={portrait ? 0.9 : 1.75}
				rows={portrait ? 2 : 1}
			/>
			<ProjectBoxes items={PROJECTS} portrait={portrait} />
			<SceneObjects
				items={[portrait ? backPortrait : backLandscape]}
				navigate={navigate}
			/>
		</>
	)
}
