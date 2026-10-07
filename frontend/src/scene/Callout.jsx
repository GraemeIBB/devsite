import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { surfaceColor, SURFACE_SOLID } from './asciiShader'
import { DEPTH, FONT_MONOGRAM } from './config'
import { slabGeometry } from './slabGeometry'

// a floating label wired to a moving point: a leader line + a small slab, both
// real scene geometry so they go through the ascii pass like everything else
// (no crisp DOM line/box floating on top of the glyphs). only the text itself
// stays DOM — a screen-space drei <Html> pinned to the slab's front face (like
// <Box>, minus its 3D-CSS transform mode), so it tracks the slab's position every frame but renders
// as real, crisp text.
//
// `target`: a ref to a rapier RigidBody (its `.translation()` is read every
// frame) OR a static [x, y, z?] point — so a Callout can hang off any
// SceneObject (pass its forwarded ref) or a fixed spot in the scene.
// `pinOffset`: world-unit offset from target -> pin (not to be confused with
// boundLetters.jsx's `anchor` — that's a fixed rope/chain mooring point, an
// unrelated concept). `offset`: world-unit offset from pin -> the slab's
// resting point (before lerp). `lerp`: a followLerp-style chase speed
// (config.CAMERA.followLerp is the same idea) — higher snaps faster to
// `offset`, lower trails more.
//
// everything is repainted imperatively each frame (mesh transforms, no React
// state) — same style as the camera rig / auv controller.

// unit segment: scaled per frame ([len, lineWidth, lineWidth]) instead of
// rebuilt, so the leader line never regenerates geometry while it tracks a
// moving target. cross-section is square (width == depth, NOT the shared
// DEPTH constant every other object uses) — a line has no "flat face" the
// camera is guaranteed to see head-on like a slab does, so a thin, roughly
// round cross-section keeps its apparent width consistent as the camera pans,
// instead of ballooning into a blade at some angles.
const UNIT_SEGMENT = new THREE.BoxGeometry(1, 1, 1)

// joint filler: billboarding two segments independently around their own
// (different) length axes leaves their rectangular ends misaligned at a bend
// — same problem boundLetters.jsx solves for its chain links. a sphere's
// silhouette is the same from every angle, so parking one at the elbow always
// covers the seam regardless of camera position.
const UNIT_JOINT = new THREE.SphereGeometry(1, 10, 8)

function targetPosition(target, out) {
	if (Array.isArray(target)) return out.set(target[0], target[1], target[2] ?? 0)
	const rb = target?.current
	if (rb?.translation) {
		const t = rb.translation()
		return out.set(t.x, t.y, t.z)
	}
	return out.set(0, 0, 0)
}

// bend point for the leader: equal diagonal run up to the shorter axis, then
// a straight run (horizontal if x is the longer leg, else vertical) into `b`.
function elbow(p, b) {
	const dx = b.x - p.x
	const dy = b.y - p.y
	const s = Math.min(Math.abs(dx), Math.abs(dy))
	const sx = dx < 0 ? -1 : 1
	const sy = dy < 0 ? -1 : 1
	return Math.abs(dx) >= Math.abs(dy)
		? { x: p.x + sx * s, y: b.y, z: p.z }
		: { x: b.x, y: p.y + sy * s, z: p.z }
}

// point a unit segment mesh from world point a -> b AND billboard it toward
// the live camera: the length axis (local x) always runs a -> b, but the
// width/depth axes (local y/z) rotate around that axis so the cap (local z,
// what surfaceColor shades as "front") faces the camera as closely as a line
// with a fixed length axis can — a cylindrical billboard, not a flat sprite.
// deliberately breaks the rest of the scene's "z-rotation only, coplanar"
// convention (see objects/README) — every other primitive stays flat because
// its face is authored facing the camera's fixed axis; a line has no such
// authored face, so it must track the camera instead.
const xAxis = new THREE.Vector3()
const yAxis = new THREE.Vector3()
const zAxis = new THREE.Vector3()
const camDir = new THREE.Vector3()
const mid = new THREE.Vector3()
const basis = new THREE.Matrix4()
const WORLD_UP = new THREE.Vector3(0, 1, 0)

