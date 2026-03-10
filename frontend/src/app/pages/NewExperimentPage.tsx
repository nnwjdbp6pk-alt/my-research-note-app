import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  type Experiment,
  type Ingredient,
  type Material,
  type Project,
  type ResultSchema,
  createExperiment,
  getExperiment,
  getProject,
  listIngredients,
  listExperiments,
  listResultSchemas,
  updateExperiment,
} from '../../api'

function normalizeMaterials(lines: Material[]): Material[] {
  const total = lines.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  return lines.map((item) => ({
    ...item,
    amount: Number(item.amount) || 0,
    ratio: total > 0 ? Number((((Number(item.amount) || 0) / total) * 100).toFixed(2)) : 0,
  }))
}

function normalizeResultValue(valueType: ResultSchema['value_type'], raw: unknown): unknown {
  if (raw === '' || raw === null || raw === undefined) return undefined

  if (valueType === 'quantitative') {
    if (typeof raw === 'number') return raw
    if (typeof raw === 'string') {
      if (raw.includes(',')) {
        const parsed = raw
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)
          .map((x) => Number(x))
          .filter((x) => !Number.isNaN(x))
        return parsed.length > 0 ? parsed : undefined
      }
      const n = Number(raw)
      return Number.isNaN(n) ? undefined : n
    }
    return undefined
  }

  return String(raw)
}

