// AUV touch-joystick state, module-scoped so auv.jsx (thrust) and
// JoystickMesh (drawing) read it per-frame without threading props through
// World/PageScene. same pattern as auvTrack.js. written by Joystick.jsx's DOM
// hit area.
//   stick: control output after deadzone. x: -1 left .. 1 right, y: -1 down .. 1 up
//   knob:  raw thumb offset, fraction of radius, screen axes (y down)
//   rect:  hit area's screen centre + ring/travel radius in css px (null = not mounted)
const stick = { x: 0, y: 0 }
const knob = { x: 0, y: 0 }
let rect = null

export const setStick = (x, y, kx = 0, ky = 0) => {
	stick.x = x
	stick.y = y
	knob.x = kx
	knob.y = ky
}

export const getStick = () => stick
export const getKnob = () => knob

export const setStickRect = (r) => {
	rect = r
}

export const getStickRect = () => rect
