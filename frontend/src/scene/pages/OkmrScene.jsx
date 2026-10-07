import { useEffect } from 'react'
import { BoundLetters } from '../boundLetters'
import { Auv } from '../auv'
import { Gate } from '../gate'
import { Water } from '../water'
import { setWaterLevel } from '../waterLevel'
import SceneObjects from '../objects/SceneObjects'
import { back } from '../objects'

const okmrBack = { ...back, level: 2 } // drops in once the water has risen

// the water scene. Water rises from below the frame on mount; OKMR and the AUV
// stay parked until it has settled, then drop in. leaving always plays
// exits/drain (see pages/index SCENE_EXIT) — the reverse. bounds are walls-only
// (SCENE_BOUNDS): the water brings its own sea floor.
export default function OkmrScene({ portrait, navigate }) {
	useEffect(() => {
		setWaterLevel(1)
		return () => setWaterLevel(0)
	}, [])

	return (
		<>
			<Water />
			<BoundLetters word="OKMR" portrait={portrait} level={2} />
			<Auv level={2} />
			<Gate />
			<SceneObjects items={[okmrBack]} navigate={navigate} />
		</>
	)
}
