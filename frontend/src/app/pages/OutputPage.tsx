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

function normalizeTexts(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean)
  }
  if (raw === null || raw === undefined) return []
  const text = String(raw).trim()
  return text ? [text] : []
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
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [error, setError] = useState('')

  function getSortTimestamp(exp: Experiment): number {
    const base = exp.experiment_date || exp.created_at
    const ts = new Date(base).getTime()
    return Number.isNaN(ts) ? 0 : ts
  }

  const includedSchemas = useMemo(
    () => schemas.filter((schema) => includedKeys.includes(schema.key)).sort((a, b) => a.order - b.order),
    [schemas, includedKeys],
  )

  const quantitativeSchemas = useMemo(
    () => includedSchemas.filter((schema) => schema.value_type === 'quantitative'),
    [includedSchemas],
  )
  const nonQuantitativeSchemas = useMemo(
    () => includedSchemas.filter((schema) => schema.value_type !== 'quantitative'),
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
  const sortedVisibleExperiments = useMemo(
    () =>
      [...visibleExperiments].sort((a, b) => {
        const diff = getSortTimestamp(a) - getSortTimestamp(b)
        return sortOrder === 'asc' ? diff : -diff
      }),
    [visibleExperiments, sortOrder],
  )

  const chartData = useMemo(
    () =>
      sortedVisibleExperiments.map((exp) => {
        const row: Record<string, string | number> = { name: exp.name }
        quantitativeSchemas.forEach((schema) => {
          const nums = normalizeNumbers(exp.result_values[schema.key])
          const avg = mean(nums)
          row[schema.key] = avg ?? NaN
        })
        return row
      }),
    [sortedVisibleExperiments, quantitativeSchemas],
  )

  const scatterData = useMemo(() => {
    if (!scatterXKey || !scatterYKey) return []

    return sortedVisibleExperiments
      .map((exp) => {
        const x = mean(normalizeNumbers(exp.result_values[scatterXKey]))
        const y = mean(normalizeNumbers(exp.result_values[scatterYKey]))
        if (x === null || y === null) return null
        return { name: exp.name, x, y }
      })
      .filter((row): row is { name: string; x: number; y: number } => row !== null)
  }, [sortedVisibleExperiments, scatterXKey, scatterYKey])

  const nonQuantDistributions = useMemo(
    () =>
      nonQuantitativeSchemas.map((schema) => {
        const map = new Map<string, number>()
        visibleExperiments.forEach((experiment) => {
          const values = normalizeTexts(experiment.result_values[schema.key])
          values.forEach((value) => {
            map.set(value, (map.get(value) ?? 0) + 1)
          })
        })

        const rows = Array.from(map.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count)

        return { schema, rows }
      }),
    [nonQuantitativeSchemas, visibleExperiments],
  )

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
    <div className="page-stack analysis-flow">
      <header className="page-header">
        <div className="stack-xs">
          <h1 className="section-title">물성 비교</h1>
          <p className="small">선택한 실험의 정량·정성 결과를 표와 차트로 비교합니다.</p>
        </div>
        <div className="section-actions">
          <Link className="btn btn-secondary" to={`/projects/${projectId}`}>
            프로젝트 설정
          </Link>
          <Link className="btn btn-secondary" to={`/projects/${projectId}/recipe-compare`}>
            배합비 비교
          </Link>
          <Link className="btn" to={`/projects/${projectId}/experiments/new`}>
            실험 추가
          </Link>
        </div>
      </header>

      {error && <div className="small text-danger">{error}</div>}

      <section className="analysis-stage">
        <div className="analysis-stage-header">
          <div className="analysis-stage-label">1. Selection</div>
          <h2 className="section-title">비교 대상 선택</h2>
          <p className="small">분석에 포함할 실험과 정렬 기준을 먼저 선택합니다.</p>
        </div>

        <div className="analysis-control-grid">
          <section className="card analysis-card-subtle">
            <div className="section-header">
              <div className="stack-xs">
                <h3 className="section-title">실험 선택</h3>
                <p className="small">비교할 실험을 여러 개 선택합니다.</p>
              </div>
              <div className="section-actions">
                <button className="btn-secondary btn-small" onClick={() => setSelectedExperimentIds(experiments.map((exp) => exp.id))}>
                  전체 선택
                </button>
                <button className="btn-ghost btn-small" onClick={() => setSelectedExperimentIds([])}>
                  전체 해제
                </button>
              </div>
            </div>

            <div className="selection-panel">
              <div className="selection-summary">
                <span className="badge-neutral">선택 {selectedExperimentIds.length} / {experiments.length}</span>
              </div>
              <div className="selection-group">
                {experiments.map((exp) => {
                  const checked = selectedExperimentIds.includes(exp.id)
                  return (
                    <label key={exp.id} className={`selection-chip${checked ? ' selection-chip-active' : ''}`} title={exp.name}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleExperiment(exp.id)}
                      />
                      <span>{exp.name}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </section>

          <section className="card analysis-card-subtle">
            <div className="section-header">
              <div className="stack-xs">
                <h3 className="section-title">정렬 및 범위</h3>
                <p className="small">차트와 표에 반영될 정렬 순서를 지정합니다.</p>
              </div>
            </div>

            <div className="selection-panel">
              <div className="field-group">
                <label className="small">실험일 정렬</label>
                <select className="input full-width" value={sortOrder} onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}>
                  <option value="desc">내림차순 (최신 우선)</option>
                  <option value="asc">오름차순 (오래된 순)</option>
                </select>
              </div>
              <div className="selection-meta">
                <span className="badge">활성 실험 {sortedVisibleExperiments.length}건</span>
              </div>
            </div>
          </section>
        </div>
      </section>

      <section className="analysis-stage">
        <div className="analysis-stage-header">
          <div className="analysis-stage-label">2. Visualization</div>
          <h2 className="section-title">시각화</h2>
          <p className="small">선택한 실험 데이터를 차트 중심으로 비교합니다.</p>
        </div>

        <section className="card">
          <div className="section-header">
            <div className="stack-xs">
              <h3 className="section-title">정량 비교</h3>
              <p className="small">정량 항목을 막대, 선, 상관 차트로 비교합니다.</p>
            </div>
          </div>

          <div className="chart-grid viz-grid">
            <div className="card card-muted viz-card">
              <div className="section-header">
                <div className="stack-xs">
                  <h4 className="section-title">막대 차트</h4>
                  <p className="small">대표값 평균을 기준으로 항목별 크기를 비교합니다.</p>
                </div>
              </div>
              <div className="field-group">
                <label className="small">항목 선택</label>
                <select className="input full-width" value={barKey} onChange={(e) => setBarKey(e.target.value)}>
                  {quantitativeSchemas.map((schema) => (
                    <option key={schema.key} value={schema.key}>
                      {schema.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="chart-box">
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

            <div className="card card-muted viz-card">
              <div className="section-header">
                <div className="stack-xs">
                  <h4 className="section-title">선 차트</h4>
                  <p className="small">실험 순서에 따른 변화를 한 흐름으로 확인합니다.</p>
                </div>
              </div>
              <div className="field-group">
                <label className="small">항목 선택</label>
                <select className="input full-width" value={lineKey} onChange={(e) => setLineKey(e.target.value)}>
                  {quantitativeSchemas.map((schema) => (
                    <option key={schema.key} value={schema.key}>
                      {schema.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="chart-box">
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
          </div>

          <div className="card card-muted viz-card">
            <div className="section-header">
              <div className="stack-xs">
                <h4 className="section-title">상관 차트</h4>
                <p className="small">두 정량 항목의 관계를 산점도로 확인합니다.</p>
              </div>
              <div className="section-actions">
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
            </div>
            <div className="chart-box-tall">
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
          </div>
        </section>

        <section className="card">
          <div className="section-header">
            <div className="stack-xs">
              <h3 className="section-title">정성 분포</h3>
              <p className="small">정성값과 선택값의 빈도 분포를 보조 차트로 확인합니다.</p>
            </div>
          </div>

          {nonQuantDistributions.length === 0 ? (
            <div className="empty-state">비교 항목에 정성 또는 선택값이 포함되어 있지 않습니다.</div>
          ) : (
            <div className="stack-md">
              {nonQuantDistributions.map(({ schema, rows }) => (
                <div key={schema.key} className="card card-muted viz-card">
                  <div className="section-header">
                    <div className="stack-xs">
                      <h4 className="section-title">{schema.label}</h4>
                      <p className="small">선택된 실험 안에서 값 분포를 집계합니다.</p>
                    </div>
                    <span className="badge-neutral">{schema.value_type === 'qualitative' ? '정성값' : '선택값'}</span>
                  </div>

                  {rows.length === 0 ? (
                    <div className="empty-state">선택된 실험에 입력된 값이 없습니다.</div>
                  ) : (
                    <div className="chart-grid">
                      <div className="chart-box">
                        <ResponsiveContainer>
                          <BarChart data={rows}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="value" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="count" fill="#7c3aed" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="table-wrap">
                        <table className="table table-compact">
                          <thead>
                            <tr>
                              <th>값</th>
                              <th>빈도</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row) => (
                              <tr key={`${schema.key}-${row.value}`}>
                                <td>{row.value}</td>
                                <td>{row.count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </section>

      <section className="analysis-stage detail-stage">
        <div className="analysis-stage-header">
          <div className="analysis-stage-label">3. Detail</div>
          <h2 className="section-title">상세 테이블</h2>
          <p className="small">차트 해석을 보조하는 원본 비교 정보를 아래 표에서 확인합니다.</p>
        </div>

        <section className="card">
          <div className="section-header">
            <div className="stack-xs">
              <h3 className="section-title">실험 물성 비교 표</h3>
              <p className="small">선택된 실험의 메타데이터와 결과 평균값을 한 화면에서 비교합니다.</p>
            </div>
          </div>

          <div className="table-wrap">
            <table className="table table-compact table-sticky-header">
              <thead>
                <tr>
                  <th>실험명</th>
                  <th className="table-col-compact">실험일</th>
                  <th className="table-col-compact">입고일</th>
                  <th className="table-col-compact">의뢰자</th>
                  <th className="table-col-compact">작성자</th>
                  <th>실험조건</th>
                  {includedSchemas.map((schema) => (
                    <th key={schema.key} className="table-col-compact" title={schema.label}>
                      <span className="cell-wrap">{schema.label}</span>
                    </th>
                  ))}
                  <th className="table-col-actions">관리</th>
                </tr>
              </thead>
              <tbody>
                {sortedVisibleExperiments.length === 0 && (
                  <tr>
                    <td colSpan={7 + includedSchemas.length}>선택된 실험이 없습니다.</td>
                  </tr>
                )}
                {sortedVisibleExperiments.map((exp) => (
                  <tr key={exp.id}>
                    <td title={exp.name}>
                      <div className="table-name-primary">{exp.name}</div>
                    </td>
                    <td className="table-col-compact table-cell-readonly">
                      {exp.experiment_date ? new Date(exp.experiment_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="table-col-compact table-cell-readonly">
                      {exp.received_date ? new Date(exp.received_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="table-col-compact table-cell-readonly" title={exp.requester ?? '-'}>
                      <span className="cell-wrap">{exp.requester ?? '-'}</span>
                    </td>
                    <td className="table-col-compact table-cell-readonly" title={exp.author}>
                      <span className="cell-wrap">{exp.author}</span>
                    </td>
                    <td title={exp.purpose}>
                      <div className="cell-clip-2">{exp.purpose}</div>
                    </td>
                    {includedSchemas.map((schema) => {
                      const raw = exp.result_values[schema.key]
                      const nums = normalizeNumbers(raw)
                      if (schema.value_type === 'quantitative') {
                        const avg = mean(nums)
                        const shown = avg === null ? '-' : Number.isInteger(avg) ? String(avg) : avg.toFixed(2)
                        return (
                          <td key={schema.key} className="table-col-compact table-cell-readonly table-number" title={nums.length > 1 ? nums.join(', ') : shown}>
                            {shown}
                          </td>
                        )
                      }
                      return (
                        <td key={schema.key} className="table-col-compact table-cell-readonly" title={raw ? String(raw) : '-'}>
                          <span className="cell-wrap">{raw ? String(raw) : '-'}</span>
                        </td>
                      )
                    })}
                    <td className="table-col-actions">
                      <div className="table-actions">
                        <button className="btn-secondary btn-small" onClick={() => navigate(`/projects/${projectId}/experiments/${exp.id}/edit`)}>
                          수정
                        </button>
                        <button className="btn-ghost btn-small text-danger" onClick={() => void onDeleteExperiment(exp)}>
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
      </section>
    </div>
  )
}
