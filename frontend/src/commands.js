/*
 * name: {
 * description: "description here!",
 * run: () => {return "something"}
 * }
 */
import { getLive, setLive } from "./scene/liveConfig";
import { PHYSICS } from "./scene/config";

const BACKEND = `http://${window.location.hostname}:5000`;

// glob -> regex: * = any run of chars, ? = any single char, everything else
// literal. lets `grep` take shell-style patterns instead of plain substrings.
function globToRegExp(term) {
	const escaped = term
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replace(/\*/g, ".*")
		.replace(/\?/g, ".");
	return new RegExp(escaped, "i");
}

const commands = {
	help: {
		description: "You are here",
		run: () =>
			Object.entries(commands)
				.map(([k, v]) => `${k} --- ${v.description}`)
				.join("\n"),
	},
	clear: {
		description: "Clears the console",
		run: () => "__clear__",
	},
	gravity: {
		description: "gravity <n>|'reset'",
		run: ([arg]) => {
			if (arg === "reset") {
				setLive("gravity", PHYSICS.gravity);
				return `gravity reset to ${-PHYSICS.gravity[1]}`;
			}
			if (arg === undefined) return `gravity: ${-getLive("gravity")[1]}`;
			const n = Number(arg);
			if (Number.isNaN(n)) return `gravity: expected a number, got "${arg}"`;
			setLive("gravity", [0, -n, 0]);
			return `gravity set to ${n}`;
		},
	},
	repogrep: {
		description: "repogrep --help for usage (search / --list / -s / -m / -l)",
		run: async (args) => {
			const idIdx = args.indexOf("--id");
			const id = idIdx !== -1 ? args[idIdx + 1] : undefined;
			const help = args.includes("-h") || args.includes("--help");
			const list = args.includes("--list");
			const summarize = args.includes("-s");
			const map = args.includes("-m");
			const libs = args.includes("-l");
			const flags = new Set(["-h", "--help", "--list", "-s", "-m", "-l"]);
			const term = args
				.filter((a, i) => !flags.has(a) && !(idIdx !== -1 && (i === idIdx || i === idIdx + 1)))
				.join(" ");

			if (help) {
				return [
					"repogrep <term>                   search all tracked repos",
					"repogrep --id <id> <term>         search one repo",
					"repogrep --id <id> -s             summarize: tech, libraries, commits, link",
					"repogrep --id <id> -m             file reference map",
					"repogrep --id <id> -l             list libraries, one per line",
					"repogrep --list                   list tracked repos + detected tags",
					"repogrep -h | --help              this text",
				].join("\n");
			}

			if (list) {
				try {
					const res = await fetch(`${BACKEND}/repos`);
					const data = await res.json();
					const lines = Object.entries(data).map(([repoId, info]) =>
						info.error
							? `${repoId} (${info.owner}/${info.repo}) --- error: ${info.error}`
							: `${repoId} (${info.owner}/${info.repo}) --- ${info.tags.length ? info.tags.join(", ") : "no tags detected"}`,
					);
					return lines.length ? lines.join("\n") : "no repos tracked yet";
				} catch {
					return "repogrep: backend unreachable";
				}
			}

			if (libs) {
				if (!id) return "repogrep: -l (libraries) needs --id <id>";
				try {
					const res = await fetch(`${BACKEND}/repos/${encodeURIComponent(id)}/summary`);
					const s = await res.json();
					if (s.error) return `repogrep: ${s.error}`;
					return s.deps.length ? s.deps.join("\n") : `repogrep: no libraries detected in "${id}"`;
				} catch {
					return "repogrep: backend unreachable";
				}
			}

			if (summarize) {
				if (!id) return "repogrep: -s (summarize) needs --id <id>";
				try {
					const res = await fetch(`${BACKEND}/repos/${encodeURIComponent(id)}/summary`);
					const s = await res.json();
					if (s.error) return `repogrep: ${s.error}`;
					return [
						`${s.repo} (${s.owner})`,
						`tech: ${s.languages.length ? s.languages.join(", ") : "unknown"}`,
						`libraries: ${s.deps.length ? s.deps.join(", ") : "none detected"}`,
						`commits: ${s.commits ?? "unknown"}`,
						s.tags.length ? `tags: ${s.tags.join(", ")}` : null,
						s.url,
					]
						.filter(Boolean)
						.join("\n");
				} catch {
					return "repogrep: backend unreachable";
				}
			}

			if (map) {
				if (!id) return "repogrep: -m (map) needs --id <id>";
				try {
					const res = await fetch(`${BACKEND}/repos/${encodeURIComponent(id)}/map`);
					const m = await res.json();
					if (m.error) return `repogrep: ${m.error}`;
					if (!m.edges.length) return `repogrep: no resolvable references found in "${id}"`;
					const lines = m.edges.map(([from, to]) => `${from} -> ${to}`);
					const footer = m.truncated
						? `… showing ${m.edges.length}/${m.edgeCount} edges across ${m.fileCount} files`
						: `${m.edgeCount} edges across ${m.fileCount} files`;
					return [...lines, footer].join("\n");
				} catch {
					return "repogrep: backend unreachable";
				}
			}

			if (!term) return "repogrep: expected a search term";
			try {
				const url = new URL(`${BACKEND}/search-repos`);
				url.searchParams.set("q", term);
				if (id) url.searchParams.set("id", id);
				const res = await fetch(url);
				const hits = await res.json();
				if (!hits.length) return `repogrep: no matches for "${term}"`;
				const text = hits
					.map((h) => `${h.repo}/${h.file}:${h.line}: ${h.text}`)
					.join("\n");
				// term's already a regex as far as the backend (rg) is concerned —
				// reuse it verbatim for the highlight, falling back to no highlight
				// if it doesn't parse as one client-side
				let highlight;
				try {
					highlight = new RegExp(term, "gi");
				} catch {
					highlight = undefined;
				}
				return { text, highlight };
			} catch {
				return "repogrep: backend unreachable";
			}
		},
	},
	grep: {
		description:
			"<cmd> | grep <term> (filters piped output, * and ? are wildcards — nothing to grep standalone)",
		run: ([term], input) => {
			if (input === undefined) return "grep: nothing piped in — try `<cmd> | grep <term>`";
			if (!term) return "grep: expected a search term";
			const re = globToRegExp(term);
			const lines = input.split("\n").filter((line) => re.test(line));
			if (!lines.length) return `grep: no matches for "${term}"`;
			return { text: lines.join("\n"), highlight: new RegExp(re.source, "gi") };
		},
	},
};
export default commands;
