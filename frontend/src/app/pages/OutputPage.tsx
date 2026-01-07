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
const calcStats = (values: number[]) => {
  if (!values || values.length === 0) return null;
  
  // 정렬
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  
  // 평균(Mean)
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;

  // 중앙값(Median) 및 사분위수(Q1, Q3)
  const getQuantile = (arr: number[], q: number) => {
    const pos = (arr.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (arr[base + 1] !== undefined) {
      return arr[base] + rest * (arr[base + 1] - arr[base]);
    } else {
      return arr[base];
    }
  };
  const q1 = getQuantile(sorted, 0.25);
  const median = getQuantile(sorted, 0.5);
  const q3 = getQuantile(sorted, 0.75);

  return { min, q1, median, q3, max, mean, raw: values };
};

const normalizeValue = (val: any): number[] => {
    if (Array.isArray(val)) return val.map(v => Number(v));
    if (typeof val === 'number') return [val];
    if (typeof val === 'string' && !isNaN(Number(val))) return [Number(val)];
    return [];
}

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
  refresh(); 
  }, [projectId]);

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

 // 1. getChartData 함수 정의 (여기서 끝냅니다)
const getChartData = (key: string) => {
  if (!key) return []
  return visibleExperiments.map(ex => {
    const rawVal = ex.result_values?.[key];
    const nums = normalizeValue(rawVal);
    
    if (nums.length === 0) return null;

    const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
    
    return {
      name: ex.name,
      value: Number(mean.toFixed(2))
    };
  }).filter(d => d !== null).reverse()
}; // <--- [중요] getChartData는 여기서 닫아주세요!


// 2. 원료명 추출 (컴포넌트 레벨에서 선언)
const allMaterialNames = useMemo(() => {
  const names = new Set<string>();
  visibleExperiments.forEach(ex => {
    ex.materials.forEach(m => names.add(m.name));
  });
  return Array.from(names).sort();
}, [visibleExperiments]);


