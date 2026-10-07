import { devlogDoc } from "../textgrid/devlogDoc";
import devlog from "../devlog.json";
import aboutme from "./aboutme.md?raw";

// text-grid document routes. each: { match: RegExp, doc: (...captures) => markdown,
// back: path for esc / :q }. a matched route renders as a TextGrid over an empty
// scene (scene/pages), dissolving the scene on the way in and out (scene/exits).
// add a page = drop a .md here + one entry. markdown syntax: textgrid/layout.js.
export const DOC_ROUTES = [
	{ match: /^\/devlog\/([^/]+)\/?$/, doc: (slug) => devlogDoc(slug, devlog[slug]), back: "/projects" },
	{ match: /^\/aboutme\/?$/, doc: () => aboutme, back: "/" },
];

export function resolveDoc(path) {
	for (const route of DOC_ROUTES) {
		const m = path?.match(route.match);
		if (m) return { route, source: route.doc(...m.slice(1)) };
	}
	return null;
}

export const isDocPath = (path) => DOC_ROUTES.some((r) => r.match.test(path));
