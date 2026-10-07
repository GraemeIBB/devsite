import { useRef } from 'react'
import { RigidBody, CuboidCollider, useRevoluteJoint, interactionGroups } from '@react-three/rapier'
import { surfaceColor } from './asciiShader'
import { GATE } from './config'
import { grab, hoverCursor } from './drag'

// robosub-style qualification gate, rebuilt from
// okmr_stonefish/data/robots/../objects/gate.scn (primitives only): two posts
// — each two-tone, top/bottom segments in opposite colours (a coin-flip
// marker) — joined by a crossbar, plus a style marker hanging from the bar's
// centre. frame is fixed (static); the marker is its own dynamic body on a
// hinge (GateMarker), so the AUV bumping it sets it swinging.
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
const MARKER = [0.1 * scale, 0.6 * scale, 0.1 * scale] // style marker, hangs vertically

const POLE_MID_Y = -0.375 * scale // combined two-segment post, centred
const POLE_HALF_H = 0.75 * scale
const BAR_Y = 0.375 * scale // post-top edge

// the marker must never collide with its own frame: resting against the
// crossbar at a high swing, the contact holds it up and rapier sleeps it there.
// frame + marker each get their own group; each filters the other out, and
// everything else (default: all groups) still hits both.
const ALL = [...Array(16).keys()]
const G_FRAME = 14
const G_MARKER = 15
const FRAME_GROUPS = interactionGroups(G_FRAME, ALL.filter((g) => g !== G_MARKER))
const MARKER_GROUPS = interactionGroups(G_MARKER, ALL.filter((g) => g !== G_FRAME))
const SWING = (120 * Math.PI) / 180 // hinge limit either way — never wraps over the bar

export function Gate() {
	const frame = useRef()
	const originY = GATE.positionY - POLE_MID_Y

	return (
		<>
			<RigidBody ref={frame} type="fixed" colliders={false} position={[GATE.positionX, originY, 0]}>
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

				{/* colliders: full-height posts + the bar — the AUV threads the z-gap
				    (it's always at z=0) and clears the bar by staying under it */}
				<CuboidCollider
					args={[POLE[0] / 2, POLE_HALF_H, POLE[2] / 2]}
					position={[0, POLE_MID_Y, -GAP / 2]}
					collisionGroups={FRAME_GROUPS}
				/>
				<CuboidCollider
					args={[POLE[0] / 2, POLE_HALF_H, POLE[2] / 2]}
					position={[0, POLE_MID_Y, GAP / 2]}
					collisionGroups={FRAME_GROUPS}
				/>
				<CuboidCollider
					args={[BAR[0] / 2, BAR[1] / 2, BAR[2] / 2]}
					position={[0, BAR_Y, 0]}
					collisionGroups={FRAME_GROUPS}
				/>
			</RigidBody>
			<GateMarker frame={frame} origin={[GATE.positionX, originY]} />
		</>
	)
}

const NO_BUOYANCY = { noBuoyancy: true } // water.jsx skips it — it hangs, not floats up
const MARKER_HALF = MARKER[1] / 2

// the style marker: a vertical bar hinged (z axis, the screen-facing one) at
// the crossbar's centre. its body origin is its own centre; the hinge anchors
// its top edge to the bar's centre in the frame's local space.
function GateMarker({ frame, origin }) {
	const body = useRef()
	useRevoluteJoint(frame, body, [
		[0, BAR_Y, 0], // on the frame: crossbar centre
		[0, MARKER_HALF, 0], // on the marker: its top
		[0, 0, 1], // swing in the x/y plane
		[-SWING, SWING],
	])

	return (
		<RigidBody
			ref={body}
			colliders={false}
			userData={NO_BUOYANCY}
			canSleep={false} // never freeze mid-swing
			position={[origin[0], origin[1] + BAR_Y - MARKER_HALF, 0]}
			enabledTranslations={[true, true, false]}
			enabledRotations={[false, false, true]}
			linearDamping={1}
			angularDamping={1.5} // water drag — settles after a bump instead of swinging forever
		>
			<mesh material={surfaceColor(colors.red)} dispose={null}>
				<boxGeometry args={MARKER} />
			</mesh>
			<CuboidCollider args={[MARKER[0] / 2, MARKER_HALF, MARKER[2] / 2]} collisionGroups={MARKER_GROUPS} />
			{/* invisible, fatter grab target — the bar itself is a thin click */}
			<mesh onPointerDown={(e) => grab(e, body.current)} {...hoverCursor}>
				<boxGeometry args={[MARKER[0] * 3, MARKER[1], MARKER[2] * 3]} />
				<meshBasicMaterial colorWrite={false} depthWrite={false} />
			</mesh>
		</RigidBody>
	)
}
