// PROJECTS — the word locked into one rigid body, in place of the forward arrow.
// tap => navigate('/projects'); drag just flings it.
export default {
	name: 'projects',
	kind: 'word',
	word: 'PROJECTS',
	inverted: true, // slab with the word punched through it
	factor: 1 / 3, // a third of GRAEME's size
	spawn: { x: 1.5, y: 13, spin: 0.1 },
	level: 1,
	to: '/projects',
}
