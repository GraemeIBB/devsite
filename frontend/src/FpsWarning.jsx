import './FpsWarning.css'
import { useState, useEffect } from 'react'
import { setHold } from './scene/focus'

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

	// freeze the scene while open
	useEffect(() => {
		setHold('fpsWarn', show)
		return () => setHold('fpsWarn', false)
	}, [show])

	useEffect(() => {
		if (!show) return
		function onKey(e) {
			if (e.key === 'Escape' || e.key === 'Enter') {
				dismiss()
				e.stopImmediatePropagation()
			}
		}
		window.addEventListener('keydown', onKey, true)
		return () => window.removeEventListener('keydown', onKey, true)
	}, [show])

	function dismiss() {
		setShow(false)
		try { sessionStorage.setItem(KEY, '1') } catch {}
	}

	if (!show) return null
	return (
		<div className="fpsw-backdrop" role="dialog" aria-modal="true" aria-labelledby="fpsw-title">
			<div className="fpsw-box">
				<div className="fpsw-edge"><span>+</span><span className="fpsw-h" /><span>+</span></div>
				<div className="fpsw-mid">
					<span className="fpsw-v" />
					<div className="fpsw-body">
						<div id="fpsw-title" className="fpsw-title">[ Looks like you have low framerate! Chances are you're on low battery mode. Once you turn that off, the website should look much better. ]</div>
						<p>{/* TODO explanation text */}</p>
						<button className="fpsw-ok" onClick={dismiss} autoFocus>[ OK ]</button>
					</div>
					<span className="fpsw-v" />
				</div>
				<div className="fpsw-edge"><span>+</span><span className="fpsw-h" /><span>+</span></div>
			</div>
		</div>
	)
}
export default FpsWarning
