import dropFloor from './dropFloor'
import wallSweep from './wallSweep'
import floorPivot from './floorPivot'
import ditherOut from './ditherOut'

// an exit module: { name, duration (ms), gravity? [x,y,z], Stage: ({portrait}) => r3f }
// Stage renders in place of the normal <Pit> while the exit runs. add one by
// dropping a file here and listing it. see objects/README.md sibling pattern.
export const EXITS = [dropFloor, wallSweep, floorPivot]

// destination-pinned exits, checked before the scene's own / a random one.
// leaving for a devlog page dissolves the scene (not in EXITS: never random).
export const exitTo = (path) => (path.startsWith('/devlog/') ? ditherOut : null)

export const pickExit = () => EXITS[(Math.random() * EXITS.length) | 0]
