// src/pages/GerenciarFiliais.jsx
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { Link } from 'react-router-dom';

export default function GerenciarFiliais() {
  const [filiais, setFiliais] = useState([]);
  const [form, setForm] = useState({ uf: '', nome: '', cnpj: '' });

  // Carrega Filiais em Tempo Real
  useEffect(() => {
    const q = query(collection(db, "filiais"), orderBy("uf"));
    const unsub = onSnapshot(q, (snap) => {
      const lista = [];
      snap.forEach(doc => lista.push(doc.data()));
      setFiliais(lista);
    });
    return () => unsub();
  }, []);

  const salvarFilial = async (e) => {
    e.preventDefault();
    if (form.uf.length !== 2) return alert("UF deve ter 2 letras.");
    
    try {
      const ufUpper = form.uf.toUpperCase();
      await setDoc(doc(db, "filiais", ufUpper), {
        uf: ufUpper,
        nome: form.nome.toUpperCase(),
        cnpj: form.cnpj
      });
      alert("Unidade salva com sucesso!");
      setForm({ uf: '', nome: '', cnpj: '' });
    } catch (error) {
      alert("Erro: " + error.message);
    }
  };

  const deletarFilial = async (id) => {
    if(window.confirm("Remover esta unidade? Isso não apaga os custos lançados.")) {
      await deleteDoc(doc(db, "filiais", id));
    }
  };

  return (
    <div className="layout-fotus">
      <header className="header-fotus">
        <div className="header-content">
          <div className="logo-area"><span className="logo-text">FOTUS</span><span className="logo-sub">Expansão</span></div>
          <h1 className="page-title">Gestão de Unidades</h1>
          <Link to="/admin" className="btn-voltar">Voltar</Link>
        </div>
      </header>

      <main className="main-content">
        <div className="card-padrao">
          <h2>Cadastrar Nova Unidade</h2>
          <form onSubmit={salvarFilial} className="form-grid">
            <div className="form-group">
                <label>Sigla UF (ID)</label>
                <input required maxLength={2} value={form.uf} onChange={e => setForm({...form, uf: e.target.value})} placeholder="EX: PE" />
            </div>
            <div className="form-group">
                <label>Nome da Unidade / Estado</label>
                <input required value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Ex: PERNAMBUCO" />
            </div>
            <div className="form-group">
                <label>CNPJ (Opcional - Para NF)</label>
                <input value={form.cnpj} onChange={e => setForm({...form, cnpj: e.target.value})} placeholder="00.000.000/0000-00" />
            </div>
            <button type="submit" className="btn-salvar">Salvar Unidade</button>
          </form>

          <hr className="divisor"/>

          <h3>Unidades Ativas ({filiais.length})</h3>
          <div className="grid-filiais">
            {filiais.map(f => (
                <div key={f.uf} className="card-filial">
                    <div className="filial-info">
                        <span className="filial-uf">{f.uf}</span>
                        <span className="filial-nome">{f.nome}</span>
                        <span className="filial-cnpj">{f.cnpj || '-'}</span>
                    </div>
                    <button onClick={() => deletarFilial(f.uf)} className="btn-trash">🗑️</button>
                </div>
            ))}
          </div>
        </div>
      </main>

      <style>{`
        .layout-fotus { background-color: #f4f6f8; min-height: 100vh; font-family: 'Segoe UI', sans-serif; color: #333; }
        .header-fotus { background-color: #002B49; color: white; padding: 0 40px; height: 60px; display: flex; align-items: center; }
        .header-content { width: 100%; max-width: 1000px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
        .logo-text { font-weight: 800; font-size: 1.2rem; }
        .logo-sub { font-size: 0.6rem; color: #ccc; display: block; }
        .page-title { font-size: 1.1rem; margin: 0; }
        .btn-voltar { color: white; text-decoration: none; border: 1px solid rgba(255,255,255,0.3); padding: 5px 10px; border-radius: 4px; }
        
        .main-content { padding: 30px; max-width: 800px; margin: 0 auto; }
        .card-padrao { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border-top: 4px solid #F4A900; }
        
        .form-grid { display: flex; gap: 15px; align-items: flex-end; }
        .form-group { display: flex; flex-direction: column; gap: 5px; flex: 1; }
        .form-group label { font-weight: bold; font-size: 0.8rem; color: #555; }
        .form-group input { padding: 10px; border: 1px solid #ccc; border-radius: 4px; width: 100%; box-sizing: border-box; }
        .btn-salvar { background: #002B49; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; height: 42px; }
        
        .divisor { margin: 30px 0; border: 0; border-top: 1px solid #eee; }
        
        .grid-filiais { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; margin-top: 20px; }
        .card-filial { border: 1px solid #eee; padding: 15px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; background: #f8f9fa; }
        .filial-info { display: flex; flex-direction: column; }
        .filial-uf { font-weight: 900; font-size: 1.2rem; color: #002B49; }
        .filial-nome { font-size: 0.85rem; color: #555; }
        .filial-cnpj { font-size: 0.7rem; color: #999; }
        .btn-trash { background: none; border: none; cursor: pointer; font-size: 1.1rem; opacity: 0.5; }
        .btn-trash:hover { opacity: 1; color: red; }
      `}</style>
    </div>
  );
}