// GitHub mark — monochrome silhouette, so two-tone (flat black would vanish in
// the ascii pass). circular -> ball collider.
export default {
	name: 'github',
	src: '/logos/github.svg',
	scale: 1.2,
	shading: 'two-tone',
	collider: { shape: 'ball', radius: 0.6 },
	spawn: { x: -2.5, y: 15, spin: 0.2 },
	ccd: true,
	to: 'https://github.com/graemeibb',
}
