import axios from 'axios'

export const api = axios.create({ baseURL: 'http://127.0.0.1:8000' })

// --- 프로젝트 타입 정의 ---
export type Project = {
  id: number
  name: string
  project_type: 'VOC' | 'REGULAR'
  expected_end_date: string | null
  status: 'ONGOING' | 'CLOSED'
  created_at: string
}

// --- 결과 스키마(측정 항목) 타입 정의 ---
export type ResultSchema = {
  id: number
  project_id: number
  key: string
  label: string
  value_type: 'quantitative' | 'qualitative' | 'categorical'
  unit?: string | null
  description?: string | null
  options?: string[] | null
  order: number // 백엔드에 추가된 정렬 순서 필드 반영
  created_at: string
}

export type OutputConfig = {
  id: number
  project_id: number
  included_keys: string[]
  created_at: string
}

// --- 실험 데이터 타입 정의 ---
export type Experiment = {
  id: number
  project_id: number
  name: string
  author: string
  purpose: string
  materials: {
    name: string;
    amount: number[];
    unit: 'g'|'kg';
    ratio: number
  }[]
  result_values: Record<string, any>
  created_at: string
}

// --- API 함수 목록 ---

// 프로젝트 관련
export async function listProjects() {
  const r = await api.get<Project[]>('/api/projects')
  return r.data
}

export async function createProject(payload: { 
  name: string; 
  project_type?: 'VOC'|'REGULAR'; 
  expected_end_date?: string|null; 
  status?: 'ONGOING'|'CLOSED' 
}) {
  const r = await api.post<Project>('/api/projects', payload)
  return r.data
}

export async function getProject(projectId: number) {
  const r = await api.get<Project>(`/api/projects/${projectId}`)
  return r.data
}

export async function updateProject(id: number, payload: Partial<Omit<Project, 'id'|'created_at'>>) {
  const r = await api.patch<Project>(`/api/projects/${id}`, payload)
  return r.data
}

export async function deleteProject(projectId: number) {
  const r = await api.delete(`/api/projects/${projectId}`)
  return r.data
}

// 결과 스키마 관련
export async function listResultSchemas(projectId: number) {
  const r = await api.get<ResultSchema[]>(`/api/projects/${projectId}/result-schemas`)
  // 백엔드에서 정렬해 오지만, 프론트엔드에서도 한 번 더 정렬 확인
  return r.data.sort((a, b) => a.order - b.order)
}

export async function createResultSchema(payload: Omit<ResultSchema, 'id'|'created_at'>) {
  const r = await api.post<ResultSchema>('/api/result-schemas', payload)
  return r.data
}

export async function updateResultSchema(schemaId: number, payload: Partial<Omit<ResultSchema, 'id'|'project_id'|'created_at'|'key'>>) {
  const r = await api.patch<ResultSchema>(`/api/result-schemas/${schemaId}`, payload)
  return r.data
}

export async function deleteResultSchema(schemaId: number) {
  const r = await api.delete(`/api/result-schemas/${schemaId}`)
  return r.data
}

// 출력 설정 관련
export async function getOutputConfig(projectId: number) {
  const r = await api.get<OutputConfig | null>(`/api/projects/${projectId}/output-config`)
  return r.data
}

export async function upsertOutputConfig(payload: { project_id: number; included_keys: string[] }) {
  const r = await api.put<OutputConfig>('/api/output-config', payload)
  return r.data
}

// 실험 관련
export async function listExperiments(projectId: number) {
  const r = await api.get<Experiment[]>(`/api/projects/${projectId}/experiments`)
  return r.data
}

export async function createExperiment(payload: Omit<Experiment, 'id'|'created_at'>) {
  const r = await api.post<Experiment>('/api/experiments', payload)
  return r.data
}

export async function updateExperiment(experimentId: number, payload: Partial<Omit<Experiment, 'id'|'project_id'|'created_at'>>) {
  const r = await api.patch<Experiment>(`/api/experiments/${experimentId}`, payload)
  return r.data
}

export async function deleteExperiment(experimentId: number) {
  const r = await api.delete(`/api/experiments/${experimentId}`)
  return r.data
}