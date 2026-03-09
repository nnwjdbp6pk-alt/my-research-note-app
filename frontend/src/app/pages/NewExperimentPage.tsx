import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  type Experiment,
  type Material,
  type ResultSchema,
  createExperiment,
  getExperiment,
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

  const [name, setName] = useState('')
  const [author, setAuthor] = useState('')
  const [purpose, setPurpose] = useState('')
  const [materials, setMaterials] = useState<Material[]>([{ name: '', amount: 0, unit: 'g', ratio: 0 }])
  const [schemas, setSchemas] = useState<ResultSchema[]>([])
  const [results, setResults] = useState<Record<string, unknown>>({})
  const [previousExperiments, setPreviousExperiments] = useState<Experiment[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [schemaRows, experimentRows] = await Promise.all([
          listResultSchemas(projectId),
          listExperiments(projectId),
        ])

        setSchemas(schemaRows)
        setPreviousExperiments(experimentRows)

        if (!experimentId) return

        const current = await getExperiment(experimentId)
        setName(current.name)
        setAuthor(current.author)
        setPurpose(current.purpose)
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

    if (!name.trim() || !author.trim() || !purpose.trim()) {
      setError('실험명, 작성자, 실험조건은 필수입니다.')
      return
    }

    const cleanedMaterials = normalizeMaterials(
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
        author: author.trim(),
        purpose: purpose.trim(),
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
    <div className="card" style={{ maxWidth: 1040, margin: '0 auto' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>{experimentId ? '실험 수정' : '신규 실험 추가'}</h2>
        <Link className="btn btn-secondary" to={`/projects/${projectId}/output`}>
          취소
        </Link>
      </div>

      <div className="row" style={{ marginTop: 20 }}>
        <div style={{ flex: 1 }}>
          <label className="small">실험명</label>
          <input className="input" style={{ width: '100%' }} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="small">작성자</label>
          <input
            className="input"
            style={{ width: '100%' }}
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <label className="small">실험조건</label>
        <textarea
          className="input"
          style={{ width: '100%', minHeight: 90 }}
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="온도/시간/교반 조건 등을 입력해 주세요."
        />
      </div>

      <div style={{ marginTop: 24 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>배합량 입력</h3>
          <select
            className="input"
            style={{ minWidth: 280 }}
            onChange={(e) => {
              copyMaterialsFromExperiment(e.target.value)
              e.target.value = ''
            }}
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
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>원료명</th>
              <th>투입량</th>
              <th>단위</th>
              <th>배합비(%)</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((line, index) => (
              <tr key={index}>
                <td>
                  <input
                    className="input"
                    style={{ width: '100%' }}
                    value={line.name}
                    onChange={(e) => updateMaterial(index, { name: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="input"
                    style={{ width: '100%' }}
                    type="number"
                    step="any"
                    value={line.amount}
                    onChange={(e) => updateMaterial(index, { amount: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <select
                    className="input"
                    style={{ width: '100%' }}
                    value={line.unit}
                    onChange={(e) => updateMaterial(index, { unit: e.target.value as 'g' | 'kg' })}
                  >
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                  </select>
                </td>
                <td>{line.ratio.toFixed(2)}%</td>
                <td>
                  <button
                    className="btn-small"
                    style={{ color: 'var(--danger-color)', border: 'none', background: 'transparent' }}
                    onClick={() => removeMaterial(index)}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ textAlign: 'right' }}>총량</td>
              <td>{totalAmount.toLocaleString()}</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
        <button className="btn-small" onClick={addMaterial}>
          원료 추가
        </button>
      </div>

      <div style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 10 }}>실험 물성/조건 입력</h3>
        <div className="card" style={{ background: '#fafafa' }}>
          {schemas.length === 0 && <div className="small">프로젝트 상세에서 입력 항목을 먼저 정의해 주세요.</div>}
          {schemas.map((schema) => (
            <div key={schema.id} className="row" style={{ alignItems: 'center', marginBottom: 10 }}>
              <div style={{ minWidth: 220 }}>
                <strong>{schema.label}</strong>{' '}
                {schema.unit ? <span className="small">({schema.unit})</span> : null}
              </div>
              <div style={{ flex: 1 }}>
                {schema.value_type === 'quantitative' ? (
                  <input
                    className="input"
                    style={{ width: '100%' }}
                    type="text"
                    placeholder="예: 1200 또는 1200, 1180, 1210"
                    value={Array.isArray(results[schema.key]) ? (results[schema.key] as number[]).join(', ') : String(results[schema.key] ?? '')}
                    onChange={(e) =>
                      setResults((prev) => ({
                        ...prev,
                        [schema.key]: e.target.value,
                      }))
                    }
                  />
                ) : schema.value_type === 'categorical' ? (
                  <select
                    className="input"
                    style={{ width: '100%' }}
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
                    className="input"
                    style={{ width: '100%' }}
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
      </div>

      <div className="row" style={{ marginTop: 20, alignItems: 'center' }}>
        <button className="btn" onClick={onSave}>
          {experimentId ? '수정 저장' : '실험 저장'}
        </button>
        {error && <div style={{ color: 'var(--danger-color)' }}>{error}</div>}
      </div>
    </div>
  )
}

