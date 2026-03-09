import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  type Experiment,
  type ResultSchema,
  deleteExperiment,
  getOutputConfig,
  listExperiments,
  listResultSchemas,
} from '../../api'

function normalizeNumbers(raw: unknown): number[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => Number(v)).filter((v) => !Number.isNaN(v))
  }

  if (typeof raw === 'number') {
    return Number.isNaN(raw) ? [] : [raw]
  }

  if (typeof raw === 'string') {
    if (raw.includes(',')) {
      return raw
        .split(',')
        .map((x) => Number(x.trim()))
        .filter((v) => !Number.isNaN(v))
    }

    const n = Number(raw)
    return Number.isNaN(n) ? [] : [n]
  }

  return []
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  return Number(avg.toFixed(4))
}

export default function OutputPage() {
  const { projectId: projectIdParam } = useParams()
  const projectId = Number(projectIdParam)
  const navigate = useNavigate()

  const [schemas, setSchemas] = useState<ResultSchema[]>([])
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [includedKeys, setIncludedKeys] = useState<string[]>([])
  const [selectedExperimentIds, setSelectedExperimentIds] = useState<number[]>([])
  const [barKey, setBarKey] = useState('')
  const [lineKey, setLineKey] = useState('')
  const [scatterXKey, setScatterXKey] = useState('')
  const [scatterYKey, setScatterYKey] = useState('')
  const [error, setError] = useState('')

  const includedSchemas = useMemo(
    () => schemas.filter((schema) => includedKeys.includes(schema.key)).sort((a, b) => a.order - b.order),
    [schemas, includedKeys],
  )

  const quantitativeSchemas = useMemo(
    () => includedSchemas.filter((schema) => schema.value_type === 'quantitative'),
    [includedSchemas],
  )

  async function refresh() {
    try {
      const [schemaRows, experimentRows, outputConfig] = await Promise.all([
        listResultSchemas(projectId),
        listExperiments(projectId),
        getOutputConfig(projectId),
      ])

      setSchemas(schemaRows)
      setExperiments(experimentRows)
      setIncludedKeys(outputConfig?.included_keys ?? [])

      const ids = experimentRows.map((exp) => exp.id)
      setSelectedExperimentIds(ids)
    } catch {
      setError('비교 데이터를 불러오지 못했습니다.')
    }
  }

  useEffect(() => {
    void refresh()
  }, [projectId])

  useEffect(() => {
    const keys = quantitativeSchemas.map((schema) => schema.key)
    if (keys.length === 0) {
      setBarKey('')
      setLineKey('')
      setScatterXKey('')
      setScatterYKey('')
      return
    }

    if (!keys.includes(barKey)) setBarKey(keys[0])
    if (!keys.includes(lineKey)) setLineKey(keys[0])
    if (!keys.includes(scatterXKey)) setScatterXKey(keys[0])
    if (!keys.includes(scatterYKey)) setScatterYKey(keys[Math.min(1, keys.length - 1)])
  }, [quantitativeSchemas, barKey, lineKey, scatterXKey, scatterYKey])

  const visibleExperiments = useMemo(
    () => experiments.filter((exp) => selectedExperimentIds.includes(exp.id)),
    [experiments, selectedExperimentIds],
  )

  const chartData = useMemo(
    () =>
      visibleExperiments.map((exp) => {
        const row: Record<string, string | number> = { name: exp.name }
        quantitativeSchemas.forEach((schema) => {
          const nums = normalizeNumbers(exp.result_values[schema.key])
          const avg = mean(nums)
          row[schema.key] = avg ?? NaN
        })
        return row
      }),
    [visibleExperiments, quantitativeSchemas],
  )

  const scatterData = useMemo(() => {
    if (!scatterXKey || !scatterYKey) return []

    return visibleExperiments
      .map((exp) => {
        const x = mean(normalizeNumbers(exp.result_values[scatterXKey]))
        const y = mean(normalizeNumbers(exp.result_values[scatterYKey]))
        if (x === null || y === null) return null
        return { name: exp.name, x, y }
      })
      .filter((row): row is { name: string; x: number; y: number } => row !== null)
  }, [visibleExperiments, scatterXKey, scatterYKey])

  function toggleExperiment(id: number) {
    setSelectedExperimentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  async function onDeleteExperiment(experiment: Experiment) {
    const ok = window.confirm(`[${experiment.name}] 실험을 삭제할까요?`)
    if (!ok) return

    try {
      await deleteExperiment(experiment.id)
      await refresh()
    } catch {
      setError('실험 삭제에 실패했습니다.')
    }
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>물성 비교 창</h2>
        <div className="row" style={{ gap: 8 }}>
          <Link className="btn btn-secondary" to={`/projects/${projectId}`}>
            프로젝트 설정
          </Link>
          <Link className="btn" to={`/projects/${projectId}/experiments/new`}>
            실험 추가
          </Link>
        </div>
      </div>

      {error && <div style={{ color: 'var(--danger-color)', marginTop: 10 }}>{error}</div>}

      <section className="card" style={{ background: '#f8fafc', marginTop: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>비교 대상 실험 선택</strong>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn-small" onClick={() => setSelectedExperimentIds(experiments.map((exp) => exp.id))}>
              전체 선택
            </button>
            <button className="btn-small" onClick={() => setSelectedExperimentIds([])}>
              전체 해제
            </button>
          </div>
        </div>
        <div className="row" style={{ gap: 16, marginTop: 8 }}>
          {experiments.map((exp) => (
            <label key={exp.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={selectedExperimentIds.includes(exp.id)}
                onChange={() => toggleExperiment(exp.id)}
              />
              <span>{exp.name}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="row" style={{ marginTop: 16 }}>
        <div className="card" style={{ flex: 1, minWidth: 320 }}>
          <label className="small">Bar 항목</label>
          <select className="input" style={{ width: '100%' }} value={barKey} onChange={(e) => setBarKey(e.target.value)}>
            {quantitativeSchemas.map((schema) => (
              <option key={schema.key} value={schema.key}>
                {schema.label}
              </option>
            ))}
          </select>
          <div style={{ width: '100%', height: 260, marginTop: 10 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey={barKey} fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ flex: 1, minWidth: 320 }}>
          <label className="small">Line 항목</label>
          <select className="input" style={{ width: '100%' }} value={lineKey} onChange={(e) => setLineKey(e.target.value)}>
            {quantitativeSchemas.map((schema) => (
              <option key={schema.key} value={schema.key}>
                {schema.label}
              </option>
            ))}
          </select>
          <div style={{ width: '100%', height: 260, marginTop: 10 }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey={lineKey} stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <strong>상관 비교</strong>
          <select className="input" value={scatterXKey} onChange={(e) => setScatterXKey(e.target.value)}>
            {quantitativeSchemas.map((schema) => (
              <option key={schema.key} value={schema.key}>
                X: {schema.label}
              </option>
            ))}
          </select>
          <select className="input" value={scatterYKey} onChange={(e) => setScatterYKey(e.target.value)}>
            {quantitativeSchemas.map((schema) => (
              <option key={schema.key} value={schema.key}>
                Y: {schema.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ width: '100%', height: 280, marginTop: 10 }}>
          <ResponsiveContainer>
            <ScatterChart>
              <CartesianGrid />
              <XAxis type="number" dataKey="x" name={scatterXKey} />
              <YAxis type="number" dataKey="y" name={scatterYKey} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Legend />
              <Scatter name="실험" data={scatterData} fill="#f97316" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>실험 물성 비교 테이블</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>실험명</th>
                <th>작성자</th>
                <th>실험조건</th>
                {includedSchemas.map((schema) => (
                  <th key={schema.key}>{schema.label}</th>
                ))}
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {visibleExperiments.length === 0 && (
                <tr>
                  <td colSpan={4 + includedSchemas.length}>선택된 실험이 없습니다.</td>
                </tr>
              )}
              {visibleExperiments.map((exp) => (
                <tr key={exp.id}>
                  <td>
                    <strong>{exp.name}</strong>
                  </td>
                  <td>{exp.author}</td>
                  <td style={{ minWidth: 240 }}>{exp.purpose}</td>
                  {includedSchemas.map((schema) => {
                    const raw = exp.result_values[schema.key]
                    const nums = normalizeNumbers(raw)
                    if (schema.value_type === 'quantitative') {
                      const avg = mean(nums)
                      const shown = avg === null ? '-' : Number.isInteger(avg) ? String(avg) : avg.toFixed(2)
                      return (
                        <td key={schema.key} title={nums.length > 1 ? nums.join(', ') : ''}>
                          {shown}
                        </td>
                      )
                    }
                    return <td key={schema.key}>{raw ? String(raw) : '-'}</td>
                  })}
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <button className="btn-small" onClick={() => navigate(`/projects/${projectId}/experiments/${exp.id}/edit`)}>
                        수정
                      </button>
                      <button
                        className="btn-small"
                        style={{ color: 'var(--danger-color)' }}
                        onClick={() => void onDeleteExperiment(exp)}
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
