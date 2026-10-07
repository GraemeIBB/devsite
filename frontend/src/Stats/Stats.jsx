import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import './Stats.css'

function elapsed(timestamp) {
  const secs = Math.max(0, Math.floor(Date.now() / 1000) - timestamp)
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return [d, h, m, s].map(n => String(n).padStart(2, '0')).join(':')
}

const BACKEND = `http://${window.location.hostname}:5000`

function Stats() {
  const [stats, setStats] = useState(null)
  const [, setTick] = useState(0)
  const [crashout, setCrashout] = useState(null)

  useEffect(() => {
    const fetchStats = () =>
      fetch(`${BACKEND}/stats`)
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
    const socket = io(BACKEND)
    socket.on('crashout_update', (data) => setCrashout(data.minutes))
    return () => socket.disconnect()
  }, [])

  if (!stats) return null

  const minuteAngle = crashout !== null ? -(crashout / 60) * 360 : null
  const hourAngle = minuteAngle !== null ? minuteAngle / 12 : null

  return (
    <div className='stats'>
      <div className='left'>
        <p>{elapsed(stats.leetcode.timestamp)} since last solve @ {stats.leetcode.solvedProblem} LC problems solved</p>
        <p>{elapsed(stats.github.timestamp)} since last push @ {stats.github.totalContributions} GitHub contributions</p>
      </div>
      <div className='crashclock'>
        <div className='clock-wrapper'>
          <img className='clock' src='/clock.png' alt='clock' />
          {minuteAngle !== null && (
            <>
			  <div className='hand hour-hand' style={{ transform: `rotate(${hourAngle}deg)` }} />
              <div className='hand minute-hand' style={{ transform: `rotate(${minuteAngle}deg)` }} /> 
            </>
          )}
        </div>
        {crashout !== null && (
          <p>{crashout} minutes til crashout</p>
        )}
      </div>
    </div>
  )
}

export default Stats
