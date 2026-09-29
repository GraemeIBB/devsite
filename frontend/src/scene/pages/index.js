import HomeScene from './HomeScene'
import ProjectsScene from './ProjectsScene'
import WordScene from './WordScene'
import OkmrScene from './OkmrScene'
import drain from '../exits/drain'
import { OkmrWalls } from '../pit'

// path -> scene component ({ path, portrait, navigate }). routes not listed fall
// back to WordScene. add a designed page by dropping a file here + one entry.
export const PAGES = {
	'/': HomeScene,
	'/projects': ProjectsScene,
	'/okmr': OkmrScene,
}

// leaving one of these scenes always plays a specific exit (else transition.js
// picks one at random). see exits/.
export const SCENE_EXIT = {
	'/okmr': drain,
}

// scenes that replace the default <Pit> bounds. okmr's water brings its own
// sea floor (no pit floor) and only a left wall — see pit.jsx's OkmrWalls.
export const SCENE_BOUNDS = {
	'/okmr': OkmrWalls,
}

// devlog routes are text-grid pages (Devlog.jsx): the scene behind them is empty
const EmptyScene = () => null
export const resolvePage = (path) =>
	PAGES[path] ?? (path.startsWith('/devlog/') ? EmptyScene : WordScene)

export { WordScene }