export default function NewExperimentPage() {
  const { projectId: projectIdParam, experimentId: experimentIdParam } = useParams()
  const projectId = Number(projectIdParam)
  const experimentId = experimentIdParam ? Number(experimentIdParam) : null
  const navigate = useNavigate()

  const [project, setProject] = useState<Project | null>(null)
  const [name, setName] = useState('')
  const [author, setAuthor] = useState('')
  const [purpose, setPurpose] = useState('')
  const [experimentConditions, setExperimentConditions] = useState('')
  const [experimentDate, setExperimentDate] = useState('')
  const [requester, setRequester] = useState('')
  const [receivedDate, setReceivedDate] = useState('')
  const [materials, setMaterials] = useState<Material[]>([{ name: '', amount: 0, unit: 'g', ratio: 0 }])
  const [schemas, setSchemas] = useState<ResultSchema[]>([])
  const [results, setResults] = useState<Record<string, unknown>>({})
  const [previousExperiments, setPreviousExperiments] = useState<Experiment[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [error, setError] = useState('')

  const isPropertyCompare = project?.project_type === 'PROPERTY_COMPARE'
  const pageTitle = experimentId
    ? isPropertyCompare
      ? '샘플 수정'
      : '실험 수정'
    : isPropertyCompare
      ? '신규 샘플 추가'
      : '신규 실험 추가'

  useEffect(() => {
    async function load() {
      try {
        const [projectRow, schemaRows, experimentRows, ingredientRows] = await Promise.all([
          getProject(projectId),
          listResultSchemas(projectId),
          listExperiments(projectId),
          listIngredients(undefined, 200),
        ])

        setProject(projectRow)
        setSchemas(schemaRows)
        setPreviousExperiments(experimentRows)
        setIngredients(ingredientRows)

        if (!experimentId) return

        const current = await getExperiment(experimentId)
        setName(current.name)
        setAuthor(current.author)
        setPurpose(current.purpose)
        setExperimentConditions(current.experiment_conditions ?? '')
        setExperimentDate(current.experiment_date ?? '')
        setRequester(current.requester ?? '')
        setReceivedDate(current.received_date ?? '')
        setMaterials(normalizeMaterials(current.materials))
        setResults(current.result_values)
      } catch {
        setError('실험 정보를 불러오지 못했습니다.')
      }
    }

    void load()
  }, [projectId, experimentId])

  const totalAmount = useMemo(
    () => materials.reduce((sum, line) => sum + (Number(line.amount) || 0), 0),
    [materials],
  )

  function updateMaterial(index: number, patch: Partial<Material>) {
    setMaterials((prev) => {
      const next = prev.map((line, i) => (i === index ? { ...line, ...patch } : line))
      return normalizeMaterials(next)
    })
  }

  function addMaterial() {
    setMaterials((prev) => [...prev, { name: '', amount: 0, unit: 'g', ratio: 0 }])
  }

  function removeMaterial(index: number) {
    setMaterials((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return normalizeMaterials(next.length > 0 ? next : [{ name: '', amount: 0, unit: 'g', ratio: 0 }])
    })
  }

  function copyMaterialsFromExperiment(targetExperimentId: string) {
    if (!targetExperimentId) return

    const target = previousExperiments.find((exp) => exp.id === Number(targetExperimentId))
    if (!target) return

    const ok = window.confirm(`[${target.name}]의 배합을 현재 실험에 불러올까요?`)
    if (!ok) return

    setMaterials(normalizeMaterials(target.materials))
  }

  async function onSave() {
    setError('')

    if (!name.trim()) {
      setError(isPropertyCompare ? '샘플명은 필수입니다.' : '실험명은 필수입니다.')
      return
    }

    if (!isPropertyCompare && (!author.trim() || !purpose.trim() || !experimentConditions.trim())) {
      setError('작성자, 실험 목적, 실험 조건은 필수입니다.')
      return
    }

    const cleanedMaterials = isPropertyCompare
      ? []
      : normalizeMaterials(
          materials
            .filter((line) => line.name.trim())
            .map((line) => ({
              name: line.name.trim(),
              amount: Number(line.amount) || 0,
              unit: line.unit,
              ratio: line.ratio,
            }))
            .filter((line) => line.amount > 0),
        )

    const cleanedResults: Record<string, unknown> = {}
    schemas.forEach((schema) => {
      const normalized = normalizeResultValue(schema.value_type, results[schema.key])
      if (normalized !== undefined) {
        cleanedResults[schema.key] = normalized
      }
    })

    try {
      const payload = {
        project_id: projectId,
        name: name.trim(),
        author: isPropertyCompare ? '-' : author.trim(),
        purpose: purpose.trim() || (isPropertyCompare ? '-' : ''),
        experiment_conditions: experimentConditions.trim() || null,
        experiment_date: experimentDate || null,
        requester: requester.trim() || null,
        received_date: receivedDate || null,
        materials: cleanedMaterials,
        result_values: cleanedResults,
      }

      if (experimentId) {
        await updateExperiment(experimentId, payload)
      } else {
        await createExperiment(payload)
      }

      navigate(`/projects/${projectId}/output`)
    } catch {
      setError('저장에 실패했습니다. 입력값을 확인해 주세요.')
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div className="stack-xs">
          <h1 className="section-title">{pageTitle}</h1>
          <p className="small">{project ? `${project.name} 프로젝트의 실험 데이터를 입력합니다.` : '실험 기본 정보와 결과값을 입력합니다.'}</p>
        </div>
        <div className="section-actions">
          <Link className="btn btn-secondary" to={`/projects/${projectId}/output`}>
            취소
          </Link>
          <button className="btn" onClick={onSave}>
            {experimentId ? '수정 저장' : '저장'}
          </button>
        </div>
      </header>

      <section className="card">
        <div className="section-header">
          <div className="stack-xs">
            <h2 className="section-title">기본 정보</h2>
            <p className="small">실험 식별 정보와 기본 메타데이터를 입력합니다.</p>
          </div>
        </div>

        <div className="stack-lg">
          <div className="field-grid field-grid-form">
            <div className="field-group">
              <label className="small">{isPropertyCompare ? '샘플명' : '실험명'}</label>
              <input className="input full-width" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field-group">
              <label className="small">실험일</label>
              <input
                className="input full-width"
                type="date"
                value={experimentDate}
                onChange={(e) => setExperimentDate(e.target.value)}
              />
            </div>
            {isPropertyCompare ? (
              <>
                <div className="field-group">
                  <label className="small">입고일</label>
                  <input
                    className="input full-width"
                    type="date"
                    value={receivedDate}
                    onChange={(e) => setReceivedDate(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label className="small">의뢰자</label>
                  <input
                    className="input full-width"
                    value={requester}
                    onChange={(e) => setRequester(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <div className="field-group">
                <label className="small">작성자</label>
                <input className="input full-width" value={author} onChange={(e) => setAuthor(e.target.value)} />
              </div>
            )}
          </div>

          <div className="field-group">
            <label className="small">{isPropertyCompare ? '실험 목적(선택)' : '실험 목적'}</label>
            <textarea
              className="input full-width"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="실험 목적을 입력해 주세요."
            />
          </div>

          <div className="field-group">
            <label className="small">{isPropertyCompare ? '실험 조건(선택)' : '실험 조건'}</label>
            <textarea
              className="input full-width"
              value={experimentConditions}
              onChange={(e) => setExperimentConditions(e.target.value)}
              placeholder="실험 조건/환경/특이사항을 입력해 주세요."
            />
          </div>
        </div>
      </section>

      {!isPropertyCompare && (
        <section className="card">
          <div className="section-header">
            <div className="stack-xs">
              <h2 className="section-title">배합량 입력</h2>
              <p className="small">원료별 투입량과 배합비를 입력합니다.</p>
            </div>
            <div className="section-actions">
              <select
                className="input"
                onChange={(e) => {
                  copyMaterialsFromExperiment(e.target.value)
                  e.target.value = ''
                }}
                defaultValue=""
              >
                <option value="">기존 실험 배합 불러오기</option>
                {previousExperiments
                  .filter((exp) => exp.id !== experimentId)
                  .map((exp) => (
                    <option key={exp.id} value={exp.id}>
                      [{new Date(exp.created_at).toLocaleDateString()}] {exp.name}
                    </option>
                  ))}
              </select>
              <button className="btn-secondary" onClick={addMaterial}>
                원료 추가
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="table table-compact">
              <thead>
                <tr>
                  <th>원료명</th>
                  <th className="table-col-compact">투입량</th>
                  <th className="table-col-compact">단위</th>
                  <th className="table-col-compact">배합비(%)</th>
                  <th className="table-col-actions">관리</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((line, index) => (
                  <tr key={index}>
                    <td className="table-cell-input">
                      <input
                        className="input full-width"
                        value={line.name}
                        list="ingredient-suggestions"
                        onChange={(e) => updateMaterial(index, { name: e.target.value })}
                      />
                    </td>
                    <td className="table-cell-input">
                      <input
                        className="input full-width"
                        type="number"
                        step="any"
                        value={line.amount}
                        onChange={(e) => updateMaterial(index, { amount: Number(e.target.value) })}
                      />
                    </td>
                    <td className="table-cell-input">
                      <select
                        className="input full-width"
                        value={line.unit}
                        onChange={(e) => updateMaterial(index, { unit: e.target.value as 'g' | 'kg' })}
                      >
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                      </select>
                    </td>
                    <td className="table-col-compact table-cell-readonly table-number">{line.ratio.toFixed(2)}%</td>
                    <td className="table-col-actions">
                      <div className="table-actions">
                        <button className="btn-ghost btn-small text-danger" onClick={() => removeMaterial(index)}>
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="table-cell-readonly" colSpan={3}>
                    <strong>총량</strong>
                  </td>
                  <td className="table-col-compact table-cell-readonly table-number">{totalAmount.toLocaleString()}</td>
                  <td className="table-cell-readonly" />
                </tr>
              </tfoot>
            </table>
          </div>

          <datalist id="ingredient-suggestions">
            {ingredients.map((ingredient) => (
              <option key={ingredient.id} value={ingredient.name} />
            ))}
          </datalist>
        </section>
      )}

      <section className="card">
        <div className="section-header">
          <div className="stack-xs">
            <h2 className="section-title">{isPropertyCompare ? '샘플 물성 입력' : '실험 물성/조건 입력'}</h2>
            <p className="small">프로젝트에 정의된 스키마 기준으로 값을 입력합니다.</p>
          </div>
        </div>

        <div className="card card-muted">
          {schemas.length === 0 ? (
            <div className="empty-state">프로젝트 상세에서 입력 항목을 먼저 정의해 주세요.</div>
          ) : (
            <div className="field-list">
              {schemas.map((schema) => (
                <div key={schema.id} className="field-grid field-grid-form">
                  <div className="field-group">
                    <label className="small">
                      <strong>{schema.label}</strong>
                      {schema.unit ? ` (${schema.unit})` : ''}
                    </label>
                  </div>
                  <div className="field-group grid-span-2">
                    {schema.value_type === 'quantitative' ? (
                      <input
                        className="input full-width"
                        type="text"
                        placeholder="예: 1200 또는 1200, 1180, 1210"
                        value={
                          Array.isArray(results[schema.key])
                            ? (results[schema.key] as number[]).join(', ')
                            : String(results[schema.key] ?? '')
                        }
                        onChange={(e) =>
                          setResults((prev) => ({
                            ...prev,
                            [schema.key]: e.target.value,
                          }))
                        }
                      />
                    ) : schema.value_type === 'categorical' ? (
                      <select
                        className="input full-width"
                        value={String(results[schema.key] ?? '')}
                        onChange={(e) =>
                          setResults((prev) => ({
                            ...prev,
                            [schema.key]: e.target.value,
                          }))
                        }
                      >
                        <option value="">선택</option>
                        {(schema.options ?? []).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="input full-width"
                        value={String(results[schema.key] ?? '')}
                        onChange={(e) =>
                          setResults((prev) => ({
                            ...prev,
                            [schema.key]: e.target.value,
                          }))
                        }
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="form-actions">
        {error ? <div className="small text-danger">{error}</div> : <div />}
        <div className="section-actions">
          <Link className="btn btn-secondary" to={`/projects/${projectId}/output`}>
            취소
          </Link>
          <button className="btn" onClick={onSave}>
            {experimentId ? '수정 저장' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
