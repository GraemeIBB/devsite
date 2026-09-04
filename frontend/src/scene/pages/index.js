import HomeScene from './HomeScene'
import ProjectsScene from './ProjectsScene'
import WordScene from './WordScene'
import OkmrScene from './OkmrScene'
import drain from '../exits/drain'
import { Walls } from '../pit'

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

// scenes that replace the default <Pit> bounds. okmr's water brings its own sea
// floor, so it wants side walls only (a pit floor would sit above the water).
export const SCENE_BOUNDS = {
	'/okmr': Walls,
}

export { WordScene }
