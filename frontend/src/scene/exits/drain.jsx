import { useEffect } from 'react'
import { OkmrWalls } from '../pit'
import { setWaterLevel } from '../waterLevel'

// okmr's fixed exit — the reverse of its entrance. drop the water level to 0 so
// the body and everything riding the sea floor sink out the bottom; the left
// wall stays so nothing escapes sideways on the way down (there's no right
// wall in this scene to begin with). ClearWatch swaps the scene once every
// dynamic body has left the frame (transition.js safety-caps it).
export default {
	name: 'drain',
	duration: 2800,
	Stage: ({ portrait }) => {
		useEffect(() => setWaterLevel(0), [])
		return <OkmrWalls portrait={portrait} />
	},
}
