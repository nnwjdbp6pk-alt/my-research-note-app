import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getOutputConfig, listExperiments, listResultSchemas, Experiment, ResultSchema } from '../../api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, LineChart, Line, ScatterChart, Scatter } from 'recharts'

export default function OutputPage() {
  const params = useParams()
  const projectId = Number(params.projectId)
  const [schemas, setSchemas] = useState<ResultSchema[]>([])
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [included, setIncluded] = useState<string[]>([])

  const includedSchemas = useMemo(() => schemas.filter(s => included.includes(s.key)), [schemas, included])

  useEffect(() => {
    (async () => {
      const s = await listResultSchemas(projectId)
      setSchemas(s)
      const e = await listExperiments(projectId)
      setExperiments(e)
      const oc = await getOutputConfig(projectId)
      setIncluded(oc?.included_keys ?? [])
    })()
  }, [projectId])

  const tableRows = useMemo(() => {
    return experiments.map(ex => {
      const row: any = { name: ex.name, id: ex.id }
      for (const s of includedSchemas) {
        row[s.key] = ex.result_values?.[s.key] ?? ''
      }
      return row
    })
  }, [experiments, includedSchemas])

  const firstQuant = useMemo(() => includedSchemas.find(s => s.value_type === 'quantitative')?.key, [includedSchemas])
  const dataForSingle = useMemo(() => {
    if (!firstQuant) return []
    return experiments.map(ex => ({ name: ex.name, value: Number(ex.result_values?.[firstQuant] ?? 0) }))
  }, [experiments, firstQuant])

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>Output (Project #{projectId})</h2>
        <div className="row">
          <Link className="btn" to={`/projects/${projectId}`}>Back</Link>
          <Link className="btn" to={`/projects/${projectId}/experiments/new`}>New Experiment</Link>
        </div>
      </div>

      <h3>Table</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Experiment</th>
            {includedSchemas.map(s => <th key={s.key}>{s.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {tableRows.map(r => (
            <tr key={r.id}>
              <td>{r.name}</td>
              {includedSchemas.map(s => <td key={s.key}>{String(r[s.key] ?? '')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ marginTop: 16 }}>Charts (prototype)</h3>
      {!firstQuant ? (
        <div className="small">No quantitative field selected. Go back and include at least 1 quantitative field.</div>
      ) : (
        <div className="row">
          <div className="card" style={{ flex: '1 1 340px' }}>
            <div><strong>Bar</strong> <span className="small">({firstQuant})</span></div>
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={dataForSingle}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card" style={{ flex: '1 1 340px' }}>
            <div><strong>Line</strong> <span className="small">({firstQuant})</span></div>
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <LineChart data={dataForSingle}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Line dataKey="value" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card" style={{ flex: '1 1 340px' }}>
            <div><strong>Scatter</strong> <span className="small">(demo: value vs index)</span></div>
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="x" name="idx" />
                  <YAxis type="number" dataKey="y" name="value" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter data={dataForSingle.map((d, i) => ({ x: i+1, y: d.value }))} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <div className="small" style={{ marginTop: 8 }}>
        Box plot is not wired: Recharts has no native box-plot. Next step is integrating Plotly/ECharts or a custom component.
      </div>
    </div>
  )
}
