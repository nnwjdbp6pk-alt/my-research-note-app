import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  type Project,
  createProject,
  deleteProject,
  listProjects,
  updateProject,
} from '../../api'

export default function ProjectsPage() {
  const navigate = useNavigate()

  const [items, setItems] = useState<Project[]>([])
  const [name, setName] = useState('')
  const [projectType, setProjectType] = useState<'REGULAR' | 'VOC' | 'PROPERTY_COMPARE'>('REGULAR')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      const data = await listProjects()
      setItems(data)
    } catch {
      setError('프로젝트 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function onCreate() {
    if (!name.trim()) {
      setError('프로젝트명을 입력해 주세요.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const created = await createProject({
        name: name.trim(),
        project_type: projectType,
        status: 'ONGOING',
      })
      setName('')
      setProjectType('REGULAR')
      await refresh()
      navigate(`/projects/${created.id}`)
    } catch {
      setError('프로젝트 생성에 실패했습니다. 동일한 이름인지 확인해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  async function onToggleStatus(project: Project) {
    const next = project.status === 'ONGOING' ? 'CLOSED' : 'ONGOING'
    try {
      await updateProject(project.id, { status: next })
      await refresh()
    } catch {
      setError('상태 변경에 실패했습니다.')
    }
  }

  async function onDelete(project: Project) {
    const ok = window.confirm(`[${project.name}] 프로젝트를 삭제할까요? 관련 실험 데이터도 함께 삭제됩니다.`)
    if (!ok) return

    try {
      await deleteProject(project.id)
      await refresh()
    } catch {
      setError('삭제 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div className="stack-xs">
          <h1 className="section-title">프로젝트</h1>
          <p className="small">실험 프로젝트를 생성하고 진행 상태를 관리합니다.</p>
        </div>
      </header>

      <div className="page-body with-sidebar">
        <aside className="page-sidebar">
          <section className="card">
            <div className="section-header">
              <div className="stack-xs">
                <h2 className="section-title">신규 프로젝트 생성</h2>
                <p className="small">프로젝트 기본 정보를 먼저 등록합니다.</p>
              </div>
            </div>

            <div className="stack-lg">
              <div className="field-group">
                <label className="small">프로젝트명</label>
                <input
                  className="input full-width"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 점착제 조성 최적화"
                />
              </div>

              <div className="field-group">
                <label className="small">프로젝트 유형</label>
                <select
                  className="input full-width"
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value as 'REGULAR' | 'VOC' | 'PROPERTY_COMPARE')}
                >
                  <option value="REGULAR">REGULAR</option>
                  <option value="VOC">VOC</option>
                  <option value="PROPERTY_COMPARE">물성비교(PROPERTY_COMPARE)</option>
                </select>
              </div>

              {error && <div className="small text-danger">{error}</div>}

              <div className="section-actions">
                <button className="btn" onClick={onCreate} disabled={saving}>
                  {saving ? '생성 중...' : '프로젝트 생성'}
                </button>
              </div>
            </div>
          </section>
        </aside>

        <div className="page-main">
          <section className="card">
            <div className="section-header">
              <div className="stack-xs">
                <h2 className="section-title">프로젝트 목록</h2>
                <p className="small">총 {items.length}건</p>
              </div>
            </div>

            <div className="table-wrap">
              <table className="table table-compact">
                <thead>
                  <tr>
                    <th className="table-col-id">ID</th>
                    <th>프로젝트명</th>
                    <th className="table-col-compact">유형</th>
                    <th className="table-col-status">상태</th>
                    <th className="table-col-actions">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={5}>불러오는 중...</td>
                    </tr>
                  )}
                  {!loading && items.length === 0 && (
                    <tr>
                      <td colSpan={5}>생성된 프로젝트가 없습니다.</td>
                    </tr>
                  )}
                  {!loading &&
                    items.map((project) => (
                      <tr key={project.id}>
                        <td className="table-col-id table-cell-readonly table-number">{project.id}</td>
                        <td className="table-name-cell">
                          <div className="stack-xs" title={project.name}>
                            <div className="table-name-primary cell-ellipsis">{project.name}</div>
                            <div className="small table-name-meta">생성일: {new Date(project.created_at).toLocaleDateString()}</div>
                          </div>
                        </td>
                        <td className="table-col-compact table-cell-readonly">
                          <span className={project.project_type === 'PROPERTY_COMPARE' ? 'badge-type' : 'badge-neutral'}>
                            {project.project_type}
                          </span>
                        </td>
                        <td className="table-col-status table-cell-readonly">
                          <span className={project.status === 'ONGOING' ? 'badge' : 'badge-neutral'}>
                            {project.status}
                          </span>
                        </td>
                        <td className="table-col-actions">
                          <div className="table-actions">
                            <Link className="btn btn-small" to={`/projects/${project.id}`}>
                              상세
                            </Link>
                            <button className="btn-secondary btn-small" onClick={() => onToggleStatus(project)}>
                              {project.status === 'ONGOING' ? '종료' : '재개'}
                            </button>
                            <button className="btn-ghost btn-small text-danger" onClick={() => onDelete(project)}>
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
