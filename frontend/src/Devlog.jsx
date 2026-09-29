import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import TextGrid from './textgrid/TextGrid'
import { devlogDoc } from './textgrid/devlogDoc'
import { useShownPath } from './scene/transition'
import devlog from './devlog.json'

// /devlog/<projectname> — a text-grid document (src/textgrid) drawn over the
// persistent scene. arriving from /projects the scene dithers out first
// (exits/ditherOut.jsx); the doc dithers in once the scene has swapped to its
// empty devlog page (`shown === pathname`). data: devlog.json, hand-edited,
// { "<projectname>": { name, entries: [{ timestamp, title?, body }] } } — body
// is markdown-ish (see textgrid/layout.js). no route table: self-guarding on
// pathname, mounted unconditionally in App.jsx.
function Devlog() {
	const { pathname } = useLocation()
	const navigate = useNavigate()
	const shown = useShownPath()
	const slug = pathname.match(/^\/devlog\/([^/]+)\/?$/)?.[1]
	const source = useMemo(() => (slug ? devlogDoc(slug, devlog[slug]) : ''), [slug])

	useEffect(() => {
		if (!slug) return
		const onKey = (e) => e.key === 'Escape' && navigate('/projects')
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [slug, navigate])

	if (!slug) return null
	return (
		<TextGrid
			key={slug}
			source={source}
			reveal={shown === pathname}
			onLink={(url) => (url.startsWith('/') ? navigate(url) : window.open(url, '_blank', 'noopener'))}
		/>
	)
}
export default Devlog
