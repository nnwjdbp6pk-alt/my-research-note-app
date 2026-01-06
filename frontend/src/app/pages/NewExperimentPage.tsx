import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'

/**
 * API 및 타입 정의
 */
const api = axios.create({ baseURL: 'http://127.0.0.1:8000' })

export type ResultSchema = {
  id: number
  project_id: number
  key: string
  label: string
  value_type: 'quantitative' | 'qualitative' | 'categorical'
  unit?: string | null
  options?: string[] | null
  order: number
}

export type Experiment = {
  id: number
  project_id: number
  name: string
  author: string
  purpose: string
  materials: { name: string; amount: number; unit: 'g'|'kg'; ratio: number }[]
  result_values: Record<string, any>
  created_at: string
}

const getExperiment = async (id: number) => (await api.get<Experiment>(`/api/experiments/${id}`)).data
const createExperiment = async (payload: any) => (await api.post<Experiment>('/api/experiments', payload)).data
const updateExperiment = async (id: number, payload: any) => (await api.patch<Experiment>(`/api/experiments/${id}`, payload)).data
const listResultSchemas = async (projectId: number) => {
  const r = await api.get<ResultSchema[]>(`/api/projects/${projectId}/result-schemas`)
  return r.data.sort((a, b) => a.order - b.order)
}

type MaterialLine = { name: string; amount: number; unit: 'g'|'kg'; ratio: number }

