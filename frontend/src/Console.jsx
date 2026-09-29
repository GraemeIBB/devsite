import './Console.css'
import { useEffect, useRef, useState } from 'react'
import commands from './commands'

// longest string every entry in `strs` starts with — bash-style tab-complete
function commonPrefix(strs) {
	return strs.reduce((prefix, s) => {
		let i = 0
		while (i < prefix.length && i < s.length && prefix[i] === s[i]) i++
		return prefix.slice(0, i)
	})
}

// splits `text` on `re`'s matches, wrapping hits for the red-bold highlight.
// always runs a fresh global copy of `re` so multi-line output never shares
// regex lastIndex state across lines.
function highlight(text, re) {
	if (!re) return text
	const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
	const parts = []
	let last = 0
	let key = 0
	let m
	while ((m = global.exec(text))) {
		if (m[0] === '') { global.lastIndex++; continue } // don't loop forever on a zero-width match
		if (m.index > last) parts.push(text.slice(last, m.index))
		parts.push(<mark key={key++} className="console-hit">{m[0]}</mark>)
		last = m.index + m[0].length
	}
	if (last < text.length) parts.push(text.slice(last))
	return parts
}

function Line({ line }) {
	if (line.type === 'command') return <div className="console-line console-command">user$ {line.text}</div>
	return <div className="console-line console-output">{highlight(line.text, line.highlight)}</div>
}

function Console() {
	const [lines, setLines] = useState([])
	const [input, setInput] = useState("")
	const [history, setHistory] = useState([])
	const [historyPos, setHistoryPos] = useState(-1) // -1 = live draft, else index from the end of history
	const [pending, setPending] = useState(false) // an async command (grep, repos) is in flight
	const inputRef = useRef(null)
	const scrollRef = useRef(null)
	const draftRef = useRef("") // input saved when history browsing starts, restored on the way back down

	useEffect(() => {
		inputRef.current?.focus()
	}, [])

	useEffect(() => {
		const el = scrollRef.current
		if (el) el.scrollTop = el.scrollHeight
	}, [lines, pending])

	function navigateHistory(dir) {
		// dir is the delta on `pos`: -1 = draft (live typing), 0 = most recent
		// entry, up to history.length-1 = oldest. ArrowUp walks toward oldest
		// (+1), ArrowDown walks back toward the draft (-1).
		if (history.length === 0) return
		if (dir === 1 && historyPos === history.length - 1) return
		if (dir === -1 && historyPos === -1) return
		if (dir === 1 && historyPos === -1) draftRef.current = input
		const pos = historyPos + dir
		setHistoryPos(pos)
		setInput(pos === -1 ? draftRef.current : history[history.length - 1 - pos])
	}
	function handleTab() {
		if (input.includes(' ')) return // only complete the command name itself
		const matches = Object.keys(commands).filter((k) => k.startsWith(input))
		if (matches.length === 0) return
		const completion = matches.length === 1 ? matches[0] : commonPrefix(matches)
		if (completion.length > input.length) setInput(completion)
	}
	function runStage(stage, stageInput) {
		const [cmd, ...args] = stage.trim().split(' ')
		const command = commands[cmd]
		if (!command) return `Unknown command: ${cmd}`
		return command.run(args, stageInput)
	}
	async function runPipeline(stages) {
		let output
		let text
		for (const stage of stages) {
			output = await runStage(stage, text)
			text = typeof output === 'object' ? output.text : output
		}
		return output
	}
	function handleSubmit(raw) {
		const stages = raw.split('|').filter((s) => s.trim())
		if (stages.length <= 1) return runStage(raw, undefined) // sync fast path — no pipe involved
		return runPipeline(stages)
	}
	function handleKeyDown(e) {
		if (e.key === "ArrowUp" || e.key === "ArrowDown") {
			e.preventDefault();
			navigateHistory(e.key === "ArrowUp" ? 1 : -1);
			return;
		}
		if (e.key === "Tab") {
			e.preventDefault();
			handleTab();
			return;
		}
		if (e.key === "Enter") {
			e.preventDefault();
			if (pending) return; // command in flight — input's locked (readOnly) anyway
			const trimmed = input.trim()
			setLines((ls) => [...ls, { type: 'command', text: input }]);
			if (trimmed) setHistory((h) => [...h, trimmed]);
			setHistoryPos(-1);
			draftRef.current = "";
			setInput("");
			const finish = (output) => {
				if (output === '__clear__') {
					setLines([]);
				} else {
					const entry = typeof output === 'object' ? output : { text: output }
					setLines((ls) => [...ls, { type: 'output', ...entry }]);
				}
				setPending(false);
			}
			const result = handleSubmit(trimmed)
			if (result && typeof result.then === 'function') {
				setPending(true);
				result.then(finish);
			} else {
				finish(result);
			}
		}
	}
	function refocusIfNoSelection() {
		if (!window.getSelection().toString()) inputRef.current?.focus()
	}
	return(
		<div className='console-base'>
			<div className='console-window'>
				<div className='console-scrollback' ref={scrollRef} onMouseUp={refocusIfNoSelection}>
					{lines.map((line, i) => <Line key={i} line={line} />)}
				</div>
				<div className='console-inputline' onClick={() => inputRef.current?.focus()}>
					<span className='console-prompt'>user$</span>
					<input
						ref={inputRef}
						value={input}
						readOnly={pending}
						spellCheck={false}
						autoCorrect="off"
						autoCapitalize="off"
						autoComplete="off"
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
					/>
				</div>
			</div>
		</div>
	)
}
export default Console
