import { useState, useEffect } from 'react'
import AsciiModal from './AsciiModal'

// one-time popup for devices capped at ~30fps (iOS Low Power Mode caps rAF to 30).
// skips startup hitches, takes median rAF interval, shows if fps < THRESHOLD.
// dismissal sticks for the session. ?fpswarn forces it on for testing.
const SKIP = 10 // frames ignored while the scene spins up
const SAMPLES = 20 // ~0.66s at 30fps; median shrugs off stray hitches
const THRESHOLD = 40 // between 30 and 60, so a 30 cap trips it and 60/120 don't
const KEY = 'fpsWarnDismissed'

function measureFps() {
	return new Promise(res => {
		const deltas = []
		let last = null, n = 0
		function tick(t) {
			if (n++ >= SKIP) {
				if (last !== null) deltas.push(t - last)
				last = t
			}
			if (deltas.length < SAMPLES) requestAnimationFrame(tick)
			else {
				deltas.sort((a, b) => a - b)
				res(1000 / deltas[deltas.length >> 1])
			}
		}
		requestAnimationFrame(tick)
	})
}

function FpsWarning() {
	const [show, setShow] = useState(false)

	useEffect(() => {
		if (new URLSearchParams(location.search).has('fpswarn')) { setShow(true); return }
		try { if (sessionStorage.getItem(KEY)) return } catch {}
		let dead = false
		measureFps().then(fps => {
			if (!dead && !document.hidden && fps < THRESHOLD) setShow(true)
		})
		return () => { dead = true }
	}, [])

	function dismiss() {
		setShow(false)
		try { sessionStorage.setItem(KEY, '1') } catch {}
	}

	if (!show) return null
	return (
		<AsciiModal
			title="[ Looks like you have low framerate! Chances are you're on low battery mode. Once you turn that off, the website should look much better. ]"
			onButton={dismiss}
			hold="fpsWarn"
		>
			<p>{/* TODO explanation text */}</p>
		</AsciiModal>
	)
}
export default FpsWarning
