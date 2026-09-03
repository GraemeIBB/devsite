// back button — curved return arrow. two-tone silhouette. to: -1 => navigate(-1)
export default {
	name: 'back',
	src: '/logos/return.svg',
	scale: 1,
	shading: 'two-tone',
	collider: { shape: 'ball', radius: 0.5 },
	spawn: { x: -1, y: 12, spin: -0.1 },
	ccd: true,
	to: -1,
}