function billboardSegment(mesh, a, b, width, camera) {
	if (!mesh) return
	mid.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)

	xAxis.set(b.x - a.x, b.y - a.y, b.z - a.z)
	const len = xAxis.length()
	if (len < 1e-5) xAxis.set(1, 0, 0)
	else xAxis.divideScalar(len)

	// camera direction, minus its component along the line -> the perpendicular
	// plane the cap can actually rotate within. falls back to world-up if the
	// line points straight at the camera (degenerate cross product).
	camDir.subVectors(camera.position, mid)
	zAxis.copy(camDir).addScaledVector(xAxis, -camDir.dot(xAxis))
	if (zAxis.lengthSq() < 1e-6) {
		zAxis.copy(WORLD_UP).addScaledVector(xAxis, -WORLD_UP.dot(xAxis))
	}
	zAxis.normalize()
	yAxis.crossVectors(zAxis, xAxis).normalize()

	mesh.position.copy(mid)
	basis.makeBasis(xAxis, yAxis, zAxis)
	mesh.quaternion.setFromRotationMatrix(basis)
	mesh.scale.set(Math.max(len, 0.001), width, width)
}

// round joint radius: a touch over half the cross-section's diagonal
// (width*sqrt(2)/2) so it fully swallows the seam, not just kisses it.
const JOINT_MUL = 0.75

// drei's <Html transform> content-size math (Html.js's own occlusion-mesh
// sizing does the same division): world units = css px * (distanceFactor/400).
// constant regardless of camera distance/fov — the perspective placement is
// handled separately by Html's own matrix, this only converts the content's
// intrinsic (untransformed) box size. see node_modules/@react-three/drei/web/Html.js.
const pxToWorld = (px, distanceFactor) => px * (distanceFactor / 400)

// pre-measurement fallback so the slab isn't zero-size for the first frame or
// two before the ResizeObserver reports real content dimensions.
const FALLBACK_SIZE = [0.6, 0.4]
// small cushion so the slab isn't razor-tight against the text's measured
// box (sub-pixel/font-metric rounding in the DOM measurement).
const MEASURE_PAD = 0.03

