import github from "./github";
import linkedin from "./linkedin";
import back from "./back";
import projects from "./projects";
import aboutme from "./aboutme";
import marineRobotics from "./marine-robotics";

// individual descriptors + per-page groupings. pages import the set they want.
export { github, linkedin, back, projects, aboutme, marineRobotics };

export const HOME_OBJECTS = [
	github,
	linkedin,
	projects,
	aboutme,
	marineRobotics,
];
export const BACK_ONLY = [back];
