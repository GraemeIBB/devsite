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
	useEffect(() => {
		if(!modalBool) return;
		function handleEsc(e) {
			if (e.key === "Escape") setModalBool(false);
		}
		window.addEventListener('keydown', handleEsc);
		return () => window.removeEventListener('keydown', handleEsc)
	}, [modalBool])
	return(
		<>
		<div className="navbar-body">
		<Link to="/">Home</Link>
		<Link to="/projects">Projects</Link>
		<Link to="/logs">Logs</Link>
		<Link to="/demos">Demos</Link>
		<Link to="/stats">Stats</Link>
		<SquareTerminal style={{ zIndex: 2}} color='white' onClick={handleClick}/>
		</div>
		{modalBool && <Console />}
		</>
	)
}
export default Navbar
