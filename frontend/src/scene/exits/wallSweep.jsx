import { Floor } from '../pit'
import Sweeper from './Sweeper'

const DURATION = 1600

export default {
	name: 'wall-sweep',
	duration: DURATION,
	Stage: ({ portrait }) => (
		<>
			<Floor />
			<Sweeper portrait={portrait} duration={DURATION} />
		</>
	),
}
