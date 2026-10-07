// live world-x of the AUV, module-scoped so SceneCanvas' camera rig can follow
// it without threading a ref through World/PageScene. same pattern as
// waterLevel.js. defaults to 0 (camera's own start/leftmost x) before the AUV
// has rendered a frame.
let x = 0

export const setAuvX = (v) => {
	x = v
}

export const getAuvX = () => x
