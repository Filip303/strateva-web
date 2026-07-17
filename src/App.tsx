import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import About from './pages/About'
import Cookies from './pages/Cookies'
import Corridors from './pages/Corridors'
import Home from './pages/Home'
import HowItWorks from './pages/HowItWorks'
import LegalNotice from './pages/LegalNotice'
import Methodology from './pages/Methodology'
import NotFound from './pages/NotFound'
import Privacy from './pages/Privacy'
import Simulator from './pages/Simulator'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="simulator" element={<Simulator />} />
        <Route path="how-it-works" element={<HowItWorks />} />
        <Route path="corridors" element={<Corridors />} />
        <Route path="methodology" element={<Methodology />} />
        <Route path="about" element={<About />} />
        <Route path="legal/legal-notice" element={<LegalNotice />} />
        <Route path="legal/privacy" element={<Privacy />} />
        <Route path="legal/cookies" element={<Cookies />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
