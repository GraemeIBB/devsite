// LinkedIn — two flat fills in the svg: #89CFF0 baby-blue tile + #FFFFFF "in".
export default {
	name: 'linkedin',
	src: '/logos/linkedin.svg',
	scale: 1.2,
	shading: 'flat',
	collider: { shape: 'cuboid', half: [0.6, 0.6, 0.45] },
	spawn: { x: 2.5, y: 17, spin: -0.15 },
	ccd: true,
	to: 'https://www.linkedin.com/in/graemeibb/',
}
