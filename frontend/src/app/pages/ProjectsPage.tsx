import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createProject, listProjects, Project, deleteProject, updateProject } from '../../api' 

export default function ProjectsPage() {
  const [items, setItems] = useState<Project[]>([])
  const [name, setName] = useState('')
  const [type, setType] = useState<'REGULAR' | 'VOC'>('REGULAR')

  async function refresh() {
    const data = await listProjects()
    setItems(data)
  }

  useEffect(() => { refresh() }, [])

  async function onCreate() {
    if (!name.trim()) return
    await createProject({ 
      name: name.trim(), 
      project_type: type, 
      status: 'ONGOING' 
    })
    setName('')
    setType('REGULAR')
    await refresh()
  }

  async function onDelete(id: number) {
    if (!window.confirm("정말로 이 프로젝트를 삭제하시겠습니까? 관련 데이터가 모두 삭제됩니다.")) return;
    try {
      await deleteProject(id);
      await refresh();
    } catch (err) {
      alert("삭제 중 오류가 발생했습니다.");
    }
  }

  async function toggleStatus(project: Project) {
    const isOngoing = project.status === 'ONGOING';
    const newStatus = isOngoing ? 'CLOSED' : 'ONGOING';
    const msg = isOngoing ? "프로젝트를 종료하시겠습니까?" : "프로젝트를 다시 시작하시겠습니까?";
    
    if (window.confirm(msg)) {
      try {
        await updateProject(project.id, { status: newStatus });
        await refresh();
      } catch (err) {
        alert("상태 변경 중 오류가 발생했습니다.");
      }
    }
  }

  return (
    <div className="row" style={{ alignItems: 'flex-start', gap: '20px' }}>
      
      {/* 신규 프로젝트 생성 카드 */}
      <div className="card" style={{ flex: '0 0 320px', boxSizing: 'border-box' }}>
        <h3>새 프로젝트 생성</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input 
            className="input" 
            style={{ width: '100%', boxSizing: 'border-box' }} 
            placeholder="프로젝트 명을 입력하세요" 
            value={name} 
            onChange={e => setName(e.target.value)} 
          />
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="small" style={{ fontWeight: 'bold' }}>프로젝트 유형</label>
            <select 
              className="input" 
              style={{ width: '100%', boxSizing: 'border-box' }}
              value={type}
              onChange={e => setType(e.target.value as 'REGULAR' | 'VOC')}
            >
              <option value="REGULAR">정규 과제 (Regular)</option>
              <option value="VOC">비정규 과제 (VOC)</option>
            </select>
          </div>

          <button className="btn" onClick={onCreate} style={{ width: '100%', marginTop: '5px' }}>
            생성하기
          </button>
        </div>
      </div>

      {/* 프로젝트 목록 카드 */}
      <div className="card" style={{ flex: '2 1 520px' }}>
        <h3>프로젝트 목록</h3>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '50px' }}>번호</th>
              <th>프로젝트명</th>
              <th style={{ width: '100px' }}>유형</th>
              <th style={{ width: '100px' }}>상태</th>
              <th style={{ width: '200px', textAlign: 'center' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>
                  등록된 프로젝트가 없습니다.
                </td>
              </tr>
            ) : (
              items.map(p => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td><strong>{p.name}</strong></td>
                  <td>
                    <span style={{ 
                      fontSize: '0.85em', 
                      padding: '2px 6px', 
                      borderRadius: '4px',
                      backgroundColor: p.project_type === 'VOC' ? '#fef3c7' : '#f3f4f6',
                      color: p.project_type === 'VOC' ? '#92400e' : '#374151'
                    }}>
                      {p.project_type === 'VOC' ? 'VOC' : '정규'}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: p.status === 'ONGOING' ? '#2563eb' : '#9ca3af' }}>
                      {p.status === 'ONGOING' ? '● 진행중' : '○ 종료됨'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <Link to={`/projects/${p.id}`} className="btn-small">열기</Link>
                    <button 
                      className="btn-small"
                      onClick={() => toggleStatus(p)}
                      style={{ 
                        marginLeft: '5px',
                        backgroundColor: p.status === 'ONGOING' ? '#f3f4f6' : '#d1fae5'
                      }}
                    >
                      {p.status === 'ONGOING' ? '종료' : '재개'}
                    </button>
                    <button 
                      onClick={() => onDelete(p.id)} 
                      style={{ marginLeft: '10px', color: '#ef4444', cursor: 'pointer', border: 'none', background: 'none', fontSize: '0.85em' }}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}