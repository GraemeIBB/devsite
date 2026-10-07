import './Navbar.css'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { SquareTerminal } from 'lucide-react'

import Console from './Console'

function Navbar() {
	const [modalBool, setModalBool] = useState(false)

	function handleClick() {
		setModalBool(prev => !prev)
		console.log(modalBool)
	}
	// ` toggles the console (quake-style). ignored while typing in some other
	// field; inside the console's own input it closes it instead of typing a `
	useEffect(() => {
		function handleBacktick(e) {
			if (e.code !== 'Backquote' || e.ctrlKey || e.metaKey || e.altKey) return;
			const t = e.target;
			const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable;
			if (typing && !t.closest('.console-base')) return;
			e.preventDefault();
			setModalBool(prev => !prev);
		}
		window.addEventListener('keydown', handleBacktick);
		return () => window.removeEventListener('keydown', handleBacktick)
	}, [])
	useEffect(() => {
		if(!modalBool) return;
		function handleEsc(e) {
			if (e.key === "Escape") {
				setModalBool(false);
				e.stopImmediatePropagation(); // capture phase: pages underneath (Devlog) never see it
			}
		}
		window.addEventListener('keydown', handleEsc, true);
		return () => window.removeEventListener('keydown', handleEsc, true)
	}, [modalBool])
	return(
		<>
		<div className="navbar-body">
		<Link to="/">Home</Link>
		<Link to="/projects">Projects</Link>
		<Link to="/logs">Logs</Link>
		<Link to="/demos">Demos</Link>
		<Link to="/stats">Stats</Link>
		{/* console now opens with ` (handleBacktick); icon kept for later
		<SquareTerminal style={{ zIndex: 2}} color='white' onClick={handleClick}/>
		*/}
		</div>
		{modalBool && <Console />}
		</>
	)
}
export default Navbar
