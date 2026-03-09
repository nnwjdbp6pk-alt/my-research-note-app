import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  type ResultSchema,
  createResultSchema,
  deleteResultSchema,
  getOutputConfig,
  getProject,
  listResultSchemas,
  updateResultSchema,
  upsertOutputConfig,
} from '../../api'

export default function ProjectDetailPage() {
  const { projectId: projectIdParam } = useParams()
  const projectId = Number(projectIdParam)

  const [projectName, setProjectName] = useState('')
  const [schemas, setSchemas] = useState<ResultSchema[]>([])
  const [includedKeys, setIncludedKeys] = useState<string[]>([])
  const [error, setError] = useState('')

  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  const [valueType, setValueType] = useState<'quantitative' | 'qualitative' | 'categorical'>('quantitative')
  const [unit, setUnit] = useState('')
  const [description, setDescription] = useState('')
  const [optionsText, setOptionsText] = useState('')
  const [order, setOrder] = useState(0)

  const sortedSchemas = useMemo(() => [...schemas].sort((a, b) => a.order - b.order), [schemas])

  async function refresh() {
    if (!projectId) return
    setError('')
    try {
      const [project, schemaRows, outputConfig] = await Promise.all([
        getProject(projectId),
        listResultSchemas(projectId),
        getOutputConfig(projectId),
      ])

      setProjectName(project.name)
      setSchemas(schemaRows)
      setIncludedKeys(outputConfig?.included_keys ?? [])

      const maxOrder = schemaRows.reduce((acc, item) => Math.max(acc, item.order), -1)
      setOrder(maxOrder + 1)
    } catch {
      setError('상세 정보를 불러오지 못했습니다.')
    }
  }

  useEffect(() => {
    void refresh()
  }, [projectId])

  async function onAddSchema() {
    if (!key.trim() || !label.trim()) {
      setError('키와 표시명은 필수입니다.')
      return
    }

    const options =
      valueType === 'categorical'
        ? optionsText
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
        : null

    if (valueType === 'categorical' && (!options || options.length === 0)) {
      setError('categorical 타입은 옵션을 1개 이상 입력해 주세요.')
      return
    }

    try {
      await createResultSchema({
        project_id: projectId,
        key: key.trim(),
        label: label.trim(),
        value_type: valueType,
        unit: unit.trim() || null,
        description: description.trim() || null,
        options,
        order,
      })

      setKey('')
      setLabel('')
      setValueType('quantitative')
      setUnit('')
      setDescription('')
      setOptionsText('')
      setError('')
      await refresh()
    } catch {
      setError('항목 생성에 실패했습니다. key 중복 여부를 확인해 주세요.')
    }
  }

  async function onUpdateSchema(schema: ResultSchema, patch: Partial<ResultSchema>) {
    try {
      await updateResultSchema(schema.id, patch)
      await refresh()
    } catch {
      setError('항목 수정에 실패했습니다.')
    }
  }

  async function onDeleteSchema(schema: ResultSchema) {
    const ok = window.confirm(`[${schema.label}] 항목을 삭제할까요?`)
    if (!ok) return

    try {
      await deleteResultSchema(schema.id)
      await refresh()
    } catch {
      setError('항목 삭제에 실패했습니다.')
    }
  }

  function toggleIncluded(keyToToggle: string) {
    setIncludedKeys((prev) =>
      prev.includes(keyToToggle)
        ? prev.filter((item) => item !== keyToToggle)
        : [...prev, keyToToggle],
    )
  }

  async function onSaveOutputConfig() {
    try {
      await upsertOutputConfig({ project_id: projectId, included_keys: includedKeys })
      setError('')
      alert('비교 화면 표시 항목이 저장되었습니다.')
    } catch {
      setError('표시 항목 저장에 실패했습니다.')
    }
  }

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <section className="card" style={{ flex: '0 0 320px' }}>
        <div className="small">PROJECT #{projectId}</div>
        <h2 style={{ marginTop: 6 }}>{projectName || '프로젝트'}</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          <Link className="btn" to={`/projects/${projectId}/experiments/new`}>
            실험 추가
          </Link>
          <Link className="btn btn-secondary" to={`/projects/${projectId}/output`}>
            물성 비교 보기
          </Link>
        </div>
      </section>

      <section className="card" style={{ flex: 1, minWidth: 680 }}>
        <h3 style={{ marginTop: 0 }}>실험 입력 항목(스키마) 설정</h3>
        <p className="small">배합량 및 실험조건 입력 필드를 프로젝트별로 정의합니다.</p>

        <div className="card" style={{ background: '#f8fafc' }}>
          <div className="row" style={{ gap: 8 }}>
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder="key (영문/숫자/_/-)"
              value={key}
              onChange={(e) => setKey(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
            />
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder="표시명"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <select
              className="input"
              value={valueType}
              onChange={(e) => setValueType(e.target.value as 'quantitative' | 'qualitative' | 'categorical')}
            >
              <option value="quantitative">정량값</option>
              <option value="qualitative">정성값</option>
              <option value="categorical">선택값</option>
            </select>
            <input
              className="input"
              style={{ width: 100 }}
              type="number"
              value={order}
              onChange={(e) => setOrder(Number(e.target.value))}
              placeholder="순서"
            />
          </div>
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder="단위(선택)"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
            <input
              className="input"
              style={{ flex: 2 }}
              placeholder="설명(선택)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {valueType === 'categorical' && (
              <input
                className="input"
                style={{ flex: 2 }}
                placeholder="옵션(콤마 구분)"
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
              />
            )}
            <button className="btn" onClick={onAddSchema}>
              항목 추가
            </button>
          </div>
        </div>

        {error && <div style={{ color: 'var(--danger-color)', marginBottom: 10 }}>{error}</div>}

        <table className="table">
          <thead>
            <tr>
              <th>비교 포함</th>
              <th>순서</th>
              <th>키</th>
              <th>표시명</th>
              <th>타입</th>
              <th>단위</th>
              <th>옵션</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {sortedSchemas.length === 0 && (
              <tr>
                <td colSpan={8}>정의된 항목이 없습니다.</td>
              </tr>
            )}
            {sortedSchemas.map((schema) => (
              <tr key={schema.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={includedKeys.includes(schema.key)}
                    onChange={() => toggleIncluded(schema.key)}
                  />
                </td>
                <td>
                  <input
                    className="input"
                    type="number"
                    value={schema.order}
                    onChange={(e) => void onUpdateSchema(schema, { order: Number(e.target.value) })}
                    style={{ width: 72 }}
                  />
                </td>
                <td>{schema.key}</td>
                <td>
                  <input
                    className="input"
                    value={schema.label}
                    onChange={(e) => void onUpdateSchema(schema, { label: e.target.value })}
                  />
                </td>
                <td>{schema.value_type}</td>
                <td>
                  <input
                    className="input"
                    value={schema.unit ?? ''}
                    onChange={(e) => void onUpdateSchema(schema, { unit: e.target.value || null })}
                  />
                </td>
                <td>{schema.options?.join(', ') ?? '-'}</td>
                <td>
                  <button
                    className="btn-small"
                    style={{ color: 'var(--danger-color)', border: 'none', background: 'transparent' }}
                    onClick={() => void onDeleteSchema(schema)}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
          <span className="small">체크한 항목이 물성 비교 화면의 테이블/차트에 표시됩니다.</span>
          <button className="btn" onClick={onSaveOutputConfig}>
            비교 항목 저장
          </button>
        </div>
      </section>
    </div>
  )
}
