import { useLocation } from "react-router-dom";
import TextGrid from "./TextGrid";
import sample from "./sample.md?raw";

// /textspike — throwaway route to try the text grid. self-guarding like Devlog.
export default function TextSpike() {
	const { pathname } = useLocation();
	if (pathname !== "/textspike") return null;
	return <TextGrid source={sample} />;
}
