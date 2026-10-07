import PivotFloor from './PivotFloor'

// walls vanish; the floor pivots on its left corner and lobs everything off.
const DURATION = 1300

export default {
	name: 'floor-pivot',
	duration: DURATION,
	Stage: ({ portrait }) => <PivotFloor portrait={portrait} duration={DURATION} />,
}
