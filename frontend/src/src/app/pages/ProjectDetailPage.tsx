import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { createResultSchema, deleteResultSchema, getOutputConfig, getProject, listResultSchemas, ResultSchema, upsertOutputConfig, updateResultSchema } from '../../api'

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = Number(params.projectId)
  const [projectName, setProjectName] = useState('')
  const [schemas, setSchemas] = useState<ResultSchema[]>([])
  const [included, setIncluded] = useState<string[]>([])

  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  const [type, setType] = useState<'quantitative'|'qualitative'|'categorical'>('quantitative')
  const [unit, setUnit] = useState('')
  const [description, setDescription] = useState('')
  const [options, setOptions] = useState('')

  async function refresh() {
    const p = await getProject(projectId)
    setProjectName(p.name)
    const s = await listResultSchemas(projectId)
    setSchemas(s)
    const oc = await getOutputConfig(projectId)
    setIncluded(oc?.included_keys ?? [])
  }

  useEffect(() => { if (projectId) refresh() }, [projectId])

  async function onAddSchema() {
    if (!key.trim() || !label.trim()) return
    await createResultSchema({ project_id: projectId, key: key.trim(), label: label.trim(), value_type: type, unit: unit || null, description: description || null, options: options ? options.split(',').map(o => o.trim()).filter(Boolean) : null })
    setKey(''); setLabel(''); setType('quantitative'); setUnit(''); setDescription(''); setOptions('')
    await refresh()
  }

  async function onDeleteSchema(id: number) {
    await deleteResultSchema(id)
    await refresh()
  }

  function toggleIncluded(k: string) {
    setIncluded(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])
  }

  async function onUpdateSchema(row: ResultSchema, patch: Partial<ResultSchema>) {
    await updateResultSchema(row.id, patch)
    await refresh()
  }

  async function saveIncluded() {
    await upsertOutputConfig({ project_id: projectId, included_keys: included })
    await refresh()
  }

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="card" style={{ flex: '1 1 360px' }}>
        <h2>Project #{projectId}</h2>
        <div className="small">{projectName}</div>
        <div className="row" style={{ marginTop: 12 }}>
          <Link className="btn" to={`/projects/${projectId}/experiments/new`}>New Experiment</Link>
          <Link className="btn" to={`/projects/${projectId}/output`}>Output</Link>
        </div>
      </div>

      <div className="card" style={{ flex: '2 1 700px' }}>
        <h3>Result schema fields</h3>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <input className="input" style={{ minWidth: 220 }} placeholder="key (e.g., viscosity_cps)" value={key} onChange={e => setKey(e.target.value)} />
          <input className="input" style={{ minWidth: 220 }} placeholder="label (e.g., Viscosity (cps))" value={label} onChange={e => setLabel(e.target.value)} />
          <select className="input" value={type} onChange={e => setType(e.target.value as any)}>
            <option value="quantitative">quantitative</option>
            <option value="qualitative">qualitative</option>
            <option value="categorical">categorical</option>
          </select>
          <input className="input" style={{ minWidth: 120 }} placeholder="unit (optional)" value={unit} onChange={e => setUnit(e.target.value)} />
          <input className="input" style={{ minWidth: 220 }} placeholder="description" value={description} onChange={e => setDescription(e.target.value)} />
          <input className="input" style={{ minWidth: 220 }} placeholder="options (comma, categorical only)" value={options} onChange={e => setOptions(e.target.value)} />
          <button className="btn" onClick={onAddSchema}>Add</button>
        </div>

        <table className="table" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Include</th>
              <th>Key</th>
              <th>Label</th>
              <th>Type</th>
              <th>Unit</th>
              <th>Options/Description</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {schemas.map(s => (
              <tr key={s.id}>
                <td><input type="checkbox" checked={included.includes(s.key)} onChange={() => toggleIncluded(s.key)} /></td>
                <td>{s.key}</td>
                <td>
                  <input className="input" value={s.label} onChange={e => onUpdateSchema(s, { label: e.target.value })} />
                </td>
                <td>
                  <select className="input" value={s.value_type} onChange={e => onUpdateSchema(s, { value_type: e.target.value as any })}>
                    <option value="quantitative">quantitative</option>
                    <option value="qualitative">qualitative</option>
                    <option value="categorical">categorical</option>
                  </select>
                </td>
                <td>
                  <input className="input" value={s.unit ?? ''} onChange={e => onUpdateSchema(s, { unit: e.target.value || null })} />
                </td>
                <td>
                  <input className="input" placeholder="options (comma)" value={s.options?.join(',') ?? ''} onChange={e => onUpdateSchema(s, { options: e.target.value ? e.target.value.split(',').map(v => v.trim()).filter(Boolean) : null })} />
                  <input className="input" placeholder="description" value={s.description ?? ''} onChange={e => onUpdateSchema(s, { description: e.target.value || null })} />
                </td>
                <td><button className="btn" onClick={() => onDeleteSchema(s.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={saveIncluded}>Save Output Fields</button>
          <div className="small">Saved fields are used for Output table/graphs.</div>
        </div>
      </div>
    </div>
  )
}
