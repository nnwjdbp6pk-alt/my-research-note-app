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
  const [projectType, setProjectType] = useState<'REGULAR' | 'VOC'>('REGULAR')
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
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <section className="card" style={{ flex: '0 0 320px', position: 'sticky', top: 20 }}>
        <h3 style={{ marginTop: 0 }}>신규 프로젝트 생성</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          <label className="small">프로젝트명</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 점착제 조성 최적화"
          />

          <label className="small">프로젝트 유형</label>
          <select
            className="input"
            value={projectType}
            onChange={(e) => setProjectType(e.target.value as 'REGULAR' | 'VOC')}
          >
            <option value="REGULAR">REGULAR</option>
            <option value="VOC">VOC</option>
          </select>

          <button className="btn" onClick={onCreate} disabled={saving}>
            {saving ? '생성 중...' : '프로젝트 생성'}
          </button>
          {error && <div style={{ color: 'var(--danger-color)' }}>{error}</div>}
        </div>
      </section>

      <section className="card" style={{ flex: 1, minWidth: 540 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>프로젝트 목록</h3>
          <span className="small">총 {items.length}건</span>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>프로젝트명</th>
              <th>유형</th>
              <th>상태</th>
              <th>관리</th>
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
                  <td>{project.id}</td>
                  <td>
                    <strong>{project.name}</strong>
                    <div className="small">생성일: {new Date(project.created_at).toLocaleDateString()}</div>
                  </td>
                  <td>{project.project_type}</td>
                  <td>{project.status}</td>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <Link className="btn btn-small" to={`/projects/${project.id}`}>
                        상세
                      </Link>
                      <button className="btn btn-secondary btn-small" onClick={() => onToggleStatus(project)}>
                        {project.status === 'ONGOING' ? '종료' : '재개'}
                      </button>
                      <button
                        className="btn-small"
                        style={{ color: 'var(--danger-color)', border: 'none', background: 'transparent' }}
                        onClick={() => onDelete(project)}
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
