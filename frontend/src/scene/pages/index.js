import HomeScene from './HomeScene'
import ProjectsScene from './ProjectsScene'
import WordScene from './WordScene'

// path -> scene component ({ path, portrait, navigate }). routes not listed fall
// back to WordScene. add a designed page by dropping a file here + one entry.
export const PAGES = {
	'/': HomeScene,
	'/projects': ProjectsScene,
}

export { WordScene }
