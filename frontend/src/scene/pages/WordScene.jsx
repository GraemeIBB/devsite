import { Letters } from '../letters'
import SceneObjects from '../objects/SceneObjects'
import { BACK_ONLY } from '../objects'

// fallback for any route without a designed scene: the path rendered as letters
// plus a back button.
const wordFromPath = (path) => path.replace(/\//g, '').toUpperCase() || 'HOME'

export default function WordScene({ path, portrait, navigate }) {
	return (
		<>
			<Letters word={wordFromPath(path)} portrait={portrait} />
			<SceneObjects items={BACK_ONLY} navigate={navigate} />
		</>
	)
}
