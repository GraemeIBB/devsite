// whole-scene dither level, read by AsciiEffects every frame (and mirrored to
// the --scene-fade css var so DOM labels riding the scene fade with it).
// 1 = fully drawn. exits/ditherOut.jsx drives it; nothing else should.
export const dither = { scene: 1 }
