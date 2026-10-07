// whole-scene dither level, read by AsciiEffects every frame (and mirrored to
// the --scene-fade css var so DOM labels riding the scene fade with it).
// 1 = fully drawn. `dir` ramps it: 0 = hold, +1 = dither in. exits own it
// (exits/ditherOut.jsx drives `scene` directly; ditherHold.jsx calls dither.in);
// nothing else should.
export const DITHER_MS = 900
export const dither = {
	scene: 1,
	dir: 0,
	in() {
		this.scene = 0
		this.dir = 1
	},
	tick(dt) {
		if (!this.dir) return
		this.scene = Math.min(1, Math.max(0, this.scene + (this.dir * dt * 1000) / DITHER_MS))
		if (this.scene >= 1) this.dir = 0
	},
}
