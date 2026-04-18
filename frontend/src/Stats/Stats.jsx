import { useEffect, useState } from 'react'
import './Stats.css'

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

  useEffect(() => {
    fetch('http://localhost:5000/stats')
      .then(res => res.json())
      .then(data => setStats(data))
  }, [])

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  if (!stats) return null

  return (
    <div>
      <p>{elapsed(stats.leetcode.timestamp)} since last solve @ {stats.leetcode.solvedProblem} LC problems solved</p>
      <p>{elapsed(stats.github.timestamp)} since last push @ {stats.github.totalContributions} GitHub contributions</p>
    </div>
  )
}

export default Stats
