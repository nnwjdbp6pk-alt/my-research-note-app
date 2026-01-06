import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'

/**
 * API 및 타입 정의
 * 컴파일 오류를 방지하고 독립적인 실행이 가능하도록 통신 로직을 내부에 포함했습니다.
 */
const api = axios.create({ baseURL: 'http://127.0.0.1:8000' })

export type Project = {
  id: number
  name: string
  project_type: 'VOC' | 'REGULAR'
  expected_end_date: string | null
  status: 'ONGOING' | 'CLOSED'
  created_at: string
}

// API 함수 정의
const listProjects = async () => (await api.get<Project[]>('/api/projects')).data
const createProject = async (payload: any) => (await api.post<Project>('/api/projects', payload)).data
const deleteProject = async (id: number) => (await api.delete(`/api/projects/${id}`)).data
const updateProject = async (id: number, payload: any) => (await api.patch(`/api/projects/${id}`, payload)).data

/**
 * ProjectsPage: 연구 프로젝트의 전체 목록을 관리하고 새 프로젝트를 생성하는 메인 페이지입니다.
 */
export default function ProjectsPage() {
  // 상태 관리: 프로젝트 목록 및 입력 폼 데이터
  const [items, setItems] = useState<Project[]>([])
  const [name, setName] = useState('')
  const [type, setType] = useState<'REGULAR' | 'VOC'>('REGULAR')
  const [loading, setLoading] = useState(false)
  
  /**
   * 서버로부터 최신 프로젝트 목록을 불러와 상태를 갱신합니다.
   */
  async function refresh() {
    try {
      setLoading(true)
      const data = await listProjects()
      setItems(data)
    } catch (err) {
      console.error("프로젝트 목록 로드 실패:", err)
    } finally {
      setLoading(false)
    }
  }

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => { refresh() }, [])

  /**
   * 새 프로젝트 생성 처리
   */
  async function onCreate() {
    if (!name.trim()) {
      alert("프로젝트 명칭을 입력해 주세요.");
      return;
    }

    try {
      await createProject({ 
        name: name.trim(), 
        project_type: type, 
        status: 'ONGOING' 
      })
      // 입력 폼 초기화 및 목록 갱신
      setName('')
      setType('REGULAR')
      await refresh()
    } catch (err: any) {
      alert(`생성 실패: ${err.response?.data?.detail || "이미 존재하는 프로젝트명이거나 서버 오류입니다."}`);
    }
  }

  /**
   * 프로젝트 삭제 처리
   */
  async function onDelete(id: number) {
    if (!window.confirm("정말로 이 프로젝트를 삭제하시겠습니까?\n관련된 모든 실험 데이터와 설정이 영구적으로 삭제됩니다.")) return;
    
    try {
      await deleteProject(id);
      await refresh();
    } catch (err) {
      alert("삭제 중 오류가 발생했습니다.");
    }
  }

  /**
   * 프로젝트 상태(진행중/종료됨) 전환 처리
   */
  async function toggleStatus(project: Project) {
    const isOngoing = project.status === 'ONGOING';
    const newStatus = isOngoing ? 'CLOSED' : 'ONGOING';
    const msg = isOngoing 
      ? "프로젝트를 '종료됨' 상태로 변경하시겠습니까?\n종료된 프로젝트는 목록에서 구분되어 표시됩니다." 
      : "프로젝트를 다시 '진행중' 상태로 전환하시겠습니까?";
    
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
    <div className="row" style={{ alignItems: 'flex-start', gap: '24px' }}>
      
      {/* 1. 사이드바: 프로젝트 생성 카드 */}
      <div className="card" style={{ flex: '0 0 320px', position: 'sticky', top: '20px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>새 프로젝트 생성</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="small" style={{ fontWeight: 'bold' }}>프로젝트 명칭</label>
            <input 
              className="input" 
              style={{ width: '100%', boxSizing: 'border-box' }} 
              placeholder="예: 고점도 접착제 개발" 
              value={name} 
              onChange={e => setName(e.target.value)} 
            />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="small" style={{ fontWeight: 'bold' }}>과제 유형</label>
            <select 
              className="input" 
              style={{ width: '100%', boxSizing: 'border-box' }} 
              value={type} 
              onChange={e => setType(e.target.value as any)}
            >
              <option value="REGULAR">정규 과제 (Regular)</option>
              <option value="VOC">VOC/비정규 요청</option>
            </select>
          </div>

          <button 
            className="btn" 
            style={{ width: '100%', marginTop: '10px' }} 
            onClick={onCreate}
          >
            프로젝트 생성하기
          </button>
        </div>
      </div>

      {/* 2. 메인: 프로젝트 목록 테이블 */}
      <div className="card" style={{ flex: '1', minWidth: '600px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>전체 프로젝트 목록</h3>
          <span className="small">총 {items.length}개의 프로젝트</span>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '60px', textAlign: 'center' }}>번호</th>
              <th>프로젝트 명칭</th>
              <th style={{ width: '100px', textAlign: 'center' }}>유형</th>
              <th style={{ width: '120px', textAlign: 'center' }}>상태</th>
              <th style={{ width: '220px', textAlign: 'center' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px' }}>데이터를 불러오는 중...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#999' }}>등록된 프로젝트가 없습니다. 왼쪽 폼에서 첫 프로젝트를 생성해 보세요.</td></tr>
            ) : (
              items.map(p => (
                <tr key={p.id}>
                  <td style={{ textAlign: 'center', color: '#888' }}>{p.id}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '1.05rem' }}>{p.name}</strong>
                      {p.status === 'CLOSED' && <span className="small" style={{ color: '#ef4444' }}>(종료됨)</span>}
                    </div>
                    <div className="small">생성일: {new Date(p.created_at).toLocaleDateString()}</div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${p.project_type === 'VOC' ? 'badge-voc' : 'badge-regular'}`}>
                      {p.project_type === 'VOC' ? 'VOC' : '정규'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ 
                      color: p.status === 'ONGOING' ? 'var(--success-color)' : 'var(--text-muted)',
                      fontWeight: '600',
                      fontSize: '14px'
                    }}>
                      {p.status === 'ONGOING' ? '● 진행중' : '○ 종료됨'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div className="row" style={{ justifyContent: 'center', gap: '8px' }}>
                      <Link to={`/projects/${p.id}`} className="btn btn-small" style={{ padding: '6px 12px' }}>상세/설정</Link>
                      <button 
                        className="btn btn-secondary btn-small" 
                        onClick={() => toggleStatus(p)}
                        style={{ padding: '6px 12px' }}
                      >
                        {p.status === 'ONGOING' ? '종료' : '재개'}
                      </button>
                      <button 
                        className="btn-small" 
                        style={{ 
                          color: 'var(--danger-color)', 
                          border: 'none', 
                          background: 'none',
                          cursor: 'pointer'
                        }}
                        onClick={() => onDelete(p.id)}
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        <div style={{ marginTop: '20px', padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
          <p className="small" style={{ margin: 0 }}>
            * <strong>상세/설정</strong> 버튼을 클릭하여 실험 항목(Schema)을 정의하거나 리포트를 확인할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  )
}