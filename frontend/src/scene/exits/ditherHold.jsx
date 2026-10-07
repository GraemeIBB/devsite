import { useEffect } from 'react'
import { Pit } from '../pit'
import { dither, DITHER_MS } from '../dither'

// leaving a doc page: the scene behind the text grid is empty, so just wait
// out the text's dither-out (`timed`), then the incoming scene dithers in.
function HoldStage({ portrait }) {
	// runs in the same commit that swaps the page in, before its first frame
	useEffect(() => () => dither.in(), [])
	return <Pit portrait={portrait} />
}

// +50ms: let the text's last cells clear before the scene starts filling
export default { name: 'dither-hold', duration: DITHER_MS + 50, timed: true, Stage: HoldStage }
