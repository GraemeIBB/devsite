import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { Effects } from '@react-three/drei'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier'
import { makeAsciiShader } from './asciiShader'
import { Letters } from './letters'
import { Auv } from './auv'
import { DragController } from './drag'
import { ASCII, PHYSICS, PIT } from './config'

function Pit() {
	return PIT.map((w, i) => (
		<RigidBody key={i} type="fixed" colliders={false} position={w.position} friction={0.8}>
			<CuboidCollider args={w.args} />
		</RigidBody>
	))
}

function Scene() {
	return (
		<Physics gravity={PHYSICS.gravity}>
			<DragController />
			<Letters />
			<Auv />
			<Pit />
		</Physics>
	)
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
	return (
		<div style={{ position: 'fixed', inset: 0, background: '#000' }}>
			<Canvas
				camera={{ position: [0, 0, 13], fov: 45 }}
				dpr={[1, 2]}
				onCreated={({ gl }) => gl.setClearAlpha(0)}
			>
				<Suspense fallback={null}>
					<Scene />
				</Suspense>
				<AsciiEffects />
			</Canvas>
		</div>
	)
}
