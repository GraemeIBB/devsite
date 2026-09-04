import { Walls } from '../pit'
import CrumblingFloor from './CrumblingFloor'

// the floor falls away in sections, left to right; walls stay so everything
// drops straight out the bottom.
export default {
	name: 'drop-floor',
	duration: 2000, // ~5 sections * 300ms + fall — safety-cap hint only
	Stage: ({ portrait }) => (
		<>
			<Walls portrait={portrait} />
			<CrumblingFloor portrait={portrait} />
		</>
	),
}
