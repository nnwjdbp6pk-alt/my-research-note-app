import { type ChangeEvent, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  downloadTemplate,
  exportData,
  importData,
  type ResultSchema,
  createResultSchema,
  deleteResultSchema,
  getOutputConfig,
  getProject,
  listResultSchemas,
  updateResultSchema,
  upsertOutputConfig,
} from '../../api'

function getSchemaTypeMeta(valueType: ResultSchema['value_type']) {
  switch (valueType) {
    case 'quantitative':
      return { label: '정량값', className: 'badge' }
    case 'qualitative':
      return { label: '정성값', className: 'badge-neutral' }
    case 'categorical':
      return { label: '선택값', className: 'badge-type' }
  }
}

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

  const [ioFormat, setIoFormat] = useState<'csv' | 'xlsx'>('csv')
  const [importing, setImporting] = useState(false)
  const [ioMessage, setIoMessage] = useState('')

  const sortedSchemas = useMemo(
    () => [...schemas].sort((a, b) => a.order - b.order),
    [schemas],
  )

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
      await upsertOutputConfig({
        project_id: projectId,
        included_keys: includedKeys,
      })
      setError('')
      alert('비교 화면 표시 항목이 저장되었습니다.')
    } catch {
      setError('표시 항목 저장에 실패했습니다.')
    }
  }

  function saveBlob(blob: Blob, fileName: string) {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  }

  async function onDownloadTemplate() {
    try {
      const blob = await downloadTemplate(ioFormat)
      saveBlob(blob, `experiment_import_template.${ioFormat}`)
      setIoMessage('템플릿 다운로드 완료')
    } catch {
      setIoMessage('템플릿 다운로드 실패')
    }
  }

  async function onExportCurrentProject() {
    try {
      const blob = await exportData(ioFormat, projectId)
      saveBlob(blob, `project_${projectId}_export.${ioFormat}`)
      setIoMessage('프로젝트 데이터 다운로드 완료')
    } catch {
      setIoMessage('프로젝트 데이터 다운로드 실패')
    }
  }

  async function onImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setImporting(true)
    try {
      const summary = await importData(ioFormat, file)
      setIoMessage(
        `반영 완료: 프로젝트 생성 ${summary.projects_created}, 프로젝트 수정 ${summary.projects_updated}, 실험 생성 ${summary.experiments_created}, 실험 수정 ${summary.experiments_updated}, 원료 생성 ${summary.ingredients_created}, 원료 갱신 ${summary.ingredients_updated}, 스킵 ${summary.skipped_rows}`,
      )
      await refresh()
    } catch {
      setIoMessage('파일 반영 실패: 형식/컬럼/JSON 값을 확인해 주세요.')
    } finally {
      setImporting(false)
      event.target.value = ''
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div className="stack-xs">
          <div className="small">PROJECT #{projectId}</div>
          <h1 className="section-title">{projectName || '프로젝트'}</h1>
          <p className="small">실험 입력 스키마와 비교 화면 표시 항목을 관리합니다.</p>
        </div>
        <div className="section-actions">
          <Link className="btn btn-secondary" to={`/projects/${projectId}/recipe-compare`}>
            배합비 비교
          </Link>
          <Link className="btn btn-secondary" to={`/projects/${projectId}/output`}>
            물성 비교 보기
          </Link>
          <Link className="btn" to={`/projects/${projectId}/experiments/new`}>
            실험 추가
          </Link>
        </div>
      </header>

      <div className="page-body with-sidebar">
        <aside className="page-sidebar stack-lg">
          <section className="card">
            <div className="section-header">
              <div className="stack-xs">
                <h2 className="section-title">데이터 입출력</h2>
                <p className="small">템플릿 다운로드, 프로젝트 내보내기, 파일 반영을 수행합니다.</p>
              </div>
            </div>

            <div className="stack-md">
              <div className="field-group">
                <label className="small">파일 형식</label>
                <select
                  className="input full-width"
                  value={ioFormat}
                  onChange={(e) => setIoFormat(e.target.value as 'csv' | 'xlsx')}
                >
                  <option value="csv">CSV</option>
                  <option value="xlsx">XLSX</option>
                </select>
              </div>

              <button className="btn-secondary" onClick={onDownloadTemplate}>
                템플릿 다운로드
              </button>
              <button className="btn-secondary" onClick={onExportCurrentProject}>
                현재 프로젝트 내보내기
              </button>
              <label className="btn file-trigger">
                {importing ? '가져오는 중...' : '파일 업로드(재적용/업데이트)'}
                <input
                  type="file"
                  accept={
                    ioFormat === 'csv'
                      ? '.csv,text/csv'
                      : '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                  }
                  onChange={(e) => void onImportFile(e)}
                  disabled={importing}
                />
              </label>
              {ioMessage && <div className="small">{ioMessage}</div>}
            </div>
          </section>
        </aside>

        <div className="page-main stack-lg">
          <section className="card">
            <div className="section-header">
              <div className="stack-xs">
                <h2 className="section-title">실험 입력 항목 설정</h2>
                <p className="small">배합량 및 실험 조건 입력 필드를 프로젝트별로 정의합니다.</p>
              </div>
            </div>

            <div className="card card-muted">
              <div className="stack-lg">
                <div className="field-grid">
                  <div className="field-group">
                    <label className="small">key</label>
                    <input
                      className="input full-width"
                      placeholder="영문/숫자/_/-"
                      value={key}
                      onChange={(e) => setKey(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                    />
                  </div>
                  <div className="field-group">
                    <label className="small">표시명</label>
                    <input
                      className="input full-width"
                      placeholder="표시명"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                    />
                  </div>
                  <div className="field-group">
                    <label className="small">타입</label>
                    <select
                      className="input full-width"
                      value={valueType}
                      onChange={(e) =>
                        setValueType(e.target.value as 'quantitative' | 'qualitative' | 'categorical')
                      }
                    >
                      <option value="quantitative">정량값</option>
                      <option value="qualitative">정성값</option>
                      <option value="categorical">선택값</option>
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="small">순서</label>
                    <input
                      className="input full-width"
                      type="number"
                      value={order}
                      onChange={(e) => setOrder(Number(e.target.value))}
                      placeholder="순서"
                    />
                  </div>
                </div>

                <div className="field-grid">
                  <div className="field-group">
                    <label className="small">단위</label>
                    <input
                      className="input full-width"
                      placeholder="단위(선택)"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                    />
                  </div>
                  <div className="field-group">
                    <label className="small">설명</label>
                    <input
                      className="input full-width"
                      placeholder="설명(선택)"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                  {valueType === 'categorical' && (
                    <div className="field-group">
                      <label className="small">옵션</label>
                      <input
                        className="input full-width"
                        placeholder="옵션(콤마 구분)"
                        value={optionsText}
                        onChange={(e) => setOptionsText(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                <div className="form-actions">
                  {error ? <div className="small text-danger">{error}</div> : <div />}
                  <button className="btn" onClick={onAddSchema}>
                    항목 추가
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="section-header">
              <div className="stack-xs">
                <h2 className="section-title">스키마 목록</h2>
                <p className="small">체크한 항목이 물성 비교 화면의 테이블과 차트에 표시됩니다.</p>
              </div>
              <div className="section-actions">
                <button className="btn" onClick={onSaveOutputConfig}>
                  비교 항목 저장
                </button>
              </div>
            </div>

            <div className="table-wrap">
              <table className="table table-compact table-fixed schema-table table-sticky-header">
                <thead>
                  <tr>
                    <th className="schema-col-select">비교</th>
                    <th className="schema-col-order">순서</th>
                    <th className="schema-col-key">key</th>
                    <th className="schema-col-label">표시명</th>
                    <th className="schema-col-type">타입</th>
                    <th className="schema-col-unit">단위</th>
                    <th className="schema-col-options">옵션</th>
                    <th className="schema-col-actions table-col-actions">관리</th>
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
                      <td className="schema-cell-select table-cell-readonly">
                        <label className="check-item">
                          <input
                            type="checkbox"
                            checked={includedKeys.includes(schema.key)}
                            onChange={() => toggleIncluded(schema.key)}
                          />
                        </label>
                      </td>
                      <td className="schema-cell-order table-cell-input">
                        <input
                          className="input input-order"
                          type="number"
                          value={schema.order}
                          onChange={(e) => void onUpdateSchema(schema, { order: Number(e.target.value) })}
                        />
                      </td>
                      <td className="schema-cell-key table-cell-readonly" title={schema.key}>
                        <div className="readonly-cell readonly-cell-muted readonly-code">{schema.key}</div>
                      </td>
                      <td className="table-cell-input">
                        <input
                          className="input full-width"
                          value={schema.label}
                          onChange={(e) => void onUpdateSchema(schema, { label: e.target.value })}
                          title={schema.label}
                        />
                      </td>
                      <td className="schema-cell-type table-cell-readonly">
                        <span className={getSchemaTypeMeta(schema.value_type).className}>
                          {getSchemaTypeMeta(schema.value_type).label}
                        </span>
                      </td>
                      <td className="table-cell-input">
                        <input
                          className="input full-width"
                          value={schema.unit ?? ''}
                          onChange={(e) => void onUpdateSchema(schema, { unit: e.target.value || null })}
                          title={schema.unit ?? ''}
                        />
                      </td>
                      <td
                        className="schema-cell-options table-cell-readonly"
                        title={schema.options?.join(', ') ?? '-'}
                      >
                        <div className="readonly-cell readonly-cell-muted">
                          {schema.options && schema.options.length > 0 ? (
                            <div className="token-list">
                              {schema.options.map((option) => (
                                <span key={`${schema.id}-${option}`} className="token-chip">
                                  {option}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="small">-</span>
                          )}
                        </div>
                      </td>
                      <td className="schema-cell-actions table-col-actions">
                        <div className="table-actions">
                          <button className="btn-ghost btn-small text-danger" onClick={() => void onDeleteSchema(schema)}>
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
      </div>
    </div>
  )
}
