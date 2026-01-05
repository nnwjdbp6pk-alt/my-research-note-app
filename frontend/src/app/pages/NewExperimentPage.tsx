import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createExperiment, listResultSchemas, ResultSchema } from '../../api'

type MaterialLine = { name: string; amount: number; unit: 'g'|'kg'; ratio: number }

export default function NewExperimentPage() {
  const params = useParams()
  const projectId = Number(params.projectId)
  const nav = useNavigate()

  const [name, setName] = useState('')
  const [author, setAuthor] = useState('')
  const [purpose, setPurpose] = useState('')

  const [materials, setMaterials] = useState<MaterialLine[]>([{ name: '', amount: 0, unit: 'g', ratio: 0 }])
  const [schemas, setSchemas] = useState<ResultSchema[]>([])
  const [results, setResults] = useState<Record<string, any>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
      const s = await listResultSchemas(projectId)
      setSchemas(s)
    })()
  }, [projectId])

  function updateMaterial(idx: number, patch: Partial<MaterialLine>) {
    setMaterials(prev => prev.map((m, i) => i === idx ? { ...m, ...patch } : m))
  }
  function addMaterial() {
    setMaterials(prev => [...prev, { name: '', amount: 0, unit: 'g', ratio: 0 }])
  }
  function removeMaterial(idx: number) {
    setMaterials(prev => prev.filter((_, i) => i !== idx))
  }

  function updateResult(key: string, value: any) {
    setResults(prev => ({ ...prev, [key]: value }))
  }

  async function onSave() {
    setError('')
    if (!name.trim() || !author.trim() || !purpose.trim()) {
      setError('Name, author, and purpose are required.')
      return
    }
    if (materials.some(m => m.name && (m.ratio < 0 || m.ratio > 100))) {
      setError('Material ratio must be between 0 and 100.')
      return
    }
    await createExperiment({
      project_id: projectId,
      name,
      author,
      purpose,
      materials: materials.filter(m => m.name.trim()),
      result_values: results,
    } as any)
    nav(`/projects/${projectId}/output`)
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>New Experiment (Project #{projectId})</h2>
        <Link className="btn" to={`/projects/${projectId}`}>Back</Link>
      </div>

      <div className="row">
        <input className="input" style={{ flex: '1 1 240px' }} placeholder="Experiment name" value={name} onChange={e => setName(e.target.value)} />
        <input className="input" style={{ flex: '1 1 240px' }} placeholder="Author" value={author} onChange={e => setAuthor(e.target.value)} />
      </div>

      <div style={{ marginTop: 10 }}>
        <textarea className="input" style={{ width: '100%', minHeight: 90 }} placeholder="Purpose" value={purpose} onChange={e => setPurpose(e.target.value)} />
      </div>

      <h3 style={{ marginTop: 16 }}>Materials</h3>
      {materials.map((m, idx) => (
        <div key={idx} className="row" style={{ marginBottom: 8 }}>
          <input className="input" placeholder="Material name" value={m.name} onChange={e => updateMaterial(idx, { name: e.target.value })} />
          <input className="input" type="number" placeholder="Amount" value={m.amount} onChange={e => updateMaterial(idx, { amount: Number(e.target.value) })} />
          <select className="input" value={m.unit} onChange={e => updateMaterial(idx, { unit: e.target.value as any })}>
            <option value="g">g</option>
            <option value="kg">kg</option>
          </select>
          <input className="input" type="number" placeholder="Ratio (%)" value={m.ratio} onChange={e => updateMaterial(idx, { ratio: Number(e.target.value) })} />
          <button className="btn" onClick={() => removeMaterial(idx)}>Remove</button>
        </div>
      ))}
      <button className="btn" onClick={addMaterial}>Add material</button>

      <h3 style={{ marginTop: 16 }}>Results</h3>
      <div className="small">Fields are defined in Project → Result schema.</div>
      <div style={{ marginTop: 10 }}>
        {schemas.map(s => (
          <div key={s.id} className="row" style={{ marginBottom: 8, alignItems: 'center' }}>
            <div style={{ minWidth: 220 }}><strong>{s.label}</strong> <span className="small">({s.key}, {s.value_type})</span></div>
            {s.value_type === 'quantitative' ? (
              <input className="input" type="number" value={results[s.key] ?? ''} onChange={e => updateResult(s.key, e.target.value === '' ? null : Number(e.target.value))} />
            ) : s.value_type === 'categorical' ? (
              <select className="input" value={results[s.key] ?? ''} onChange={e => updateResult(s.key, e.target.value)}>
                <option value="">Select</option>
                {(s.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ) : (
              <input className="input" value={results[s.key] ?? ''} onChange={e => updateResult(s.key, e.target.value)} />
            )}
          </div>
        ))}
      </div>

      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn" onClick={onSave}>Save</button>
        <div className="small">After saving, you will be redirected to Output.</div>
        {error && <div style={{ color: 'red' }}>{error}</div>}
      </div>
    </div>
  )
}