export default function Callout({
	target,
	pinOffset = [0, 0, 0],
	offset = [2, 1.4],
	lerp = 6,
	radius = 0.15,
	background = '#efeee6', // slab colour (ascii flat-shaded — avoid near-black, see objects/README)
	lineColor, // OPTIONAL hex — omit to use the global ink (SURFACE_SOLID), always visible
	lineWidth = 0.05,
	font = FONT_MONOGRAM,
	fontSize = 21,
	color = '#111111', // text colour (plain DOM — not run through the ascii pass)
	padding = '1px 8px', // slim vertically, roomier horizontally
	distanceFactor = 10, // matches <Box>'s convention; also drives the px->world measurement ratio
	children,
}) {
	const camera = useThree((s) => s.camera)
	const viewHeight = useThree((s) => s.size.height)
	// screen-space Html scales content by distanceFactor / (2·tan(fov/2)·dist),
	// i.e. 1 css px = distanceFactor / viewHeight world units. rescale so that's
	// distanceFactor / 400 — the ratio pxToWorld (and transform mode) uses
	const htmlDistance = (distanceFactor * viewHeight) / 400
	const seg1 = useRef()
	const seg2 = useRef()
	const joint = useRef()
	const boxRef = useRef()
	const pin = useMemo(() => new THREE.Vector3(), [])
	const boxWorld = useMemo(() => new THREE.Vector3(), [])
	const lerped = useRef(null) // seeded on first frame — no snap-in from the origin

	// slab auto-sizes to the rendered text (padding included, since we measure
	// the styled content div's own box) instead of a hand-tuned `size` prop —
	// callout content varies per-use far more than <Box>'s, so hand-tuning
	// every instance isn't worth it. callback ref (not a plain ref): the
	// content div lives in drei's own nested React root, mounted async
	// relative to our effects, so we need the mount notification.
	const [boxSize, setBoxSize] = useState(FALLBACK_SIZE)
	const [contentEl, setContentEl] = useState(null)
	useEffect(() => {
		if (!contentEl) return
		const measure = () => {
			const w = pxToWorld(contentEl.offsetWidth, distanceFactor) + MEASURE_PAD
			const h = pxToWorld(contentEl.offsetHeight, distanceFactor) + MEASURE_PAD
			setBoxSize(([pw, ph]) => (pw === w && ph === h ? [pw, ph] : [w, h]))
		}
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(contentEl)
		return () => ro.disconnect()
	}, [contentEl, distanceFactor])

	const slabGeo = useMemo(
		() => slabGeometry(boxSize[0], boxSize[1], radius),
		[boxSize, radius],
	)
	const boxMat = useMemo(() => surfaceColor(background), [background])
	const lineMat = useMemo(
		() => (lineColor ? surfaceColor(lineColor) : SURFACE_SOLID),
		[lineColor],
	)

	// priority -1: run before drei's own Html useFrame (default priority 0,
	// and its layout effect subscribes before ours since children mount before
	// parents) — else Html samples boxRef's matrixWorld a frame stale, one
	// render behind the lerp target every frame.
	useFrame((_, delta) => {
		targetPosition(target, pin)
		pin.x += pinOffset[0]
		pin.y += pinOffset[1]
		pin.z += pinOffset[2] ?? 0

		// floor: the slab (and so the leader line) never sinks below the pin's own
		// height — the pin's y is the floor, not the target's raw y, so a low
		// `pinOffset` still lets the label sit under a tall object if wanted
		boxWorld.set(pin.x + offset[0], Math.max(pin.y + offset[1], pin.y), pin.z)
		if (!lerped.current) lerped.current = boxWorld.clone()
		const k = Math.min(1, delta * lerp)
		lerped.current.x += (boxWorld.x - lerped.current.x) * k
		lerped.current.y += (boxWorld.y - lerped.current.y) * k
		lerped.current.y = Math.max(lerped.current.y, pin.y)
		lerped.current.z = boxWorld.z

		const j = elbow(pin, lerped.current)
		billboardSegment(seg1.current, pin, j, lineWidth, camera)
		billboardSegment(seg2.current, j, lerped.current, lineWidth, camera)
		joint.current?.position.copy(j)

		if (boxRef.current) {
			boxRef.current.position.copy(lerped.current)
			// force it fresh this frame — <Html> reads matrixWorld during
			// the same render pass, same reason Callout used to force the camera's
			boxRef.current.updateMatrixWorld()
		}
	}, -1)

	return (
		<>
			<mesh ref={seg1} geometry={UNIT_SEGMENT} material={lineMat} dispose={null} />
			<mesh ref={seg2} geometry={UNIT_SEGMENT} material={lineMat} dispose={null} />
			<mesh
				ref={joint}
				geometry={UNIT_JOINT}
				material={lineMat}
				scale={lineWidth * JOINT_MUL}
				dispose={null}
			/>
			<group ref={boxRef}>
				<mesh geometry={slabGeo} material={boxMat} dispose={null} />
				{/* screen-space Html (no `transform`): one projected point + a 2D
				    translate/scale. transform mode stacks matrix3d under a large CSS
				    perspective, which mobile Safari resolves off (label sat low/right
				    of the slab). `htmlDistance` keeps the text the same world size the
				    transform mode gave (see pxToWorld). */}
				<Html
					ref={setContentEl}
					center
					position={[0, 0, DEPTH / 2]}
					distanceFactor={htmlDistance}
					zIndexRange={[60, 0]} // above Box's [50, 0] — a callout always wins ties, regardless of distance
					style={{
						pointerEvents: 'none',
						display: 'flex', // centers the line box itself — lineHeight alone drifts
						alignItems: 'center', // with fonts whose ascent/descent isn't symmetric
						fontFamily: font,
						fontSize,
						color,
						padding,
						whiteSpace: 'nowrap',
						lineHeight: 1, // tight, so there's minimal asymmetric leading to center wrong
					}}
				>
					{/* trim the line box to cap-height..baseline: iOS and desktop read the
					    font's ascent/descent from different tables, so a metrics-sized
					    line box centres the glyphs differently per platform */}
					<span style={{ display: 'block', textBox: 'trim-both cap alphabetic' }}>{children}</span>
				</Html>
			</group>
		</>
	)
}
