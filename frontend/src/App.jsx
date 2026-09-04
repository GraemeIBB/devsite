import Navbar from './Navbar'
import SceneCanvas from './scene/SceneCanvas'
import { BrowserRouter } from 'react-router-dom'
import './App.css'

// the site is one persistent r3f scene. routes drive scene transitions
// (scene/transition.js), not page swaps. legacy DOM pages (Home.jsx, Projects.jsx,
// Stats/, ...) are superseded and left unimported.
function App() {
	return (
		<div className="container">
			<BrowserRouter>
				<Navbar />
				<SceneCanvas />
			</BrowserRouter>
		</div>
	)
}
export default App
