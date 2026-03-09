import axios from 'axios'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  (typeof window !== 'undefined'
    ? `http://${window.location.hostname}:8000`
    : 'http://localhost:8000')

const api = axios.create({ baseURL: API_BASE_URL })

export type Project = {
  id: number
  name: string
  project_type: 'VOC' | 'REGULAR'
  expected_end_date: string | null
  status: 'ONGOING' | 'CLOSED'
  created_at: string
}

export type ResultSchema = {
  id: number
  project_id: number
  key: string
  label: string
  value_type: 'quantitative' | 'qualitative' | 'categorical'
  unit?: string | null
  description?: string | null
  options?: string[] | null
  order: number
  created_at: string
}

export type OutputConfig = {
  id: number
  project_id: number
  included_keys: string[]
  created_at: string | null
}

export type Material = {
  name: string
  amount: number
  unit: 'g' | 'kg'
  ratio: number
}

export type Experiment = {
  id: number
  project_id: number
  name: string
  author: string
  purpose: string
  materials: Material[]
  result_values: Record<string, unknown>
  created_at: string
}

export async function listProjects() {
  const r = await api.get<Project[]>('/api/projects')
  return r.data
}

export async function createProject(payload: {
  name: string
  project_type?: 'VOC' | 'REGULAR'
  expected_end_date?: string | null
  status?: 'ONGOING' | 'CLOSED'
}) {
  const r = await api.post<Project>('/api/projects', payload)
  return r.data
}

export async function getProject(projectId: number) {
  const r = await api.get<Project>(`/api/projects/${projectId}`)
  return r.data
}

export async function updateProject(
  projectId: number,
  payload: Partial<Omit<Project, 'id' | 'created_at'>>,
) {
  const r = await api.patch<Project>(`/api/projects/${projectId}`, payload)
  return r.data
}

export async function deleteProject(projectId: number) {
  const r = await api.delete<{ ok: boolean }>(`/api/projects/${projectId}`)
  return r.data
}

export async function listResultSchemas(projectId: number) {
  const r = await api.get<ResultSchema[]>(`/api/projects/${projectId}/result-schemas`)
  return r.data.sort((a, b) => a.order - b.order)
}

export async function createResultSchema(
  payload: Omit<ResultSchema, 'id' | 'created_at'>,
) {
  const r = await api.post<ResultSchema>('/api/result-schemas', payload)
  return r.data
}

export async function updateResultSchema(
  schemaId: number,
  payload: Partial<Omit<ResultSchema, 'id' | 'project_id' | 'created_at' | 'key'>>,
) {
  const r = await api.patch<ResultSchema>(`/api/result-schemas/${schemaId}`, payload)
  return r.data
}

export async function deleteResultSchema(schemaId: number) {
  const r = await api.delete<{ ok: boolean }>(`/api/result-schemas/${schemaId}`)
  return r.data
}

export async function getOutputConfig(projectId: number) {
  const r = await api.get<OutputConfig | null>(`/api/projects/${projectId}/output-config`)
  return r.data
}

export async function upsertOutputConfig(payload: {
  project_id: number
  included_keys: string[]
}) {
  const r = await api.put<OutputConfig>('/api/output-config', payload)
  return r.data
}

export async function listExperiments(projectId: number) {
  const r = await api.get<Experiment[]>(`/api/projects/${projectId}/experiments`)
  return r.data
}

export async function getExperiment(experimentId: number) {
  const r = await api.get<Experiment>(`/api/experiments/${experimentId}`)
  return r.data
}

export async function createExperiment(payload: Omit<Experiment, 'id' | 'created_at'>) {
  const r = await api.post<Experiment>('/api/experiments', payload)
  return r.data
}

export async function updateExperiment(
  experimentId: number,
  payload: Partial<Omit<Experiment, 'id' | 'project_id' | 'created_at'>>,
) {
  const r = await api.patch<Experiment>(`/api/experiments/${experimentId}`, payload)
  return r.data
}

export async function deleteExperiment(experimentId: number) {
  const r = await api.delete<{ ok: boolean }>(`/api/experiments/${experimentId}`)
  return r.data
}
