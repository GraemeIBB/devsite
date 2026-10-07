import { Letters } from '../letters'
import SceneObjects from '../objects/SceneObjects'
import { HOME_OBJECTS } from '../objects'

export default function HomeScene({ portrait, navigate }) {
	return (
		<>
			<Letters word="GRAEME" portrait={portrait} />
			<SceneObjects items={HOME_OBJECTS} navigate={navigate} />
		</>
	)
}
