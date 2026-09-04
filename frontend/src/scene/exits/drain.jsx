import { useEffect } from 'react'
import { Walls } from '../pit'
import { setWaterLevel } from '../waterLevel'

// okmr's fixed exit — the reverse of its entrance. drop the water level to 0 so
// the body and everything riding the sea floor sink out the bottom; the walls
// stay so nothing escapes sideways on the way down. ClearWatch swaps the scene
// once every dynamic body has left the frame (transition.js safety-caps it).
export default {
	name: 'drain',
	duration: 2800,
	Stage: ({ portrait }) => {
		useEffect(() => setWaterLevel(0), [])
		return <Walls portrait={portrait} />
	},
}
