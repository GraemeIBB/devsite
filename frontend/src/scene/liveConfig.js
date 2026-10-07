// tiny external store for console-tunable scene values. seed a key below,
// read it reactively via useLive, poke it from anywhere (the console) via
// setLive — keeps future tunables (wind, time-scale, whatever) from needing
// bespoke plumbing through every consumer.
import { useSyncExternalStore } from 'react'
import { ASCII, PHYSICS } from './config'

const values = new Map([
	['gravity', PHYSICS.gravity],
	['fill', ASCII.fill],
])
const listeners = new Map() // key -> Set<() => void>

function subscribers(key) {
	let set = listeners.get(key)
	if (!set) listeners.set(key, (set = new Set()))
	return set
}

export function getLive(key) {
	return values.get(key)
}

export function setLive(key, value) {
	values.set(key, value)
	subscribers(key).forEach((notify) => notify())
}

export function useLive(key) {
	return useSyncExternalStore(
		(onStoreChange) => {
			const set = subscribers(key)
			set.add(onStoreChange)
			return () => set.delete(onStoreChange)
		},
		() => getLive(key),
	)
}
