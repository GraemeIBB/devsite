import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import './Stats.css'

const socket = io('http://localhost:5000')

function elapsed(timestamp) {
  const secs = Math.max(0, Math.floor(Date.now() / 1000) - timestamp)
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return [d, h, m, s].map(n => String(n).padStart(2, '0')).join(':')
}

function Stats() {
  const [stats, setStats] = useState(null)
  const [, setTick] = useState(0)
  const [crashout, setCrashout] = useState(null)

  useEffect(() => {
    const fetchStats = () =>
      fetch('http://localhost:5000/stats')
        .then(res => res.json())
        .then(data => setStats(data))

    fetchStats()
    const id = setInterval(fetchStats, 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    socket.on('crashout_update', (data) => setCrashout(data.minutes))
    return () => socket.off('crashout_update')
  }, [])

  if (!stats) return null

  return (
	<div>
	<p>{elapsed(stats.leetcode.timestamp)} since last solve @ {stats.leetcode.solvedProblem} LC problems solved</p>
	<p>{elapsed(stats.github.timestamp)} since last push @ {stats.github.totalContributions} GitHub contributions</p>
    <div className='crashclock'>
      {crashout !== null && (
        <p><strong>{crashout} minutes til crashout</strong></p>
      )}
    </div>
    </div>
  )
}

export default Stats
