import { Suspense, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { Effects } from '@react-three/drei'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier'
import { makeAsciiShader } from './asciiShader'
import { Letters } from './letters'
import SceneObjects from './objects/SceneObjects'
import { OBJECTS } from './objects'
// import { Auv } from './auv'
import { DragController } from './drag'
import { ASCII, CAMERA, PHYSICS, PIT } from './config'

// visible half-width at the z=0 drag plane. constant as the camera pans in y,
// so it's derived from fov + z + pixel aspect, not r3f's viewport helper.
function visibleHalfWidth(size) {
	return Math.tan((CAMERA.fov * Math.PI) / 360) * CAMERA.z * (size.width / size.height)
}

function Pit({ portrait }) {
	const size = useThree((s) => s.size)
	const x = portrait ? visibleHalfWidth(size) + PIT.wallHalf[0] : PIT.wallX
	return (
		<>
			<RigidBody
				type="fixed"
				colliders={false}
				position={PIT.floor.position}
				friction={0.8}
			>
				<CuboidCollider args={PIT.floor.args} />
			</RigidBody>
			{[-x, x].map((wx) => (
				// key on rounded x so a width change cleanly re-seats the wall
				<RigidBody
					key={Math.round(wx * 100)}
					type="fixed"
					colliders={false}
					position={[wx, 0, 0]}
					friction={0.8}
				>
					<CuboidCollider args={PIT.wallHalf} />
				</RigidBody>
			))}
		</>
	)
}

function Scene({ portrait, navigate }) {
	return (
		<Physics gravity={PHYSICS.gravity}>
			<DragController />
			<Letters portrait={portrait} />
			<SceneObjects items={OBJECTS} navigate={navigate} />
			{/* <Auv /> */}
			<Pit portrait={portrait} />
		</Physics>
	)
}

// window size + orientation. portrait = taller than wide; a flip rebuilds the
// physics scene (below) so GRAEME re-spawns in the layout that fits.
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

// full-screen ascii pass: reads the world-normal G-buffer, shades it against
// a sun down the camera's forward axis, draws glyphs.
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

export default function Spike() {
	const { w, h, portrait } = useViewport()
	// resolved out here: react-router context doesn't cross into <Canvas>
	const navigate = useNavigate()
	return (
		<div style={{ position: 'fixed', inset: 0, background: '#000' }}>
			<Canvas
				// canvas locked to the window box
				style={{ width: w, height: h }}
				resize={{ scroll: false }}
				camera={{ position: [0, 0, CAMERA.z], fov: CAMERA.fov }}
				dpr={[1, 2]}
				onCreated={({ gl }) => gl.setClearAlpha(0)}
			>
				<Suspense fallback={null}>
					{/* key flips on orientation change -> physics world + letter
					    layout rebuild from scratch */}
					<Scene
						key={portrait ? 'portrait' : 'landscape'}
						portrait={portrait}
						navigate={navigate}
					/>
				</Suspense>
				<AsciiEffects />
			</Canvas>
		</div>
	)
}
