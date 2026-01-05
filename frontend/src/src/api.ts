import axios from 'axios'

export const api = axios.create({ baseURL: 'http://127.0.0.1:8000' })

export type Project = {
  id: number
  name: string
  project_type: 'VOC' | 'REGULAR' | string
  expected_end_date: string | null
  status: 'ONGOING' | 'CLOSED' | string
  created_at: string
}

export type ResultSchema = {
  id: number
  project_id: number
  key: string
  label: string
  value_type: 'quantitative' | 'qualitative' | 'categorical' | string
  unit?: string | null
  description?: string | null
  options?: string[] | null
  created_at: string
}

export type OutputConfig = {
  id: number
  project_id: number
  included_keys: string[]
  created_at: string
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

export async function listProjects() {
  const r = await api.get<Project[]>('/api/projects')
  return r.data
}

export async function createProject(payload: { name: string; project_type?: 'VOC'|'REGULAR'; expected_end_date?: string|null; status?: 'ONGOING'|'CLOSED' }) {
  const r = await api.post<Project>('/api/projects', payload)
  return r.data
}

export async function getProject(projectId: number) {
  const r = await api.get<Project>(`/api/projects/${projectId}`)
  return r.data
}

export async function listResultSchemas(projectId: number) {
  const r = await api.get<ResultSchema[]>(`/api/projects/${projectId}/result-schemas`)
  return r.data
}

export async function createResultSchema(payload: { project_id: number; key: string; label: string; value_type: string; unit?: string|null; description?: string|null; options?: string[]|null }) {
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

export async function getOutputConfig(projectId: number) {
  const r = await api.get<OutputConfig | null>(`/api/projects/${projectId}/output-config`)
  return r.data
}

export async function upsertOutputConfig(payload: { project_id: number; included_keys: string[] }) {
  const r = await api.put<OutputConfig>('/api/output-config', payload)
  return r.data
}

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