// 3. 배합비 데이터 변환 (컴포넌트 레벨에서 선언)
const materialData = useMemo(() => {
  return visibleExperiments.map(ex => {
    const row: any = { name: ex.name };
    
    ex.materials.forEach(m => {
      row[m.name] = m.ratio;
      row[`${m.name}_amount`] = m.amount;
      row[`${m.name}_unit`] = m.unit;
    });
    return row;
  }).reverse();
}, [visibleExperiments]);

  const barData = useMemo(() => getChartData(barKey), [visibleExperiments, barKey])
  const lineData = useMemo(() => getChartData(lineKey), [visibleExperiments, lineKey])
  
  // 실험별 Box Plot 데이터 생성 로직
  const boxPlotSeries = useMemo(() => {
    if (!boxKey || visibleExperiments.length === 0) return []
    
    // 1. 전체 Y축 스케일을 잡기 위해 모든 데이터 수집
    let allNumbers: number[] = [];
    visibleExperiments.forEach(ex => {
        const nums = normalizeValue(ex.result_values?.[boxKey]);
        allNumbers = allNumbers.concat(nums);
    });
    
    if (allNumbers.length === 0) return []
    
    const globalMax = Math.max(...allNumbers);
    const globalMin = Math.min(...allNumbers);
    
    // 그래프 여백 설정
    const range = (globalMax - globalMin) || 1
    const padding = range * 0.2
    const yMin = globalMin - padding
    const yMax = globalMax + padding
    const yRange = yMax - yMin

    // 2. 실험별 통계 산출
    return visibleExperiments.map(ex => {
      const nums = normalizeValue(ex.result_values?.[boxKey]);
      if (nums.length === 0) return null;
      
      const stats = calcStats(nums); // 위에서 만든 함수 사용
      if (!stats) return null;

      // 좌표 변환 함수 (SVG 좌표계)
      const getPos = (v: number) => 180 - ((v - yMin) / yRange * 160)

      return {
        name: ex.name,
        stats: stats, // min, q1, median, q3, max 포함
        pos: {
          min: getPos(stats.min),
          q1: getPos(stats.q1),
          median: getPos(stats.median),
          q3: getPos(stats.q3),
          max: getPos(stats.max)
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
					{/* 1. Whisker (수염): Max ~ Min 전체 연결선 */}
					<line x1={x} y1={item.pos.min} x2={x} y2={item.pos.max} stroke="#ccc" strokeWidth="1" strokeDasharray="3" />
      
					{/* 2. Caps (최대/최소 가로선) */}
					<line x1={x - 10} y1={item.pos.min} x2={x + 10} y2={item.pos.min} stroke="#666" strokeWidth="2" />
					<line x1={x - 10} y1={item.pos.max} x2={x + 10} y2={item.pos.max} stroke="#666" strokeWidth="2" />

					{/* 3. Box (Q1 ~ Q3) : 진짜 박스 그리기 */}
					<rect 
						x={x - 20} 
						y={item.pos.q3} // SVG에서는 y좌표가 작을수록 위쪽이므로, q3(큰값)가 y좌표는 더 작아야 함(하지만 위 getPos식에서 이미 뒤집음. getPos(HighValue) -> Low Y)
						// 주의: getPos 로직상 값이 클수록 y좌표는 작아집니다 (0이 최상단). 
						// 따라서 y는 item.pos.q3 (화면상 위쪽), height는 (q1 - q3) 
						// (값: Q3 > Q1, 좌표: pos.Q3 < pos.Q1)
						width="40" 
						height={Math.abs(item.pos.q1 - item.pos.q3)} 
						fill="var(--primary-color)" 
						fillOpacity="0.3" 
						stroke="var(--primary-color)" 
						strokeWidth="2" 
					/>

					{/* 4. Median (중앙값) 가로선 */}
					<line x1={x - 20} y1={item.pos.median} x2={x + 20} y2={item.pos.median} stroke="#d946ef" strokeWidth="3" />
      
					{/* 5. 라벨 */}
					<text x={x} y="210" fontSize="10" fill="#666" textAnchor="middle" fontWeight="bold">
						{item.name.length > 8 ? item.name.substring(0, 8) + '..' : item.name}
					</text>
      
					{/* 평균값 텍스트 (박스 위에 표시) */}
					<text x={x} y={item.pos.max - 5} fontSize="10" fill="#666" textAnchor="middle">
						{item.stats.mean.toFixed(1)}
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
	  
	  <div className="card" style={{ marginBottom: '30px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '15px' }}>🧪 원료 배합 비교 (Recipe Comparison)</h3>       
        {/* 1. 배합 상세 비교 테이블 */}
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr style={{ backgroundColor: '#f0fdf4' }}> {/* 헤더 색상을 다르게 하여 결과표와 구분 */}
                <th style={{ minWidth: '150px' }}>실험명</th>
                {allMaterialNames.map(name => (
                  <th key={name} style={{ textAlign: 'center' , fontSize: '12px'}}>{name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleExperiments.map(ex => (
                <tr key={ex.id}>
                  <td><strong>{ex.name}</strong></td>
                  {allMaterialNames.map(name => {
                    // 해당 실험에 이 원료가 있는지 찾기
                    const mat = ex.materials.find(m => m.name === name);
                    return (
                      <td key={name} style={{ textAlign: 'center' }}>
                        {mat ? (
                          <div>
                            <span style={{ fontWeight: 'bold', color: '#2563eb', fontSize: '14px' }}>{mat.ratio.toFixed(1)}%</span>
                            <div style={{ fontSize: '0.8em', color: '#666' }}>({mat.amount}{mat.unit})</div>
                          </div>
                        ) : (
                          <span style={{ color: '#ccc' }}>-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
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
					{includedSchemas.map(s => {
					const rawVal = ex.result_values[s.key];
					// 1. 배열 형태든 단일 값이든 배열로 통일 (이전에 만든 헬퍼 함수 사용)
					const nums = normalizeValue(rawVal);
        
					let displayVal = '-';
					let tooltip = '';

					if (nums.length > 0) {
						// 2. 평균(Mean) 계산
						const mean = nums.reduce((sum, n) => sum + n, 0) / nums.length;
           
						// 3. 소수점 처리: 정수면 그대로, 실수면 소수점 3자리까지
						displayVal = Number.isInteger(mean) ? mean.toString() : mean.toFixed(2);
           
						// 4. 값이 여러 개라면 툴팁용 원본 문자열 생성
						if (nums.length > 1) {
							tooltip = `원본 데이터: [${nums.join(', ')}]`;
						}
					}

					return (
						<td 
							key={s.key} 
							title={tooltip} // 마우스 오버 시 원본 값 표시
							style={{ cursor: tooltip ? 'help' : 'default' }} // 툴팁이 있으면 커서 변경
						>
							{displayVal}
            
							{/* [선택 사항] 값이 여러 개(배열)인 경우 개수를 작게 표시해 주면 좋습니다 */}
							{tooltip && <span style={{ fontSize: '0.75em', color: '#999', marginLeft: '4px' }}>(n={nums.length})</span>}
						</td>
					)
					})}
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