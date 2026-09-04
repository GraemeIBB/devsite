import github from './github'
import linkedin from './linkedin'
import back from './back'
import projects from './projects'

// individual descriptors + per-page groupings. pages import the set they want.
export { github, linkedin, back, projects }

export const HOME_OBJECTS = [github, linkedin, projects]
export const BACK_ONLY = [back]
