import dropFloor from './dropFloor'
import wallSweep from './wallSweep'
import floorPivot from './floorPivot'
import ditherOut from './ditherOut'
import ditherHold from './ditherHold'
import { isDocPath } from '../../docs'

// an exit module: { name, duration (ms), gravity? [x,y,z], Stage: ({portrait}) => r3f }
// Stage renders in place of the normal <Pit> while the exit runs. add one by
// dropping a file here and listing it. see objects/README.md sibling pattern.
export const EXITS = [dropFloor, wallSweep, floorPivot]

// destination-pinned exits, checked before the scene's own / a random one.
// leaving for a doc page (docs/index.js) dissolves the scene (not in EXITS: never random).
export const exitTo = (path) => (isDocPath(path) ? ditherOut : null)

// ...and leaving one waits for the text to dither out, then dithers the next scene in
export const exitFrom = (path) => (isDocPath(path) ? ditherHold : null)

export const pickExit = () => EXITS[(Math.random() * EXITS.length) | 0]
