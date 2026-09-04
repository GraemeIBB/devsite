import { Suspense, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { Effects } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { makeAsciiShader } from './asciiShader'
import { DragController } from './drag'
import { Pit } from './pit'
import ClearWatch from './ClearWatch'
import { PAGES, WordScene } from './pages'
import { useSceneTransition } from './transition'
import { ASCII, CAMERA, PHYSICS } from './config'

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
		if (u) camera.getWorldDirection(u.uSunDir.value)
	})

	return (
		// multisamping 0: MSAA averages normals at bevel edges and speckles the two-tone
		<Effects disableGamma multisamping={0}>
			<shaderPass ref={pass} args={[shader]} />
		</Effects>
	)
}

function PageScene({ path, portrait, navigate }) {
	const Page = PAGES[path] ?? WordScene
	return <Page path={path} portrait={portrait} navigate={navigate} />
}

function World({ portrait, navigate, shownPath, exit, clear }) {
	return (
		<Physics gravity={exit?.gravity ?? PHYSICS.gravity}>
			<DragController />
			<PageScene
				key={`${shownPath}|${portrait ? 'p' : 'l'}`}
				path={shownPath}
				portrait={portrait}
				navigate={navigate}
			/>
			{/* the active exit owns the bounds while it runs, else the normal pit */}
			{exit ? <exit.Stage portrait={portrait} /> : <Pit portrait={portrait} />}
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
				<AsciiEffects />
			</Canvas>
		</div>
	)
}
