import './Logs.css'
import testlogs from './testlogs.json'
import { useState, useEffect } from 'react'
function Logs() {
	
	const [selectedLog, setSelectedLog] = useState(null)
	const [resolvedContent, setResolvedContent] = useState([])
	const BACKEND = "http://localhost:5000"
	
	//Logic to implement: 
	//list cards holding the lognames of each log from a project
	//sliding transition revealing them all, then fade in text colors for each thats slid out
	//
	useEffect(() => {
		if (!selectedLog) return

		async function resolve() {
			const logs = await Promise.all(selectedLog.logs.map(async (log) => {
				const items = await Promise.all(log.content.map(async (item) => {
					if (item.ctype === "image") {
						const res = await fetch(`${BACKEND}/presign/${item.key}`)
						const { url } = await res.json()
						return { ...item, url}
					}
					return item
				}))
				return { logname: log.logname, items }
			}))
			setResolvedContent(logs)
		}

		resolve()
	}, [selectedLog])
	
	const renderers = {
		text: (item, i) => <p key={i}>{item.body}</p>,
		image: (item, i) => <img key={i} src={item.url} alt={item.label}/>,
		//video, code
	}

	return (
		<>
			<div className='page'>
				<div className="body">
					<div className="list-container">
						{testlogs.map(log => <div className={`item${selectedLog?.href === log.href ? ' item-selected' : ''}`} key={log.href} onClick={() => setSelectedLog(log)}><p>{selectedLog?.href === log.href ? `[${log.name}]` : log.name}</p></div>)}
					</div>
					<div className="log-body">
						{!selectedLog
							? <p className="placeholder">Select a project to view its logs.</p>
							: <div className="text-container">
								{resolvedContent.map((log, i) => (
									<div key={i}>
										<h3>{log.logname}</h3>
										{log.items.map((item, j) => renderers[item.ctype]?.(item, j))}
										{i < resolvedContent.length - 1 && <br/>}
									</div>
								))}
							</div>
						}
					</div>
				</div>
			</div>
		</>
	)
}
export default Logs
