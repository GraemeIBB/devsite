import './AsciiModal.css'
import { useEffect, useId, useRef } from 'react'
import { setHold } from './scene/focus'

// shared ascii-framed popup (FpsWarning, OkmrPortrait, ...). mount it to show
// it, unmount to hide. while mounted it freezes the scene (focus.js hold under
// `hold`) and maps Esc/Enter to the button.
export default function AsciiModal({ title, button = 'OK', onButton, hold, children }) {
	const titleId = useId()
	// latest onButton without re-binding the key listener every render
	const act = useRef(onButton)
	act.current = onButton

	useEffect(() => {
		setHold(hold, true)
		return () => setHold(hold, false)
	}, [hold])

	useEffect(() => {
		function onKey(e) {
			if (e.key === 'Escape' || e.key === 'Enter') {
				act.current()
				e.stopImmediatePropagation()
			}
		}
		window.addEventListener('keydown', onKey, true)
		return () => window.removeEventListener('keydown', onKey, true)
	}, [])

	return (
		<div className="amodal-backdrop" role="dialog" aria-modal="true" aria-labelledby={titleId}>
			<div className="amodal-box">
				<div className="amodal-edge"><span>+</span><span className="amodal-h" /><span>+</span></div>
				<div className="amodal-mid">
					<span className="amodal-v" />
					<div className="amodal-body">
						<div id={titleId} className="amodal-title">{title}</div>
						{children}
						<button className="amodal-ok" onClick={onButton} autoFocus>[ {button} ]</button>
					</div>
					<span className="amodal-v" />
				</div>
				<div className="amodal-edge"><span>+</span><span className="amodal-h" /><span>+</span></div>
			</div>
		</div>
	)
}
