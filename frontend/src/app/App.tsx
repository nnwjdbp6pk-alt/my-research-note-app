import React from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import ProjectsPage from './pages/ProjectsPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import OutputPage from './pages/OutputPage'
import NewExperimentPage from './pages/NewExperimentPage'
import RecipeComparePage from './pages/RecipeComparePage'

export default function App() {
  return (
    <div className="page-shell">
      <header className="nav">
        <strong>ELN MVP</strong>
        <Link to="/">Projects</Link>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="/projects/:projectId/output" element={<OutputPage />} />
          <Route path="/projects/:projectId/recipe-compare" element={<RecipeComparePage />} />
          <Route path="/projects/:projectId/experiments/new" element={<NewExperimentPage />} />
          <Route path="/projects/:projectId/experiments/:experimentId/edit" element={<NewExperimentPage />} />
        </Routes>
      </main>
    </div>
  )
}
