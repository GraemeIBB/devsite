import './Logs.css'
import testlogs from './testlogs.json'
import { useState, useEffect } from 'react'
function Logs() {

	const [selectedProj, setSelectedProj] = useState(null)
	const [selectedLog, setSelectedLog] = useState(null)
	const [resolvedContent, setResolvedContent] = useState([])
	const BACKEND = "http://localhost:5000"

	useEffect(() => {
		if (!selectedProj) return

		async function resolve() {
			const logs = await Promise.all(selectedProj.logs.map(async (log) => {
				const items = await Promise.all(log.content.map(async (item) => {
					if (item.ctype === "image") {
						const res = await fetch(`${BACKEND}/presign/${item.key}`)
						const { url } = await res.json()
						return { ...item, url}
					}
					return item
				}))
				return { logname: log.logname, id: log.id, items }
			}))
			setResolvedContent(logs)
		}

		resolve()
	}, [selectedProj])

	useEffect(() => {
		if (!selectedLog) return
		const el = document.getElementById(`log-${selectedLog}`)
		if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
	}, [selectedLog])

	const renderers = {
		text: (item, i) => <p key={i}>{item.body}</p>,
		image: (item, i) => <img key={i} src={item.url} alt={item.label}/>,
		code: (item, i) => <pre key={i}><code>{item.body}</code></pre>
		//video
	}

	function handleProjClick(proj) {
		if (selectedProj?.href === proj.href) {
			setSelectedProj(null)
			setSelectedLog(null)
			setResolvedContent([])
		} else {
			setSelectedProj(proj)
			setSelectedLog(null)
		}
	}

	function handleLogClick(log) {
		setSelectedLog(log.id)
	}

	return (
		<>
			<div className='page'>
				<div className="body">
					<div className="list-container">
						{testlogs.map(proj => (
							<div key={proj.href}>
								<div
									className={`item${selectedProj?.href === proj.href ? ' item-selected' : ''}`}
									onClick={() => handleProjClick(proj)}
								>
									<p>{selectedProj?.href === proj.href ? `[${proj.name}]` : ` ${proj.name} `}</p>
								</div>
								{selectedProj?.href === proj.href && proj.logs.map(log => (
									<div
										key={log.id}
										className={`item item-sub${selectedLog === log.id ? ' item-selected' : ''}`}
										onClick={() => handleLogClick(log)}
									>
										<p>{log.logname}</p>
									</div>
								))}
							</div>
						))}
					</div>
					<div className="log-body">
						{!selectedProj
							? <p className="placeholder">Select a project to view its logs.</p>
							: <div className="text-container">
								{resolvedContent.map((log, i) => (
									<div className='target' key={i} id={`log-${log.id}`}>
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