export default function NewExperimentPage() {
  const params = useParams()
  const projectId = Number(params.projectId)
  const experimentId = params.experimentId ? Number(params.experimentId) : null
  const nav = useNavigate()

  const [name, setName] = useState('')
  const [author, setAuthor] = useState('')
  const [purpose, setPurpose] = useState('')
  const [materials, setMaterials] = useState<MaterialLine[]>([{ name: '', amount: 0, unit: 'g', ratio: 0 }])
  const [schemas, setSchemas] = useState<ResultSchema[]>([])
  const [results, setResults] = useState<Record<string, any>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const s = await listResultSchemas(projectId)
        setSchemas(s)

        if (experimentId) {
          const ex = await getExperiment(experimentId)
          setName(ex.name)
          setAuthor(ex.author)
          setPurpose(ex.purpose)
          setMaterials(ex.materials)
          setResults(ex.result_values)
        }
      } catch (err) {
        setError('데이터를 불러오는 중 오류가 발생했습니다.')
      }
    })()
  }, [projectId, experimentId])

  const totalAmount = useMemo(() => {
    return materials.reduce((sum, m) => sum + (Number(m.amount) || 0), 0)
  }, [materials])

  function updateMaterial(idx: number, patch: Partial<MaterialLine>) {
    setMaterials(prev => {
      const next = prev.map((m, i) => i === idx ? { ...m, ...patch } : m)
      const newTotal = next.reduce((sum, m) => sum + (Number(m.amount) || 0), 0)
      return next.map(m => ({
        ...m,
        ratio: newTotal > 0 ? (Number(m.amount) / newTotal) * 100 : 0
      }))
    })
  }

  function addMaterial() {
    setMaterials(prev => [...prev, { name: '', amount: 0, unit: 'g', ratio: 0 }])
  }

  function removeMaterial(idx: number) {
    setMaterials(prev => {
      const next = prev.filter((_, i) => i !== idx)
      const newTotal = next.reduce((sum, m) => sum + (Number(m.amount) || 0), 0)
      return next.map(m => ({
        ...m,
        ratio: newTotal > 0 ? (Number(m.amount) / newTotal) * 100 : 0
      }))
    })
  }

  async function onSave() {
    setError('')
    if (!name.trim() || !author.trim() || !purpose.trim()) {
      setError('실험명, 작성자, 실험 목적은 필수 입력 항목입니다.')
      return
    }

    // 데이터 정제: 백엔드에서 500 에러를 유발할 수 있는 타입 불일치 방지
    const cleanedMaterials = materials
      .filter(m => m.name.trim() !== '')
      .map(m => ({
        name: m.name,
        amount: Number(m.amount),
        unit: m.unit,
        ratio: Number(Number(m.ratio).toFixed(2))
      }));

    // 결과값 정제: 빈 문자열은 저장하지 않음
    const cleanedResults: Record<string, any> = {};
    Object.keys(results).forEach(key => {
      if (results[key] !== '' && results[key] !== null && results[key] !== undefined) {
        cleanedResults[key] = results[key];
      }
    });
	
	schemas.forEach(schema => {
        const val = results[schema.key];
        
        // 값이 없으면 건너뜀
        if (val === null || val === undefined || val === '') return;
        
        if (schema.value_type === 'quantitative') {
            // [핵심] 여기서 최종적으로 숫자로 변환하여 전송
            cleanedResults[schema.key] = Number(val);
        } else {
            cleanedResults[schema.key] = val;
        }
    });
	
    const payload = {
      project_id: projectId,
      name: name.trim(),
      author: author.trim(),
      purpose: purpose.trim(),
      materials: cleanedMaterials,
      result_values: cleanedResults,
    };

    try {
      if (experimentId) {
        await updateExperiment(experimentId, payload)
      } else {
        await createExperiment(payload)
      }
      alert("성공적으로 저장되었습니다.");
      // 저장 성공 후 리다이렉트
      nav(`/projects/${projectId}/output`);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : '저장 중 서버 오류가 발생했습니다. (500)');
      console.error(err);
    }
  }

  return (
    <div className="card" style={{ maxWidth: '1000px', margin: '0 auto', boxSizing: 'border-box' }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: '25px', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
        <h2 style={{ margin: 0 }}>{experimentId ? '🧪 실험 수정' : '🧪 새 실험 기록'}</h2>
        <Link className="btn btn-secondary" to={`/projects/${projectId}/output`}>취소 및 돌아가기</Link>
      </div>

      <div className="row" style={{ gap: '20px', marginBottom: '20px' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <label className="small" style={{ fontWeight: 'bold', marginBottom: '6px' }}>실험명</label>
          <input className="input" style={{ width: '100%', boxSizing: 'border-box' }} placeholder="Batch A-1" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <label className="small" style={{ fontWeight: 'bold', marginBottom: '6px' }}>작성자</label>
          <input className="input" style={{ width: '100%', boxSizing: 'border-box' }} placeholder="성함" value={author} onChange={e => setAuthor(e.target.value)} />
        </div>
      </div>
      
      <div style={{ marginBottom: '30px', display: 'flex', flexDirection: 'column' }}>
        <label className="small" style={{ fontWeight: 'bold', marginBottom: '6px' }}>실험 목적 및 조건</label>
        <textarea className="input" style={{ width: '100%', minHeight: 100, boxSizing: 'border-box' }} placeholder="실험 조건을 상세히 기록하세요" value={purpose} onChange={e => setPurpose(e.target.value)} />
      </div>
      
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px' }}>원료 배합</h3>
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>원료명</th>
              <th>투입량</th>
              <th>단위</th>
              <th style={{ textAlign: 'center' }}>배합비(%)</th>
              <th style={{ textAlign: 'center' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((m, idx) => (
              <tr key={idx}>
                <td><input className="input" style={{ width: '100%' }} value={m.name} onChange={e => updateMaterial(idx, { name: e.target.value })} /></td>
                <td><input className="input" type="number" style={{ width: '100%' }} value={m.amount} onChange={e => updateMaterial(idx, { amount: Number(e.target.value) })} /></td>
                <td>
                  <select className="input" style={{ width: '100%' }} value={m.unit} onChange={e => updateMaterial(idx, { unit: e.target.value as any })}>
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                  </select>
                </td>
                <td style={{ textAlign: 'center' }}>{m.ratio.toFixed(2)}%</td>
                <td style={{ textAlign: 'center' }}>
                  <button className="btn-small" style={{ color: 'red' }} onClick={() => removeMaterial(idx)}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#f9fafb', fontWeight: 'bold' }}>
              <td colSpan={1} style={{ textAlign: 'right' }}>합계</td>
              <td>{totalAmount.toLocaleString()}</td>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        </table>
        <button className="btn-small" style={{ marginTop: 10 }} onClick={addMaterial}>+ 원료 추가</button>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px' }}>실험 결과</h3>
        <div className="card" style={{ backgroundColor: '#fafafa' }}>
          {schemas.map(s => (
            <div key={s.id} className="row" style={{ marginBottom: '15px', alignItems: 'center' }}>
              <div style={{ minWidth: '200px' }}>
                <strong>{s.label}</strong> {s.unit && <span className="small">({s.unit})</span>}
              </div>
              <div style={{ flex: 1 }}>
                {s.value_type === 'quantitative' ? (
                  <input 
				  className="input" 
				  type="number" // 브라우저 레벨에서 숫자 키패드 제공
				  step="any"    // 소수점 입력 허용
				  style={{ width: '100%' }} 
				  // [중요] null이면 빈 문자열로, 아니면 문자열 그대로 표시
				  value={results[s.key] ?? ''} 
				  onChange={e => {
					  const val = e.target.value;
						// [핵심] 입력 중에는 무조건 문자열로 저장하여 소수점 버그 방지
						setResults(prev => ({ ...prev, [s.key]: val === '' ? null : val }))
				  }} 
             />
                ) : s.value_type === 'categorical' ? (
                  <select className="input" style={{ width: '100%' }} value={results[s.key] ?? ''} onChange={e => setResults(prev => ({ ...prev, [s.key]: e.target.value }))}>
                    <option value="">선택하세요</option>
                    {(s.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input className="input" style={{ width: '100%' }} value={results[s.key] ?? ''} onChange={e => setResults(prev => ({ ...prev, [s.key]: e.target.value }))} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="row" style={{ marginTop: 30, gap: '15px', alignItems: 'center' }}>
        <button className="btn" style={{ padding: '10px 40px', fontSize: '1.1em' }} onClick={onSave}>
          저장하기
        </button>
        {error && <div style={{ color: 'red', fontWeight: 'bold' }}>⚠️ {error}</div>}
      </div>
    </div>
  )
}