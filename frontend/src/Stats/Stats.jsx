import { useEffect, useState } from 'react'
import './Stats.css'

function Stats() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    fetch('http://localhost:5000/stats')
      .then(res => res.json())
      .then(data => setStats(data))
  }, [])

  return (
    <p>Stats</p>
  )
}

export default Stats
