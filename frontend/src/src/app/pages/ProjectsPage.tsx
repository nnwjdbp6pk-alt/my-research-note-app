import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createProject, listProjects, Project } from '../../api'

export default function ProjectsPage() {
  const [items, setItems] = useState<Project[]>([])
  const [name, setName] = useState('')

  async function refresh() {
    const data = await listProjects()
    setItems(data)
  }

  useEffect(() => { refresh() }, [])

  async function onCreate() {
    if (!name.trim()) return
    await createProject({ name: name.trim(), project_type: 'REGULAR', status: 'ONGOING' })
    setName('')
    await refresh()
  }

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="card" style={{ flex: '1 1 320px' }}>
        <h2>Projects</h2>
        <div className="row">
          <input className="input" placeholder="New project name" value={name} onChange={e => setName(e.target.value)} />
          <button className="btn" onClick={onCreate}>Create</button>
        </div>
        <p className="small">Start backend first (http://127.0.0.1:8000).</p>
      </div>

      <div className="card" style={{ flex: '2 1 520px' }}>
        <h3>List</h3>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map(p => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>{p.name}</td>
                <td>{p.status}</td>
                <td><Link to={`/projects/${p.id}`}>Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
