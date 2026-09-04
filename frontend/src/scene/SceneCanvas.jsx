import { Suspense, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { Effects } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { makeAsciiShader } from './asciiShader'
import { DragController } from './drag'
import { Pit } from './pit'
import ClearWatch from './ClearWatch'
import { PAGES, WordScene, SCENE_BOUNDS } from './pages'
import { useSceneTransition } from './transition'
import { ASCII, CAMERA, PHYSICS, okmrRightX, visibleHalfHeight, visibleHalfWidth } from './config'
import { getAuvX } from './auvTrack'
import { getWaterSurfaceY } from './waterLevel'

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

// full-screen ascii pass: reads the world-normal G-buffer, shades it against a
// sun down the camera's forward axis, draws glyphs.
function AsciiEffects() {
	const pass = useRef()
	const [shader] = useState(() => makeAsciiShader(ASCII))
	const { size, viewport, camera } = useThree()

	useEffect(() => {
		const dpr = viewport.dpr
		pass.current?.uniforms.uResolution.value.set(size.width * dpr, size.height * dpr)
	}, [size, viewport.dpr])

	useFrame(() => {
		const u = pass.current?.uniforms
		if (!u) return
		camera.getWorldDirection(u.uSunDir.value)
		// waterline, in screen-space v (0 bottom -> 1 top): where the okmr water
		// surface (world y, tracked live in waterLevel.js) projects to at z=0 —
		// the actor plane every submerged thing (AUV, gate, letters) sits near.
		// off-okmr this is -Infinity (waterLevel.js's default), so the compare
		// below never trips and the tint is a no-op elsewhere.
		u.uWaterLineV.value = 0.5 + getWaterSurfaceY() / (2 * visibleHalfHeight())
	})

	return (
		// multisamping 0: MSAA averages normals at bevel edges and speckles the two-tone
		<Effects disableGamma multisamping={0}>
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
	})
	return null
}

function PageScene({ path, portrait, navigate }) {
	const Page = PAGES[path] ?? WordScene
	return <Page path={path} portrait={portrait} navigate={navigate} />
}

function World({ portrait, navigate, shownPath, exit, clear }) {
	const Bounds = SCENE_BOUNDS[shownPath] ?? Pit
	return (
		<Physics gravity={exit?.gravity ?? PHYSICS.gravity}>
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
			<ClearWatch active={!!exit} onClear={clear} />
		</Physics>
	)
}

// the persistent scene: one <Canvas> for the whole site. route changes play an
// exit (exits/*) then swap the page; the canvas never unmounts.
export default function SceneCanvas() {
	const { w, h, portrait } = useViewport()
	// router reads live out here — context does not cross into <Canvas>
	const navigate = useNavigate()
	const { shownPath, exit, clear } = useSceneTransition()

	return (
		<div style={{ position: 'fixed', inset: 0, background: '#000' }}>
			<Canvas
				style={{ width: w, height: h }} // locked to the window box
				resize={{ scroll: false }}
				camera={{ position: [0, 0, CAMERA.z], fov: CAMERA.fov }}
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
					/>
				</Suspense>
				<CameraRig active={shownPath === '/okmr'} />
				<AsciiEffects />
			</Canvas>
		</div>
	)
}
