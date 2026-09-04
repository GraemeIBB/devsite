// minimal PID controller. call step(error, dt) once per frame; the integral and
// the output are both clamped. reset() zeroes the accumulated state (e.g. when a
// body is re-released). gains are bare numbers — tune per use.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

export function pid({ kp = 0, ki = 0, kd = 0, iMax = Infinity, oMax = Infinity }) {
	let integral = 0
	let prev = 0
	let primed = false

	return {
		step(err, dt) {
			if (!(dt > 0)) return 0
			integral = clamp(integral + err * dt, -iMax, iMax)
			const deriv = primed ? (err - prev) / dt : 0
			prev = err
			primed = true
			return clamp(kp * err + ki * integral + kd * deriv, -oMax, oMax)
		},
		reset() {
			integral = 0
			prev = 0
			primed = false
		},
	}
}
