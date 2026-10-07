import Navbar from './Navbar'
import SceneCanvas from './scene/SceneCanvas'
import DocPage from './DocPage'
import TextSpike from './textgrid/TextSpike'
import FpsWarning from './FpsWarning'
import { BrowserRouter, useLocation } from 'react-router-dom'
import './App.css'

// the site is one persistent r3f scene. routes drive scene transitions
// (scene/transition.js), not page swaps. legacy DOM pages (Home.jsx, Projects.jsx,
// Stats/, ...) are superseded and left unimported. DocPage is the one
// exception — doc routes (docs/index.js: /devlog/<slug>, /aboutme) are
// text-grid documents (src/textgrid) over the scene, mounted unconditionally
// like Navbar/Console and self-guarding on route. /textspike is the standalone text-grid demo and
// brings its own rendering, so the scene is skipped there.
function Shell() {
	const { pathname } = useLocation()
	return (
		<>
			<Navbar />
			{pathname !== '/textspike' && <SceneCanvas />}
			<DocPage />
			<TextSpike />
			<FpsWarning />
		</>
	)
}

function App() {
	return (
		<div className="container">
			<BrowserRouter>
				<Shell />
			</BrowserRouter>
		</div>
	)
}
export default App
