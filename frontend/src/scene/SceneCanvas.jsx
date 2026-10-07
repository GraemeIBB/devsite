import { Suspense, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { Effects } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { makeAsciiShader } from './asciiShader'
import { DragController } from './drag'
import { Pit } from './pit'
import ClearWatch from './ClearWatch'
import { resolvePage, SCENE_BOUNDS } from './pages'
import { dither } from './dither'
import { useSceneTransition } from './transition'
import { ASCII, CAMERA, cameraZ, okmrRightX, setAspect, visibleHalfHeight, visibleHalfWidth } from './config'
import { getAuvX } from './auvTrack'
import { getWaterSurfaceY } from './waterLevel'
import { useLive } from './liveConfig'
import { setFocused, useHeld } from './focus'
import { isDocPath } from '../docs'
import Joystick, { JoystickMesh, isTouch } from './Joystick'

// window size + orientation. a portrait<->landscape flip remounts the active
// page (below) so its letters re-lay for the new aspect.
function useViewport() {
	const [vp, setVp] = useState(() => ({
		w: window.innerWidth,
		h: window.innerHeight,
		portrait: window.innerHeight > window.innerWidth,
	}))
	useEffect(() => {
		let raf = 0
		const onResize = () => {
			cancelAnimationFrame(raf)
			raf = requestAnimationFrame(() =>
				setVp({
					w: window.innerWidth,
					h: window.innerHeight,
					portrait: window.innerHeight > window.innerWidth,
				}),
			)
		}
		window.addEventListener('resize', onResize)
		window.addEventListener('orientationchange', onResize)
		return () => {
			cancelAnimationFrame(raf)
			window.removeEventListener('resize', onResize)
			window.removeEventListener('orientationchange', onResize)
		}
	}, [])
	return vp
}

// backgrounded tab -> rAF throttles or stops -> the frame you get back on
// focus can report a multi-second `delta`, and physics reacts to that one
// giant step as if it were normal. drives <Physics paused> (skips
// world.step() outright — see World, below) and focus.js's module flag (for
// the per-frame systems outside <Physics> itself, e.g. water.jsx's buoyancy
// and boundLetters.jsx's chain spring, which apply their own impulses and
// need to skip the same frame). NOT r3f's own frameloop: toggling that resets
// the shared clock's elapsedTime to 0 on every transition, which every other
// elapsedTime-based timer (e.g. the okmr letters' fade-in) treats as time
// running backwards.
//
// visibilitychange alone only covers switching browser tabs / minimizing —
// alt-tabbing to another OS-level app while this tab stays the active one in
// the browser leaves document.hidden false, yet rAF still gets starved the
// same way. document.hasFocus() catches that case too, so both are checked.
function useFocused() {
	const isFocused = () => !document.hidden && document.hasFocus()
	const [focused, setFocusedState] = useState(isFocused)
	useEffect(() => {
		const onChange = () => {
			const v = isFocused()
			setFocused(v)
			setFocusedState(v)
		}
		document.addEventListener('visibilitychange', onChange)
		window.addEventListener('blur', onChange)
		window.addEventListener('focus', onChange)
		return () => {
			document.removeEventListener('visibilitychange', onChange)
			window.removeEventListener('blur', onChange)
			window.removeEventListener('focus', onChange)
		}
	}, [])
	return focused
}

// full-screen ascii pass: reads the world-normal G-buffer, shades it against a
// sun down the camera's forward axis, draws glyphs. `idle` skips the render
// (useFrame keeps ticking, so the clock and dither stay live).
function AsciiEffects({ idle }) {
	const pass = useRef()
	const cssFade = useRef(1)
	const [shader] = useState(() => makeAsciiShader(ASCII))
	const { size, viewport, camera } = useThree()
	const fill = useLive('fill')

	useEffect(() => {
		if (pass.current) pass.current.uniforms.uFill.value = fill
	}, [fill])

	useEffect(() => {
		const dpr = viewport.dpr
		pass.current?.uniforms.uResolution.value.set(size.width * dpr, size.height * dpr)
	}, [size, viewport.dpr])

	useFrame((_, delta) => {
		const u = pass.current?.uniforms
		if (!u) return
		dither.tick(delta)
		camera.getWorldDirection(u.uSunDir.value)
		u.uFade.value = dither.scene
		if (cssFade.current !== dither.scene) {
			cssFade.current = dither.scene
			document.documentElement.style.setProperty('--scene-fade', dither.scene)
		}
		// waterline, in screen-space v (0 bottom -> 1 top): where the okmr water
		// surface (world y, tracked live in waterLevel.js) projects to at z=0 —
		// the actor plane every submerged thing (AUV, gate, letters) sits near.
		// off-okmr this is -Infinity (waterLevel.js's default), so the compare
		// below never trips and the tint is a no-op elsewhere.
		u.uWaterLineV.value = 0.5 + getWaterSurfaceY() / (2 * visibleHalfHeight())
	})

	return (
		// multisamping 0: MSAA averages normals at bevel edges and speckles the two-tone
		<Effects disableGamma multisamping={0} disableRender={idle}>
			<shaderPass ref={pass} args={[shader]} />
		</Effects>
	)
}

// okmr's camera pan: starts at x=0 (its leftmost position, same as every other
// scene) and eases toward the AUV's tracked x, clamped to [0, rightBound] —
// rightBound puts the level's right edge (okmrRightX) at the screen's right
// edge, matching how the (removed) right wall used to cap the view. once
// pinned at either end the AUV keeps moving under the clamp, sliding toward
// that side of the screen instead of staying centred. eases back to 0 outside
// okmr (`active` false) so other scenes render centred as before.
function CameraRig({ active }) {
	useFrame((state, delta) => {
		const { camera, size } = state
		const rightBound = Math.max(0, okmrRightX(size) - visibleHalfWidth(size))
		const target = active ? Math.min(Math.max(getAuvX(), 0), rightBound) : 0
		camera.position.x += (target - camera.position.x) * Math.min(1, delta * CAMERA.followLerp)
		camera.position.z = cameraZ() // aspect-driven dolly (config.js), snaps on resize
	})
	return null
}

function PageScene({ path, portrait, navigate }) {
	const Page = resolvePage(path)
	return <Page path={path} portrait={portrait} navigate={navigate} />
}

function World({ portrait, navigate, shownPath, exit, clear, focused, idle }) {
	const gravity = useLive('gravity')
	const Bounds = SCENE_BOUNDS[shownPath] ?? Pit
	return (
		<Physics gravity={exit?.gravity ?? gravity} paused={!focused || idle}>
			<DragController />
			<PageScene
				key={`${shownPath}|${portrait ? 'p' : 'l'}`}
				path={shownPath}
				portrait={portrait}
				navigate={navigate}
			/>
			{/* the active exit owns the bounds while it runs, else the scene's
			    bounds (default pit, or a per-scene override) */}
			{exit ? <exit.Stage portrait={portrait} /> : <Bounds portrait={portrait} />}
			<ClearWatch active={!!exit && !exit.timed} onClear={clear} />
		</Physics>
	)
}

// the persistent scene: one <Canvas> for the whole site. route changes play an
// exit (exits/*) then swap the page; the canvas never unmounts.
export default function SceneCanvas() {
	const { w, h, portrait } = useViewport()
	// before anything below renders: floor/bounds/etc. read visibleHalfHeight()
	setAspect(w / h)
	// router reads live out here — context does not cross into <Canvas>
	const navigate = useNavigate()
	const { shownPath, exit, clear } = useSceneTransition()
	const focused = useFocused()
	// a doc page (docs/index.js) covers the screen with its own opaque canvas and
	// its scene is empty: stop rendering + stepping it (a second full-screen GPU
	// pass is what makes phones chug). any exit playing (leaving the doc) wakes it.
	// or something outside the scene froze it (focus.js holds, e.g. FpsWarning)
	const held = useHeld()
	const idle = (isDocPath(shownPath) && !exit) || held
	// touch flight for the AUV; landscape only (portrait has no room)
	const [touch] = useState(isTouch)
	const stick = touch && shownPath === '/okmr' && !exit && !portrait

	return (
		<div style={{ position: 'fixed', inset: 0, background: '#000' }}>
			<Canvas
				style={{ width: w, height: h }} // locked to the window box
				resize={{ scroll: false }}
				camera={{ position: [0, 0, cameraZ()], fov: CAMERA.fov }}
				dpr={[1, 2]}
				onCreated={({ gl }) => gl.setClearAlpha(0)}
			>
				<Suspense fallback={null}>
					<World
						portrait={portrait}
						navigate={navigate}
						shownPath={shownPath}
						exit={exit}
						clear={clear}
						focused={focused}
						idle={idle}
					/>
				</Suspense>
				<CameraRig active={shownPath === '/okmr'} />
				{stick && <JoystickMesh />}
				<AsciiEffects idle={idle} />
			</Canvas>
			{stick && <Joystick />}
		</div>
	)
}
