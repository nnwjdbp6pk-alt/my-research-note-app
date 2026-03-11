import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getOutputConfig, listExperiments, listResultSchemas, Experiment, ResultSchema } from '../../api'
import { BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, CartesianGrid, ResponsiveContainer, LineChart, Line, ScatterChart, Scatter } from 'recharts'

type BoxPlotSummary = {
  min: number
  q1: number
  median: number
  q3: number
  max: number
}

function percentile(sortedValues: number[], ratio: number): number {
  if (sortedValues.length === 1) return sortedValues[0]

  const index = (sortedValues.length - 1) * ratio
  const lower = Math.floor(index)
  const upper = Math.ceil(index)

  if (lower === upper) return sortedValues[lower]

  const weight = index - lower
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * weight
}

function getBoxPlotSummary(values: number[]): BoxPlotSummary | null {
  if (values.length < 2) return null

  const sorted = [...values].sort((a, b) => a - b)
  return {
    min: sorted[0],
    q1: percentile(sorted, 0.25),
    median: percentile(sorted, 0.5),
    q3: percentile(sorted, 0.75),
    max: sorted[sorted.length - 1],
  }
}

function BoxPlotPreview({ summary, label }: { summary: BoxPlotSummary; label: string }) {
  const width = 320
  const height = 180
  const padding = 28
  const axisY = 90
  const range = summary.max - summary.min || 1
  const scaleX = (value: number) => padding + ((value - summary.min) / range) * (width - padding * 2)

  const minX = scaleX(summary.min)
  const q1X = scaleX(summary.q1)
  const medianX = scaleX(summary.median)
  const q3X = scaleX(summary.q3)
  const maxX = scaleX(summary.max)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%' }} role="img" aria-label={`${label} box plot`}>
      <line x1={minX} y1={axisY} x2={q1X} y2={axisY} stroke="#4f46e5" strokeWidth="2" />
      <line x1={q3X} y1={axisY} x2={maxX} y2={axisY} stroke="#4f46e5" strokeWidth="2" />
      <line x1={minX} y1={axisY - 18} x2={minX} y2={axisY + 18} stroke="#4f46e5" strokeWidth="2" />
      <line x1={maxX} y1={axisY - 18} x2={maxX} y2={axisY + 18} stroke="#4f46e5" strokeWidth="2" />
      <rect x={q1X} y={axisY - 28} width={Math.max(q3X - q1X, 2)} height="56" fill="rgba(79,70,229,0.2)" stroke="#4f46e5" strokeWidth="2" rx="6" />
      <line x1={medianX} y1={axisY - 28} x2={medianX} y2={axisY + 28} stroke="#1d4ed8" strokeWidth="3" />
      <text x={minX} y={height - 16} textAnchor="middle" fontSize="11" fill="#6b7280">{summary.min.toFixed(2)}</text>
      <text x={medianX} y={32} textAnchor="middle" fontSize="11" fill="#1d4ed8">Median {summary.median.toFixed(2)}</text>
      <text x={maxX} y={height - 16} textAnchor="middle" fontSize="11" fill="#6b7280">{summary.max.toFixed(2)}</text>
    </svg>
  )
}

