// Marine Robotics badge — two flat fills in the svg: white disc + a bright
// marine blue for the ring / wave / wordmark. `flat` shading like LinkedIn
// (the source navy #133246 was lifted to #5ab4e0 — the ascii pass crushes
// near-black flat colours to nothing on the black ground, same reason the
// LinkedIn tile is baby-blue, not brand navy). circular -> ball collider.
export default {
	name: 'marine-robotics',
	src: '/logos/marine-robotics.svg',
	scale: 2.4,
	shading: 'flat',
	edge: '#5ab4e0', // extrude side walls read shaded marine blue, not shaded white
	collider: { shape: 'ball', radius: 1.2 },
	spawn: { x: -1, y: 19, spin: 0.25 },
	ccd: true,
}
