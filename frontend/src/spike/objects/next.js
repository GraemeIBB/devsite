// next / forward button — blocky right arrow. two-tone silhouette.
export default {
	name: 'next',
	src: '/logos/arrow-right.svg',
	scale: 0.9,
	shading: 'two-tone',
	collider: { shape: 'cuboid', half: [0.6, 0.45, 0.45] },
	spawn: { x: 1.5, y: 13, spin: 0.1 },
	ccd: true,
	to: '/projects', // TODO dummy route
}
