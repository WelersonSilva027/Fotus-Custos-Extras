// src/pages/GerenciarMotivos.jsx
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { Link } from 'react-router-dom';

export default function GerenciarMotivos() {
  const [motivos, setMotivos] = useState([]);
  const [form, setForm] = useState({ 
    nome: '', 
    direcionamento: 'Logística', 
    centro_resultado: '' 
  });

  useEffect(() => {
    const q = query(collection(db, "motivos"), orderBy("nome"));
    const unsub = onSnapshot(q, (snap) => {
      const lista = [];
      snap.forEach(doc => lista.push(doc.data()));
      setMotivos(lista);
    });
    return () => unsub();
  }, []);

  const salvarMotivo = async (e) => {
    e.preventDefault();
    try {
      const id = form.nome.trim().toUpperCase(); // O ID será o nome do motivo
      await setDoc(doc(db, "motivos", id), {
        nome: form.nome, // Mantém a escrita original (ex: Zona Rural)
        direcionamento: form.direcionamento,
        centro_resultado: form.centro_resultado
      });
      alert("Motivo salvo com sucesso!");
      setForm({ nome: '', direcionamento: 'Logística', centro_resultado: '' });
    } catch (error) {
      alert("Erro: " + error.message);
    }
  };

  const deletarMotivo = async (id) => {
    if(window.confirm("Excluir este motivo?")) {
      await deleteDoc(doc(db, "motivos", id));
    }
  };

  return (
    <div className="layout-fotus">
      <header className="header-fotus">
        <div className="header-content">
          <div className="logo-area"><span className="logo-text">FOTUS</span><span className="logo-sub">Financeiro</span></div>
          <h1 className="page-title">Gestão de Motivos & C.R.</h1>
          <Link to="/admin" className="btn-voltar">Voltar</Link>
        </div>
      </header>

      <main className="main-content">
        <div className="card-padrao">
          <h2>Cadastrar Motivo de Custo Extra</h2>
          <form onSubmit={salvarMotivo} className="form-grid">
            <div className="form-group" style={{flex:2}}>
                <label>Descrição do Motivo</label>
                <input required value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Ex: Erro de Endereço Comercial" />
            </div>
            <div className="form-group">
                <label>Direcionamento (Setor)</label>
                <select value={form.direcionamento} onChange={e => setForm({...form, direcionamento: e.target.value})}>
                    <option value="Logística">Logística</option>
                    <option value="Comercial">Comercial</option>
                    <option value="Expedição">Expedição</option>
                    <option value="Financeiro">Financeiro</option>
                    <option value="Transportadora">Transportadora (Reembolso)</option>
                </select>
            </div>
            <div className="form-group">
                <label>Centro de Resultados (C.R.)</label>
                <input value={form.centro_resultado} onChange={e => setForm({...form, centro_resultado: e.target.value})} placeholder="Ex: 1105" />
            </div>
            <button type="submit" className="btn-salvar">Salvar</button>
          </form>

          <hr className="divisor"/>

          <div className="tabela-container">
            <table className="tabela-fotus">
                <thead><tr><th>Motivo</th><th>Setor Responsável</th><th>C.R. Padrao</th><th>Ação</th></tr></thead>
                <tbody>
                    {motivos.map(m => (
                        <tr key={m.nome}>
                            <td><strong>{m.nome}</strong></td>
                            <td><span className={`badge-setor ${m.direcionamento}`}>{m.direcionamento}</span></td>
                            <td>{m.centro_resultado || '-'}</td>
                            <td><button onClick={() => deletarMotivo(m.nome.toUpperCase())} className="btn-trash">🗑️</button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
        </div>
      </main>

      <style>{`
        .layout-fotus { background-color: #f4f6f8; min-height: 100vh; font-family: 'Segoe UI', sans-serif; color: #333; }
        .header-fotus { background-color: #002B49; color: white; padding: 0 40px; height: 60px; display: flex; align-items: center; }
        .header-content { width: 100%; max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
        .logo-text { font-weight: 800; font-size: 1.2rem; }
        .logo-sub { font-size: 0.6rem; color: #ccc; display: block; }
        .page-title { font-size: 1.1rem; margin: 0; }
        .btn-voltar { color: white; text-decoration: none; border: 1px solid rgba(255,255,255,0.3); padding: 5px 10px; border-radius: 4px; }
        .main-content { padding: 30px; max-width: 1000px; margin: 0 auto; }
        .card-padrao { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border-top: 4px solid #F4A900; }
        .form-grid { display: flex; gap: 15px; align-items: flex-end; }
        .form-group { display: flex; flex-direction: column; gap: 5px; flex: 1; }
        .form-group label { font-weight: bold; font-size: 0.8rem; color: #555; }
        .form-group input, select { padding: 10px; border: 1px solid #ccc; border-radius: 4px; width: 100%; box-sizing: border-box; }
        .btn-salvar { background: #002B49; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; height: 42px; }
        .divisor { margin: 30px 0; border: 0; border-top: 1px solid #eee; }
        .tabela-container { overflow-x: auto; }
        .tabela-fotus { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.9rem; }
        .tabela-fotus th { text-align: left; padding: 10px; background: #f8f9fa; border-bottom: 2px solid #ddd; }
        .tabela-fotus td { padding: 10px; border-bottom: 1px solid #eee; }
        .btn-trash { background: none; border: none; cursor: pointer; font-size: 1.1rem; opacity: 0.5; }
        .btn-trash:hover { opacity: 1; color: red; }
        
        /* Badges de Setor */
        .badge-setor { padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 0.8rem; color: white; }
        .Logística { background: #002B49; }
        .Comercial { background: #F4A900; color: #333; }
        .Expedição { background: #17a2b8; }
        .Financeiro { background: #28a745; }
        .Transportadora { background: #dc3545; }
      `}</style>
    </div>
  );
}