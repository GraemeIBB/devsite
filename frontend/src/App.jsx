import Home from './Home'
import Projects from './Projects'
import Logs from './Logs'
import Demos from './Demos'
import Stats from './Stats/Stats'
import Spike from './spike/Spike'
import Navbar from './Navbar'
import { BrowserRouter, Routes, Route} from 'react-router-dom'
import './App.css'

function App () { 
	
	return(
		<div className='container'>
		<BrowserRouter>
		<Navbar/>
		<Routes>
		<Route path='/' element={<Home/>}/>
		<Route path='/projects' element={<Projects/>}/>
		<Route path='/logs' element={<Logs/>}/>
		<Route path='/demos' element={<Demos/>}/>
		<Route path='/stats' element={<Stats/>}/>
		<Route path='/spike' element={<Spike/>}/>
		</Routes>
		</BrowserRouter>
		</div>
	)
}
export default App
