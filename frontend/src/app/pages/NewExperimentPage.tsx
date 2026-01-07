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
const listExperiments = async (projectId: number) => (await api.get<Experiment[]>(`/api/projects/${projectId}/experiments`)).data


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
  const [experimentList, setExperimentList] = useState<Experiment[]>([]);
  
  useEffect(() => {
    (async () => {
      try {
        const s = await listResultSchemas(projectId)
        setSchemas(s)
		const exps = await listExperiments(projectId);
		setExperimentList(exps);

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

  function loadRecipeFromExperiment(targetIdStr: string) {
	  if (!targetIdStr) return;
	  // 실수 방지: 작성 중인 내용이 덮어씌워짐을 경고
      if (!window.confirm("현재 입력된 원료 목록이 사라지고 선택한 실험의 배합으로 대체됩니다. 진행하시겠습니까?")) {
      return;
    }
	
	const targetId = Number(targetIdStr);
	const targetExp = experimentList.find(e => e.id === targetId);
	
	if (targetExp && targetExp.materials) {
		const newMaterials: MaterialLine[] = targetExp.materials.map(m => ({
			name: m.name,
			amount: Number(m.amount), // 혹시 모를 문자열 변환 방지
			unit: m.unit,
			ratio: Number(m.ratio)
		}));
		
		setMaterials(newMaterials);
	}
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
        if (val === null || val === undefined || val === '') return;
        
        if (schema.value_type === 'quantitative') {
            // [수정] 쉼표로 구분된 문자열을 처리
            if (typeof val === 'string' && val.includes(',')) {
                // 1. 쉼표로 분리
                // 2. 공백 제거
                // 3. 빈 문자열 제외
                // 4. 숫자로 변환
                const numArr = val.split(',')
                    .map(v => v.trim())
                    .filter(v => v !== '')
                    .map(v => Number(v))
                    .filter(v => !isNaN(v)); // 유효한 숫자만 남김
                
                // 유효한 숫자가 하나라도 있으면 배열로 저장
                if (numArr.length > 0) {
                    cleanedResults[schema.key] = numArr;
                }
            } else {
                // 기존 로직: 단일 값 처리
                const numVal = Number(val);
                if (!isNaN(numVal)) {
                    cleanedResults[schema.key] = numVal; 
                }
            }
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
		<div style={{ marginBottom: '30px' }}>
			{/* [수정 5] 제목 영역을 flex로 변경하여 우측에 불러오기 버튼 배치 */}
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>
				<h3 style={{ margin: 0, border: 'none', padding: 0 }}>원료 배합</h3>
				
				{/* 배합 불러오기 드롭다운 */}
				<select
					className="input" 
					style={{ width: 'auto', minWidth: '250px', fontSize: '0.9em' }}
					onChange={(e) => {
						loadRecipeFromExperiment(e.target.value)
						e.target.value = ""; // 선택 후 다시 초기화 (같은 실험을 다시 선택할 수도 있으므로)
					}}
				>
					<option value="">📂 기존 실험에서 배합 가져오기...</option>
					{experimentList
						.filter(ex => ex.id !== experimentId) // 자기 자신은 제외 (수정 모드일 때)
						.map(ex => (
						<option key={ex.id} value={ex.id}>
							[{ex.created_at.substring(0, 10)}] {ex.name}
						</option>
					))}
				</select>
		</div>
		</div>
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
				  type="text"  // [변경] number -> text (쉼표 입력을 위해)
				  placeholder="예: 10, 10.5, 11" // [추가] 예시 제공
				  step="any"    // 소수점 입력 허용
				  style={{ width: '100%' }} 
				  // 배열이면 쉼표로 합쳐서 보여주고, 아니면 그대로 보여줌
				  value={Array.isArray(results[s.key]) ? results[s.key].join(', ') : (results[s.key] ?? '')}  
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