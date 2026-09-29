// devlog.json project -> text-grid markdown. one doc per key; the seed for
// generating a page per project (unknown slugs get a stub, not a 404).
const stamp = (ts) => new Date(ts).toLocaleString("sv-SE").slice(0, 16); // YYYY-MM-DD HH:MM

export function devlogDoc(slug, project) {
	const back = "[< projects](/projects)";
	if (!project) return `${back}\n\n# ${slug}\n\nno devlog yet for **${slug}**.\n`;
	const entries = [...project.entries]
		.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
		.map((e) => `### ${stamp(e.timestamp)}\n\n${e.title ? `## ${e.title}\n\n` : ""}${e.body}`);
	return `${back}\n\n# ${project.name}\n\n${entries.join("\n\n---\n\n")}\n`;
}
