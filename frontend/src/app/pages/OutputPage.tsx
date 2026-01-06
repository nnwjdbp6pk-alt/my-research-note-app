import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'

// 차트 시각화 라이브러리 (Recharts)
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, 
  CartesianGrid, ResponsiveContainer, LineChart, Line, 
  ScatterChart, Scatter
} from 'recharts'

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

export type OutputConfig = {
  id: number
  project_id: number
  included_keys: string[]
}

const listResultSchemas = async (projectId: number) => (await api.get<ResultSchema[]>(`/api/projects/${projectId}/result-schemas`)).data
const listExperiments = async (projectId: number) => (await api.get<Experiment[]>(`/api/projects/${projectId}/experiments`)).data
const getOutputConfig = async (projectId: number) => (await api.get<OutputConfig | null>(`/api/projects/${projectId}/output-config`)).data
const deleteExperiment = async (id: number) => (await api.delete(`/api/experiments/${id}`)).data

/**
 * OutputPage: 실험 필터링 및 실험별 비교 Box Plot이 포함된 분석 페이지
 */
export default function OutputPage() {
  const params = useParams()
  const projectId = Number(params.projectId)
  const navigate = useNavigate()

  const [schemas, setSchemas] = useState<ResultSchema[]>([])
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [included, setIncluded] = useState<string[]>([])
  
  // 그래프에 표시할 실험 ID 목록 상태
  const [selectedExpIds, setSelectedExpIds] = useState<number[]>([])

  // 개별 차트 항목 선택 상태
  const [barKey, setBarKey] = useState<string>('')
  const [lineKey, setLineKey] = useState<string>('')
  const [boxKey, setBoxKey] = useState<string>('') 
  const [scatterXKey, setScatterXKey] = useState<string>('')
  const [scatterYKey, setScatterYKey] = useState<string>('')

  const includedSchemas = useMemo(() => 
    schemas.filter(s => included.includes(s.key)).sort((a, b) => a.order - b.order), 
    [schemas, included]
  )
  const quantitativeSchemas = useMemo(() => 
    includedSchemas.filter(s => s.value_type === 'quantitative'), 
    [includedSchemas]
  )

  async function refresh() {
    try {
      const s = await listResultSchemas(projectId)
      setSchemas(s)
      const e = await listExperiments(projectId)
      setExperiments(e)
      
      if (selectedExpIds.length === 0 && e.length > 0) {
        setSelectedExpIds(e.map(ex => ex.id))
      }

      const oc = await getOutputConfig(projectId)
      const inclKeys = oc?.included_keys ?? []
      setIncluded(inclKeys)

      const qKeys = inclKeys.filter(k => s.find(x => x.key === k && x.value_type === 'quantitative'))
      if (qKeys.length > 0) {
        if (!barKey) setBarKey(qKeys[0])
        if (!lineKey) setLineKey(qKeys[0])
        if (!boxKey) setBoxKey(qKeys[0])
        if (!scatterXKey) setScatterXKey(qKeys[0])
        if (qKeys.length > 1 && !scatterYKey) setScatterYKey(qKeys[1])
      }
    } catch (err) {
      console.error("데이터 로드 실패:", err)
    }
  }

  useEffect(() => {
  // 현재 선택된 barKey가 유효한 정량적 스키마 목록에 없으면, 목록의 첫 번째로 재설정
  if (quantitativeSchemas.length > 0) {
    const validKeys = quantitativeSchemas.map(s => s.key);
    
    if (!barKey || !validKeys.includes(barKey)) setBarKey(validKeys[0]);
    if (!lineKey || !validKeys.includes(lineKey)) setLineKey(validKeys[0]);
    if (!boxKey || !validKeys.includes(boxKey)) setBoxKey(validKeys[0]);
    
    // Scatter는 X, Y 두 개가 필요하므로 조금 더 신경 씀
    if (!scatterXKey || !validKeys.includes(scatterXKey)) setScatterXKey(validKeys[0]);
    if (!scatterYKey || !validKeys.includes(scatterYKey)) {
        // 가능하다면 X와 다른 키를 Y로 기본 설정
        setScatterYKey(validKeys.length > 1 ? validKeys[1] : validKeys[0]);
    }
  }
}, [quantitativeSchemas]); // 스키마 목록이 바뀔 때마다 실행

  const toggleExpSelection = (id: number) => {
    setSelectedExpIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const selectAllExps = () => setSelectedExpIds(experiments.map(e => e.id))
  const deselectAllExps = () => setSelectedExpIds([])

  const visibleExperiments = useMemo(() => 
    experiments.filter(ex => selectedExpIds.includes(ex.id)),
    [experiments, selectedExpIds]
  )

  const getChartData = (key: string) => {
    if (!key) return []
    return visibleExperiments.map(ex => ({
      name: ex.name,
      value: Number(ex.result_values?.[key] ?? NaN)
    })).filter(d => !isNaN(d.value)).reverse()
  }

  const barData = useMemo(() => getChartData(barKey), [visibleExperiments, barKey])
  const lineData = useMemo(() => getChartData(lineKey), [visibleExperiments, lineKey])
  
  // 실험별 Box Plot 데이터 생성 로직
  const boxPlotSeries = useMemo(() => {
    if (!boxKey || visibleExperiments.length === 0) return []
    
    // Y축 스케일을 잡기 위한 전체 값 추출
    const allValues = visibleExperiments
      .map(ex => Number(ex.result_values?.[boxKey] ?? NaN))
      .filter(v => !isNaN(v))
    
    if (allValues.length === 0) return []
    
    const globalMax = Math.max(...allValues)
    const globalMin = Math.min(...allValues)
    const range = (globalMax - globalMin) || 1
    const padding = range * 0.1
    const yMin = globalMin - padding
    const yMax = globalMax + padding
    const yRange = yMax - yMin

    return visibleExperiments.map(ex => {
      const val = Number(ex.result_values?.[boxKey] ?? NaN)
      if (isNaN(val)) return null
      
      // 현재는 실험당 1개의 값이지만, 나중에 배열로 확장되어도 동작하도록 설계
      const vals = [val].sort((a, b) => a - b)
      
      const getPos = (v: number) => 180 - ((v - yMin) / yRange * 160)

      return {
        name: ex.name,
        raw: val,
        stats: {
          min: vals[0],
          q1: vals[0],
          median: vals[0],
          q3: vals[0],
          max: vals[0]
        },
        pos: {
          min: getPos(vals[0]),
          q1: getPos(vals[0]),
          median: getPos(vals[0]),
          q3: getPos(vals[0]),
          max: getPos(vals[0])
        }
      }
    }).filter(d => d !== null)
  }, [visibleExperiments, boxKey])
  
  const scatterData = useMemo(() => {
    if (!scatterXKey || !scatterYKey) return []
    return visibleExperiments.map(ex => ({
      name: ex.name,
      x: Number(ex.result_values?.[scatterXKey] ?? NaN),
      y: Number(ex.result_values?.[scatterYKey] ?? NaN),
    })).filter(d => !isNaN(d.x) && !isNaN(d.y))
  }, [visibleExperiments, scatterXKey, scatterYKey])

  async function onDeleteExperiment(id: number, name: string) {
    if (!window.confirm(`[${name}] 기록을 삭제하시겠습니까?`)) return
    try {
      await deleteExperiment(id)
      await refresh()
    } catch (err) {
      alert("삭제 실패")
    }
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>📊 분석 리포트 (프로젝트 #{projectId})</h2>
        <div className="row">
          <Link className="btn btn-secondary" to={`/projects/${projectId}`}>프로젝트 설정</Link>
          <Link className="btn" to={`/projects/${projectId}/experiments/new`}>+ 실험 추가</Link>
        </div>
      </div>

      <div className="card" style={{ backgroundColor: '#f8fafc', marginBottom: '30px' }}>
        <div className="row" style={{ gap: '30px', alignItems: 'flex-start' }}>
          
          <div style={{ flex: '1 1 300px' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: '10px' }}>
              <strong className="small">분석 대상 실험 선택 ({selectedExpIds.length}/{experiments.length})</strong>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button className="btn-small" onClick={selectAllExps} style={{ fontSize: '10px' }}>전체</button>
                <button className="btn-small" onClick={deselectAllExps} style={{ fontSize: '10px' }}>해제</button>
              </div>
            </div>
            <div style={{ 
              maxHeight: '120px', 
              overflowY: 'auto', 
              backgroundColor: 'white', 
              border: '1px solid #ddd', 
              borderRadius: '6px',
              padding: '8px'
            }}>
              {experiments.length === 0 ? (
                <div className="small" style={{ textAlign: 'center', padding: '10px' }}>실험 데이터가 없습니다.</div>
              ) : (
                experiments.map(ex => (
                  <label key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedExpIds.includes(ex.id)} 
                      onChange={() => toggleExpSelection(ex.id)} 
                    />
                    <span className="small" style={{ fontWeight: selectedExpIds.includes(ex.id) ? 'bold' : 'normal' }}>{ex.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div style={{ flex: '2 1 400px' }}>
             <strong className="small" style={{ display: 'block', marginBottom: '10px' }}>차트별 분석 항목 설정</strong>
             <div className="row" style={{ gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="small">Bar 항목</label>
                  <select className="input" style={{ fontSize: '12px', padding: '4px 8px' }} value={barKey} onChange={e => setBarKey(e.target.value)}>
                    <option value="">선택</option>
                    {quantitativeSchemas.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="small">Line 항목</label>
                  <select className="input" style={{ fontSize: '12px', padding: '4px 8px' }} value={lineKey} onChange={e => setLineKey(e.target.value)}>
                    <option value="">선택</option>
                    {quantitativeSchemas.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="small">Box Plot 항목</label>
                  <select className="input" style={{ fontSize: '12px', padding: '4px 8px' }} value={boxKey} onChange={e => setBoxKey(e.target.value)}>
                    <option value="">선택</option>
                    {quantitativeSchemas.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="small">Scatter X</label>
                  <select className="input" style={{ fontSize: '12px', padding: '4px 8px' }} value={scatterXKey} onChange={e => setScatterXKey(e.target.value)}>
                    <option value="">선택</option>
                    {quantitativeSchemas.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="small">Scatter Y</label>
                  <select className="input" style={{ fontSize: '12px', padding: '4px 8px' }} value={scatterYKey} onChange={e => setScatterYKey(e.target.value)}>
                    <option value="">선택</option>
                    {quantitativeSchemas.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
             </div>
          </div>
        </div>
      </div>

      <div className="row" style={{ gap: '20px', marginBottom: '30px' }}>
        <div className="card" style={{ flex: '1 1 48%', minWidth: '400px', boxSizing: 'border-box' }}>
          <strong className="small">실험별 비교 (Bar) : {barKey}</strong>
          <div style={{ width: '100%', height: 250, marginTop: '10px' }}>
            <ResponsiveContainer>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <ReTooltip />
                <Bar dataKey="value" fill="var(--primary-color)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ flex: '1 1 48%', minWidth: '400px', boxSizing: 'border-box' }}>
          <strong className="small">경향성 분석 (Line) : {lineKey}</strong>
          <div style={{ width: '100%', height: 250, marginTop: '10px' }}>
            <ResponsiveContainer>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <ReTooltip />
                <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ flex: '1 1 48%', minWidth: '400px', boxSizing: 'border-box' }}>
          <strong className="small">상관관계 (Scatter)</strong>
          <div style={{ width: '100%', height: 250, marginTop: '10px' }}>
            <ResponsiveContainer>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x" name={scatterXKey} fontSize={10} unit={schemas.find(s => s.key === scatterXKey)?.unit || ''} />
                <YAxis type="number" dataKey="y" name={scatterYKey} fontSize={10} unit={schemas.find(s => s.key === scatterYKey)?.unit || ''} />
                <ReTooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name="실험" data={scatterData} fill="#f97316" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 개별 실험별 Box Plot 차트 영역 */}
        <div className="card" style={{ flex: '1 1 48%', minWidth: '400px', boxSizing: 'border-box' }}>
          <strong className="small">실험별 데이터 분포 (Box Plot) : {boxKey}</strong>
          <div style={{ width: '100%', height: 250, marginTop: '10px', overflowX: 'auto' }}>
            {boxPlotSeries.length > 0 ? (
              <svg width={Math.max(400, boxPlotSeries.length * 80)} height="240" style={{ display: 'block', margin: '0 auto' }}>
                {boxPlotSeries.map((item, idx) => {
                  const x = 60 + idx * 80;
                  return (
                    <g key={idx}>
                      {/* 수직 Whisker 선 */}
                      <line x1={x} y1={item.pos.min} x2={x} y2={item.pos.max} stroke="#ccc" strokeWidth="2" strokeDasharray="3" />
                      
                      {/* 수염 끝부분 (Min/Max) */}
                      <line x1={x - 15} y1={item.pos.min} x2={x + 15} y2={item.pos.min} stroke="#666" strokeWidth="1.5" />
                      <line x1={x - 15} y1={item.pos.max} x2={x + 15} y2={item.pos.max} stroke="#666" strokeWidth="1.5" />

                      {/* Box (Q1 ~ Q3) - 현재 단일값이라 높이가 0이므로 강조 원형으로 대체 혹은 아주 얇은 박스 */}
                      <rect 
                        x={x - 20} 
                        y={item.pos.q1 - 2} 
                        width="40" 
                        height="4" 
                        fill="var(--primary-color)" 
                        fillOpacity="0.4" 
                        stroke="var(--primary-color)" 
                        strokeWidth="1" 
                      />

                      {/* 중앙값 (Median) - 강조 표시 */}
                      <line x1={x - 25} y1={item.pos.median} x2={x + 25} y2={item.pos.median} stroke="var(--primary-color)" strokeWidth="3" />
                      
                      {/* 실험명 라벨 (세로 혹은 생략) */}
                      <text x={x} y="210" fontSize="10" fill="#666" textAnchor="middle" fontWeight="bold">
                        {item.name.length > 8 ? item.name.substring(0, 8) + '..' : item.name}
                      </text>
                      
                      {/* 수치 라벨 */}
                      <text x={x} y={item.pos.median - 10} fontSize="10" fill="var(--primary-color)" textAnchor="middle" fontWeight="bold">
                        {item.raw}
                      </text>
                    </g>
                  );
                })}
                {/* Y축 가이드선 (임시) */}
                <line x1="30" y1="20" x2="30" y2="180" stroke="#eee" />
              </svg>
            ) : (
              <div className="small" style={{ color: '#999', textAlign: 'center', marginTop: '100px' }}>분석할 데이터가 없습니다.</div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0, marginBottom: '15px' }}>실험 상세 기록</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr style={{ backgroundColor: '#f9fafb' }}>
                <th>실험명</th>
                {includedSchemas.map(s => <th key={s.key}>{s.label}</th>)}
                <th style={{ textAlign: 'center' }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {experiments.map(ex => (
                <tr key={ex.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                       <span style={{ 
                         width: '10px', height: '10px', borderRadius: '50%', 
                         backgroundColor: selectedExpIds.includes(ex.id) ? 'var(--primary-color)' : '#ddd' 
                       }} title={selectedExpIds.includes(ex.id) ? "차트 포함 중" : "차트 제외됨"} />
                       <strong>{ex.name}</strong>
                    </div>
                  </td>
                  {includedSchemas.map(s => <td key={s.key}>{ex.result_values[s.key] ?? '-'}</td>)}
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                      <button className="btn-small" onClick={() => navigate(`/projects/${projectId}/experiments/${ex.id}/edit`)}>수정</button>
                      <button className="btn-small" style={{ color: 'var(--danger-color)' }} onClick={() => onDeleteExperiment(ex.id, ex.name)}>삭제</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}