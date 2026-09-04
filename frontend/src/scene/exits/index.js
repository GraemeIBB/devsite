import dropFloor from './dropFloor'
import wallSweep from './wallSweep'
import floorPivot from './floorPivot'

// an exit module: { name, duration (ms), gravity? [x,y,z], Stage: ({portrait}) => r3f }
// Stage renders in place of the normal <Pit> while the exit runs. add one by
// dropping a file here and listing it. see objects/README.md sibling pattern.
export const EXITS = [dropFloor, wallSweep, floorPivot]

export const pickExit = () => EXITS[(Math.random() * EXITS.length) | 0]
