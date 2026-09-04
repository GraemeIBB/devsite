import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { surfaceColor } from './asciiShader'
import { GATE } from './config'

// robosub-style qualification gate, rebuilt from
// okmr_stonefish/data/robots/../objects/gate.scn (primitives only): two posts
// — each two-tone, top/bottom segments in opposite colours (a coin-flip
// marker) — joined by a crossbar, plus a small style marker. fixed (static).
//
// the AUV only thrusts in x/y (z-translation is locked, see auv.jsx's
// RigidBody) and always travels along x, so the posts stand perpendicular to
// that — straddling z=0, the AUV's fixed depth-axis position — rather than
// side-by-side across the screen. flying at the gate, it threads the z-gap
// for free just by being on its one z, and clears it by diving under the
// crossbar (a y check). the .scn itself only bars the *bottom* of the posts
// (open top); the bar's moved to the top here instead — a doorway the AUV
// dives under reads more like "a gate" than a bar cleared from above would.
const { scale, colors } = GATE
const POLE = [0.1 * scale, 0.75 * scale, 0.1 * scale] // one post segment (two stack into a full post)
const GAP = 3.0 * scale // post-to-post spacing, straddling z=0
const BAR = [0.1 * scale, 0.1 * scale, GAP + 0.1 * scale] // crossbar, post to post
const MARKER = [0.1 * scale, 0.1 * scale, 0.6 * scale] // style marker

const POLE_MID_Y = -0.375 * scale // combined two-segment post, centred
const POLE_HALF_H = 0.75 * scale
const BAR_Y = 0.375 * scale // post-top edge
const MARKER_Y = 0.05 * scale // same offset off the bar the .scn had, mirrored

export function Gate() {
	const originY = GATE.positionY - POLE_MID_Y

	return (
		<RigidBody type="fixed" colliders={false} position={[GATE.positionX, originY, 0]}>
			{/* far post (-z): red top, black bottom */}
			<mesh material={surfaceColor(colors.red)} position={[0, 0, -GAP / 2]} dispose={null}>
				<boxGeometry args={POLE} />
			</mesh>
			<mesh
				material={surfaceColor(colors.black)}
				position={[0, -0.75 * scale, -GAP / 2]}
				dispose={null}
			>
				<boxGeometry args={POLE} />
			</mesh>
			{/* near post (+z): black top, red bottom */}
			<mesh material={surfaceColor(colors.black)} position={[0, 0, GAP / 2]} dispose={null}>
				<boxGeometry args={POLE} />
			</mesh>
			<mesh
				material={surfaceColor(colors.red)}
				position={[0, -0.75 * scale, GAP / 2]}
				dispose={null}
			>
				<boxGeometry args={POLE} />
			</mesh>
			{/* crossbar */}
			<mesh material={surfaceColor(colors.gray)} position={[0, BAR_Y, 0]} dispose={null}>
				<boxGeometry args={BAR} />
			</mesh>
			{/* style marker */}
			<mesh material={surfaceColor(colors.red)} position={[0, MARKER_Y, 0]} dispose={null}>
				<boxGeometry args={MARKER} />
			</mesh>

			{/* colliders: full-height posts + the bar — the AUV threads the z-gap
			    (it's always at z=0) and clears the bar by staying under it */}
			<CuboidCollider
				args={[POLE[0] / 2, POLE_HALF_H, POLE[2] / 2]}
				position={[0, POLE_MID_Y, -GAP / 2]}
			/>
			<CuboidCollider
				args={[POLE[0] / 2, POLE_HALF_H, POLE[2] / 2]}
				position={[0, POLE_MID_Y, GAP / 2]}
			/>
			<CuboidCollider args={[BAR[0] / 2, BAR[1] / 2, BAR[2] / 2]} position={[0, BAR_Y, 0]} />
		</RigidBody>
	)
}
