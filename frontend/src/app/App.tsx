import React from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import ProjectsPage from './pages/ProjectsPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import OutputPage from './pages/OutputPage'
import NewExperimentPage from './pages/NewExperimentPage'

export default function App() {
  return (
    <div>
      <div className="nav">
        <strong>ELN MVP</strong>
        <Link to="/">Projects</Link>
      </div>
      <div className="container">
        <Routes>
          <Route path="/" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="/projects/:projectId/output" element={<OutputPage />} />
          <Route path="/projects/:projectId/experiments/new" element={<NewExperimentPage />} />
        </Routes>
      </div>
    </div>
  )
}
