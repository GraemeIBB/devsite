import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AsciiModal from './AsciiModal'
import { useShownPath } from './scene/transition'

// okmr isn't built for portrait: while on /okmr in a portrait viewport, block
// it with a popup. leaves on its own when the viewport turns landscape
// (rotation, or a desktop window resized wider), or via its back button.
// a media query, not device orientation — a tall desktop window counts too.
// waits for the scene to actually be showing okmr (useShownPath), so the
// previous page's exit — objects falling out — plays before it prompts.
const PORTRAIT = '(orientation: portrait)'

function usePortrait() {
	const [portrait, setPortrait] = useState(() => window.matchMedia(PORTRAIT).matches)
	useEffect(() => {
		const mq = window.matchMedia(PORTRAIT)
		const onChange = (e) => setPortrait(e.matches)
		mq.addEventListener('change', onChange)
		return () => mq.removeEventListener('change', onChange)
	}, [])
	return portrait
}

export default function OkmrPortrait() {
	const { pathname } = useLocation()
	const navigate = useNavigate()
	const portrait = usePortrait()
	const shown = useShownPath()

	// back to wherever they came from; straight-to-/okmr visits go home.
	// react-router keeps the history index on history.state.idx
	function back() {
		if (window.history.state?.idx > 0) navigate(-1)
		else navigate('/')
	}

	// both: shown alone lags a nav away (drain exit) — pathname drops it at once
	if (pathname !== '/okmr' || shown !== '/okmr' || !portrait) return null
	return (
		<AsciiModal title="Portrait mode does not work :(" button="BACK" onButton={back} hold="okmrPortrait">
			<p>Rotate/resize to horizontal or go back!</p>
		</AsciiModal>
	)
}
