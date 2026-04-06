import './Console.css'
import { useRef, useState } from 'react'
import commands from './commands'

function Console() {
	const [value, setValue] = useState("user$ ")
	const [boundary, setBoundary] = useState(6)
	const ref = useRef(null)

	function forceEnd() {
		const cur = ref.current
		cur.setSelectionRange(cur.value.length, cur.value.length);
	}
	function handleSubmit(input) {
		const [cmd, ...args] = input.trim().split(' ')
		const command = commands[cmd]
		if (!command) return `Unknown command: ${cmd}`
		return command.run(args)
	}
	function handleKeyDown(e) {
		const {selectionStart, selectionEnd } = ref.current;
		if (selectionStart < boundary || selectionEnd < boundary) {
    		const navKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"];
    		if (!navKeys.includes(e.key)) e.preventDefault();
    		forceEnd();
    		return;
    	}
		if (e.key === "Enter") {
    		e.preventDefault();
			const input = value.slice(boundary).trim()
			const output = handleSubmit(input)
			const newLine = output === '__clear__'
				? "user$ "
				: `\n${output}\nuser$ `
    		const next = output === '__clear__' ? newLine : value + newLine;
    		setValue(next);
    		setBoundary(next.length);
    	}
	}
	function handleChange(e) {
		if (!e.target.value.startsWith(value.slice(0, boundary))) return;
		setValue(e.target.value);
	}
	function handlePaste(e) {
		if (ref.current.selectionStart < boundary) {
			e.preventDefault();
			forceEnd();
		}
	}
	return(
		<div className='console-base'>
			<textarea 
				ref={ref}
				value={value}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
				onPaste={handlePaste}
			/>
		</div>
	)
}
export default Console
