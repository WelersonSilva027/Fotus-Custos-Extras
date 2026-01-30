// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

// Importação das Páginas
import SolicitacaoExterna from './pages/SolicitacaoExterna';
import DashboardAdmin from './pages/DashboardAdmin';
import Login from './pages/Login';
import Transportadoras from './pages/Transportadoras';
import Analytics from './pages/Analytics';

import GerenciarUsuarios from './pages/GerenciarUsuarios';
import GerenciarFiliais from './pages/GerenciarFiliais';
import GerenciarMotivos from './pages/GerenciarMotivos';


// Componente de Segurança (Cadeado)
const RotaPrivada = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div style={{padding: 20}}>Carregando acesso...</div>;
  
  return user ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rota 1: Portal do Transportador (Pública) */}
        <Route path="/" element={<SolicitacaoExterna />} />
        
        {/* Rota 2: Login Admin */}
        <Route path="/login" element={<Login />} />
        
        {/* Rota 3: Torre de Controle (Privada) */}
        <Route path="/admin" element={
          <RotaPrivada>
            <DashboardAdmin />
          </RotaPrivada>
        } />

        {/* Rota 4: Gestão de Transportadoras (Privada) */}
        <Route path="/admin/transportadoras" element={
          <RotaPrivada>
            <Transportadoras />
          </RotaPrivada>
        } />

        {/* Rota 5: Analytics / BI (Privada) - NOVA ROTA */}
        <Route path="/admin/analises" element={
          <RotaPrivada>
            <Analytics />
          </RotaPrivada>
        } />

        <Route path="/admin/usuarios" element={
          <RotaPrivada>
            <GerenciarUsuarios />
          </RotaPrivada>
        } />

        <Route path="/admin/filiais" element={
          <RotaPrivada>
            <GerenciarFiliais />
          </RotaPrivada>
        } />

        <Route path="/admin/motivos" element={
          <RotaPrivada>
            <GerenciarMotivos />
          </RotaPrivada>
        } />

      </Routes>
    </BrowserRouter>
  );
}

export default App;