import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { type Experiment, listExperiments } from '../../api'

const COLORS = ['#2563eb', '#16a34a', '#f97316', '#9333ea', '#0ea5e9', '#e11d48', '#ca8a04', '#14b8a6']

export default function RecipeComparePage() {
  const { projectId: projectIdParam } = useParams()
  const projectId = Number(projectIdParam)

  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [selectedExperimentIds, setSelectedExperimentIds] = useState<number[]>([])
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([])
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [error, setError] = useState('')

  function getSortTimestamp(exp: Experiment): number {
    const base = exp.experiment_date || exp.created_at
    const ts = new Date(base).getTime()
    return Number.isNaN(ts) ? 0 : ts
  }

  async function refresh() {
    try {
      const rows = await listExperiments(projectId)
      setExperiments(rows)
      setSelectedExperimentIds(rows.map((row) => row.id))
      setError('')
    } catch {
      setError('배합비 데이터를 불러오지 못했습니다.')
    }
  }

  useEffect(() => {
    void refresh()
  }, [projectId])

  const visibleExperiments = useMemo(
    () => experiments.filter((experiment) => selectedExperimentIds.includes(experiment.id)),
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

  const materialNames = useMemo(() => {
    const names = new Set<string>()
    sortedVisibleExperiments.forEach((experiment) => {
      experiment.materials.forEach((material) => {
        const trimmed = material.name.trim()
        if (trimmed) names.add(trimmed)
      })
    })
    return Array.from(names)
  }, [sortedVisibleExperiments])

  useEffect(() => {
    setSelectedMaterials((prev) => {
      const valid = prev.filter((name) => materialNames.includes(name))
      if (valid.length > 0) return valid
      return materialNames
    })
  }, [materialNames])

  const activeMaterialNames = useMemo(
    () => materialNames.filter((name) => selectedMaterials.includes(name)),
    [materialNames, selectedMaterials],
  )

  const ratioChartData = useMemo(
    () =>
      sortedVisibleExperiments.map((experiment) => {
        const row: Record<string, string | number> = { name: experiment.name }
        activeMaterialNames.forEach((materialName) => {
          const found = experiment.materials.find((material) => material.name.trim() === materialName)
          row[materialName] = found ? Number(found.ratio.toFixed(2)) : 0
        })
        return row
      }),
    [sortedVisibleExperiments, activeMaterialNames],
  )

  const amountChartData = useMemo(
    () =>
      sortedVisibleExperiments.map((experiment) => {
        const row: Record<string, string | number> = { name: experiment.name }
        activeMaterialNames.forEach((materialName) => {
          const found = experiment.materials.find((material) => material.name.trim() === materialName)
          row[materialName] = found ? Number(found.amount) : 0
        })
        return row
      }),
    [sortedVisibleExperiments, activeMaterialNames],
  )

  function toggleExperiment(id: number) {
    setSelectedExperimentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  function toggleMaterial(materialName: string) {
    setSelectedMaterials((prev) =>
      prev.includes(materialName)
        ? prev.filter((item) => item !== materialName)
        : [...prev, materialName],
    )
  }

  return (
    <div className="page-stack analysis-flow">
      <header className="page-header">
        <div className="stack-xs">
          <h1 className="section-title">배합비 비교</h1>
          <p className="small">선택한 실험의 배합비와 투입량을 원료 기준으로 비교합니다.</p>
        </div>
        <div className="section-actions">
          <Link className="btn btn-secondary" to={`/projects/${projectId}`}>
            프로젝트 설정
          </Link>
          <Link className="btn btn-secondary" to={`/projects/${projectId}/output`}>
            물성 비교
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
          <p className="small">분석에 포함할 실험과 원료 범위를 먼저 정합니다.</p>
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
                <h3 className="section-title">원료 범위 및 정렬</h3>
                <p className="small">표시할 원료와 정렬 순서를 지정합니다.</p>
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
              <div className="selection-toolbar">
                <div className="selection-meta">
                  <span className="badge">활성 원료 {activeMaterialNames.length}건</span>
                </div>
                <div className="section-actions">
                  <button className="btn-secondary btn-small" onClick={() => setSelectedMaterials(materialNames)}>
                    전체 선택
                  </button>
                  <button className="btn-ghost btn-small" onClick={() => setSelectedMaterials([])}>
                    전체 해제
                  </button>
                </div>
              </div>
              <div className="selection-group">
                {materialNames.map((materialName) => {
                  const checked = selectedMaterials.includes(materialName)
                  return (
                    <label key={materialName} className={`selection-chip${checked ? ' selection-chip-active' : ''}`} title={materialName}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMaterial(materialName)}
                      />
                      <span>{materialName}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </section>
        </div>
      </section>

      <section className="analysis-stage">
        <div className="analysis-stage-header">
          <div className="analysis-stage-label">2. Visualization</div>
          <h2 className="section-title">시각화</h2>
          <p className="small">선택한 실험과 원료를 차트 중심으로 비교합니다.</p>
        </div>

        <section className="card">
          <div className="section-header">
            <div className="stack-xs">
              <h3 className="section-title">배합 시각화</h3>
              <p className="small">배합비 비중과 실제 투입량을 각각 차트로 확인합니다.</p>
            </div>
          </div>

          <div className="chart-grid viz-grid">
            <div className="card card-muted viz-card">
              <div className="section-header">
                <div className="stack-xs">
                  <h4 className="section-title">배합비 차트</h4>
                  <p className="small">원료별 배합비 비중을 스택 차트로 비교합니다.</p>
                </div>
              </div>

              {ratioChartData.length === 0 || activeMaterialNames.length === 0 ? (
                <div className="empty-state">표시할 배합 데이터가 없습니다.</div>
              ) : (
                <div className="chart-box-tall">
                  <ResponsiveContainer>
                    <BarChart data={ratioChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 100]} unit="%" />
                      <Tooltip />
                      <Legend />
                      {activeMaterialNames.map((materialName, index) => (
                        <Bar key={materialName} stackId="ratio" dataKey={materialName} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="card card-muted viz-card">
              <div className="section-header">
                <div className="stack-xs">
                  <h4 className="section-title">투입량 차트</h4>
                  <p className="small">원료별 실제 투입량을 실험 간 비교합니다.</p>
                </div>
              </div>

              {amountChartData.length === 0 || activeMaterialNames.length === 0 ? (
                <div className="empty-state">표시할 투입량 데이터가 없습니다.</div>
              ) : (
                <div className="chart-box-tall">
                  <ResponsiveContainer>
                    <BarChart data={amountChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      {activeMaterialNames.map((materialName, index) => (
                        <Bar key={materialName} dataKey={materialName} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </section>
      </section>

      <section className="analysis-stage detail-stage">
        <div className="analysis-stage-header">
          <div className="analysis-stage-label">3. Detail</div>
          <h2 className="section-title">상세 테이블</h2>
          <p className="small">차트 해석을 보조하는 원료별 상세 비교 정보를 아래 표에서 확인합니다.</p>
        </div>

        <section className="card">
          <div className="section-header">
            <div className="stack-xs">
              <h3 className="section-title">배합비 상세 표</h3>
              <p className="small">원료 기준 전치 테이블로 실험별 배합비와 투입량을 확인합니다.</p>
            </div>
          </div>

          <div className="table-wrap">
            <table className="table table-compact table-sticky-header">
              <thead>
                <tr>
                  <th className="table-col-compact">원료명</th>
                  {sortedVisibleExperiments.map((experiment) => (
                    <th key={experiment.id} title={experiment.name}>
                      <span className="cell-wrap">{experiment.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeMaterialNames.length === 0 && (
                  <tr>
                    <td colSpan={1 + sortedVisibleExperiments.length}>선택된 원료가 없습니다.</td>
                  </tr>
                )}
                {activeMaterialNames.map((materialName) => (
                  <tr key={materialName}>
                    <td className="table-col-compact table-cell-readonly" title={materialName}>
                      <span className="cell-wrap">{materialName}</span>
                    </td>
                    {sortedVisibleExperiments.map((experiment) => {
                      const found = experiment.materials.find((material) => material.name.trim() === materialName)
                      return (
                        <td key={`${materialName}-${experiment.id}`} title={found ? `${found.ratio.toFixed(2)}% (${found.amount}${found.unit})` : '-'}>
                          <span className="cell-wrap">
                            {found ? `${found.ratio.toFixed(2)}% (${found.amount}${found.unit})` : '-'}
                          </span>
                        </td>
                      )
                    })}
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
