import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import TextGrid from './textgrid/TextGrid'
import { resolveDoc } from './docs'
import { useShownPath } from './scene/transition'

// text-grid document pages (routes registered in docs/index.js: /devlog/<slug>,
// /aboutme, ...) drawn over the persistent scene. arriving, the scene dithers
// out first (exits/ditherOut.jsx); the doc dithers in once the scene has
// swapped to its empty page (`shown === pathname`), and dithers back out when
// you leave, after which the incoming scene dithers in (exits/ditherHold.jsx).
// no route table: self-guarding on pathname, mounted unconditionally in App.jsx.
function DocPage() {
	const { pathname } = useLocation()
	const navigate = useNavigate()
	const shown = useShownPath()
	const now = resolveDoc(pathname) ? pathname : null
	// keep the last doc mounted after leaving the route so it can dither out;
	// TextGrid's onHidden clears it once fully dissolved
	const [held, setHeld] = useState(now)
	if (now && now !== held) setHeld(now)
	const path = now ?? held
	const doc = useMemo(() => resolveDoc(path), [path])
	const back = doc?.route.back

	useEffect(() => {
		if (!now) return
		const onKey = (e) => e.key === 'Escape' && navigate(back)
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [now, back, navigate])

	if (!doc) return null
	return (
		<TextGrid
			key={path}
			source={doc.source}
			reveal={!!now && shown === pathname}
			onHidden={() => !now && setHeld(null)}
			onCommand={(cmd) => /^(q|q!|quit|back)$/.test(cmd) && (navigate(back), true)}
			onLink={(url) => (url.startsWith('/') ? navigate(url) : window.open(url, '_blank', 'noopener'))}
		/>
	)
}
export default DocPage