export default function OutputPage() {
  const params = useParams()
  const projectId = Number(params.projectId)
  const [schemas, setSchemas] = useState<ResultSchema[]>([])
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [included, setIncluded] = useState<string[]>([])
  const [primaryQuantKey, setPrimaryQuantKey] = useState<string>('')
  const [scatterXKey, setScatterXKey] = useState<string>('')
  const [scatterYKey, setScatterYKey] = useState<string>('')

  const includedSchemas = useMemo(() => schemas.filter(s => included.includes(s.key)), [schemas, included])
  const quantitativeSchemas = useMemo(() => includedSchemas.filter(s => s.value_type === 'quantitative'), [includedSchemas])

  useEffect(() => {
    (async () => {
      const s = await listResultSchemas(projectId)
      setSchemas(s)
      const e = await listExperiments(projectId)
      setExperiments(e)
      const oc = await getOutputConfig(projectId)
      setIncluded(oc?.included_keys ?? [])
      const quantKeys = (oc?.included_keys || []).filter(k => s.find(x => x.key === k && x.value_type === 'quantitative'))
      setPrimaryQuantKey(quantKeys[0] || '')
      setScatterXKey(quantKeys[0] || '')
      setScatterYKey(quantKeys[1] || '')
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

  const dataForSingle = useMemo(() => {
    if (!primaryQuantKey) return []
    return experiments.map(ex => ({ name: ex.name, value: Number(ex.result_values?.[primaryQuantKey] ?? NaN) }))
      .filter(d => Number.isFinite(d.value))
  }, [experiments, primaryQuantKey])

  const scatterData = useMemo(() => {
    if (!scatterXKey || !scatterYKey || scatterXKey === scatterYKey) return []
    return experiments.map(ex => ({
      name: ex.name,
      x: Number(ex.result_values?.[scatterXKey] ?? NaN),
      y: Number(ex.result_values?.[scatterYKey] ?? NaN),
    })).filter(d => Number.isFinite(d.x) && Number.isFinite(d.y))
  }, [experiments, scatterXKey, scatterYKey])

  const boxPlotData = useMemo(() => {
    if (!primaryQuantKey) return []
    const vals = experiments.map(ex => Number(ex.result_values?.[primaryQuantKey] ?? NaN)).filter(v => Number.isFinite(v))
    return vals
  }, [experiments, primaryQuantKey])

  const boxPlotSummary = useMemo(() => getBoxPlotSummary(boxPlotData), [boxPlotData])

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
          {tableRows.length === 0 ? (
            <tr><td colSpan={includedSchemas.length + 1}>No experiments yet.</td></tr>
          ) : tableRows.map(r => (
            <tr key={r.id}>
              <td>{r.name}</td>
              {includedSchemas.map(s => <td key={s.key}>{String(r[s.key] ?? '')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ marginTop: 16 }}>Charts</h3>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="small">Primary quantitative field:</div>
        <select className="input" value={primaryQuantKey} onChange={e => setPrimaryQuantKey(e.target.value)}>
          <option value="">Select</option>
          {quantitativeSchemas.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <div className="small">Scatter X:</div>
        <select className="input" value={scatterXKey} onChange={e => setScatterXKey(e.target.value)}>
          <option value="">Select</option>
          {quantitativeSchemas.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <div className="small">Scatter Y:</div>
        <select className="input" value={scatterYKey} onChange={e => setScatterYKey(e.target.value)}>
          <option value="">Select</option>
          {quantitativeSchemas.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {quantitativeSchemas.length === 0 && (
        <div className="small">No quantitative fields are selected for output. Add one in Project → Result schema and mark it as included.</div>
      )}

      {primaryQuantKey && dataForSingle.length === 0 && (
        <div className="small">Primary quantitative field has no numeric values yet.</div>
      )}

      <div className="row" style={{ flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: '1 1 340px' }}>
          <div><strong>Bar</strong> <span className="small">({primaryQuantKey || 'select field'})</span></div>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={dataForSingle}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <ReTooltip />
                <Bar dataKey="value" fill="#4f46e5" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ flex: '1 1 340px' }}>
          <div><strong>Line</strong> <span className="small">({primaryQuantKey || 'select field'})</span></div>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={dataForSingle}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <ReTooltip />
                <Line dataKey="value" stroke="#22c55e" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ flex: '1 1 340px' }}>
          <div><strong>Box plot</strong> <span className="small">({primaryQuantKey || 'select field'})</span></div>
          <div style={{ width: '100%', height: 240, padding: '8px 0' }}>
            {primaryQuantKey && boxPlotSummary ? (
              <BoxPlotPreview summary={boxPlotSummary} label={primaryQuantKey} />
            ) : (
              <div className="small">Need at least 2 numeric values to draw a box plot.</div>
            )}
          </div>
        </div>

        <div className="card" style={{ flex: '1 1 340px' }}>
          <div><strong>Scatter</strong> <span className="small">({scatterXKey || 'X'}, {scatterYKey || 'Y'})</span></div>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x" name={scatterXKey || 'X'} />
                <YAxis type="number" dataKey="y" name={scatterYKey || 'Y'} />
                <ReTooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter data={scatterData} fill="#f97316" />
              </ScatterChart>
            </ResponsiveContainer>
            {scatterData.length === 0 && <div className="small">Select two quantitative fields with numeric values for scatter.</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
