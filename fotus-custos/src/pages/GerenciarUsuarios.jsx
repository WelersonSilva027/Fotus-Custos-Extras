// src/pages/GerenciarUsuarios.jsx
import { useState, useEffect } from 'react';
import { db, firebaseConfig } from '../firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { Link } from 'react-router-dom';

export default function GerenciarUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [filiais, setFiliais] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingSave, setLoadingSave] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  
  // NOVOS ESTADOS PARA OS FILTROS
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroFilial, setFiltroFilial] = useState('');

  const [form, setForm] = useState({ id: null, nome: '', email: '', senha: '', filial: '', cargo: 'Aprovador', recebe_notificacao: false });

  // 1. Carregar dados
  useEffect(() => {
    const carregarDados = async () => {
      setLoadingData(true);
      try {
        const qFiliais = query(collection(db, "filiais"), orderBy("uf"));
        const snapFiliais = await getDocs(qFiliais);
        setFiliais(snapFiliais.docs.map(d => d.data()));

        const qUsuarios = query(collection(db, "usuarios"), orderBy("nome"));
        const snapUsuarios = await getDocs(qUsuarios);
        setUsuarios(snapUsuarios.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Erro:", error);
      } finally {
        setLoadingData(false);
      }
    };
    carregarDados();
  }, []);

  // LÓGICA DE FILTRAGEM (FRONT-END)
  const usuariosFiltrados = usuarios.filter(user => {
      const termo = termoBusca.toLowerCase();
      const matchTexto = user.nome.toLowerCase().includes(termo) || 
                         user.email.toLowerCase().includes(termo);
      
      const matchFilial = filtroFilial ? user.filial === filtroFilial : true;

      return matchTexto && matchFilial;
  });

  const abrirModal = (user = null) => {
    if (user) {
      setForm({ ...user, senha: '', recebe_notificacao: user.recebe_notificacao || false });
    } else {
      setForm({ id: null, nome: '', email: '', senha: '', filial: '', cargo: 'Aprovador', recebe_notificacao: false });
    }
    setModalAberto(true);
  };

  // Criação de Login "Fantasma"
  const criarLoginFirebase = async (email, senha) => {
    const tempApp = initializeApp(firebaseConfig, "AppTemporariaCriacao");
    const tempAuth = getAuth(tempApp);
    try {
        await createUserWithEmailAndPassword(tempAuth, email, senha);
        await signOut(tempAuth);
        return true;
    } catch (error) { throw error; }
  };

  const salvarUsuario = async () => {
    if (!form.nome || !form.email || !form.filial) return alert("Preencha campos obrigatórios.");
    if (!form.id && !form.senha) return alert("Defina uma senha inicial.");
    if (form.senha && form.senha.length < 6) return alert("Senha mínima de 6 caracteres.");

    setLoadingSave(true);
    try {
      if (!form.id) {
          try { await criarLoginFirebase(form.email, form.senha); } 
          catch (e) { if (e.code !== 'auth/email-already-in-use') throw new Error("Erro login: " + e.message); }
      }

      const payload = {
        nome: form.nome.toUpperCase(),
        email: form.email.toLowerCase(),
        filial: form.filial,
        cargo: form.cargo,
        recebe_notificacao: form.recebe_notificacao 
      };

      if (form.id) {
        await updateDoc(doc(db, "usuarios", form.id), payload);
        alert("✅ Atualizado!");
      } else {
        await addDoc(collection(db, "usuarios"), payload);
        alert("✅ Criado com sucesso!");
      }

      setModalAberto(false);
      const q = query(collection(db, "usuarios"), orderBy("nome"));
      const snap = await getDocs(q);
      setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));

    } catch (error) { alert("Erro: " + error.message); } 
    finally { setLoadingSave(false); }
  };

  const deletarUsuario = async (id) => {
    if (!window.confirm("⚠️ Bloquear acesso deste usuário?")) return;
    try {
        await deleteDoc(doc(db, "usuarios", id));
        setUsuarios(usuarios.filter(u => u.id !== id));
    } catch (e) { alert("Erro: " + e.message); }
  };

  return (
    <div className="admin-container">
      <header className="admin-header">
        <div className="header-grid">
            <div className="logo-area"><span className="logo-main">FOTUS</span><span className="logo-sub">Distribuidora Solar</span></div>
            <div className="title-area"><h2>Gestão de Usuários</h2></div>
            <div className="actions-area"><Link to="/admin" className="btn-voltar">← Voltar ao Dashboard</Link></div>
        </div>
      </header>

      <div className="content-wrapper">
        <div className="card-padrao">
            
            {/* ÁREA DE BUSCA E FILTROS */}
            <div className="filter-bar">
                <div className="search-group">
                    <input 
                        type="text" 
                        placeholder="🔍 Buscar por nome ou email..." 
                        value={termoBusca}
                        onChange={(e) => setTermoBusca(e.target.value)}
                        className="search-input"
                    />
                </div>
                <div className="filter-group">
                    <select 
                        value={filtroFilial} 
                        onChange={(e) => setFiltroFilial(e.target.value)}
                        className="filter-select"
                    >
                        <option value="">Todas as Filiais</option>
                        <option value="TODAS">TODAS (Master)</option>
                        {filiais.map(f => <option key={f.uf} value={f.uf}>{f.uf} - {f.nome}</option>)}
                    </select>
                </div>
                <button onClick={() => abrirModal()} className="btn-novo">➕ Novo Usuário</button>
            </div>

            <div className="card-header-line">
                <h3>Equipe Cadastrada ({usuariosFiltrados.length})</h3>
            </div>

            {loadingData ? (
                <div className="loading-state">Carregando usuários...</div>
            ) : usuariosFiltrados.length === 0 ? (
                <div className="empty-state">Nenhum usuário encontrado com estes filtros.</div>
            ) : (
                <div className="tabela-container">
                    <table className="tabela-users">
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>Email</th>
                                <th>Filial</th>
                                <th>Cargo</th>
                                <th style={{textAlign:'center'}}>Notificações</th>
                                <th style={{textAlign:'right'}}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {usuariosFiltrados.map(u => (
                                <tr key={u.id} className="usuario-row">
                                    <td><strong>{u.nome}</strong></td>
                                    <td>{u.email}</td>
                                    <td><span className="tag-filial">{u.filial}</span></td>
                                    <td><span className={`tag-cargo ${u.cargo.toLowerCase()}`}>{u.cargo}</span></td>
                                    <td style={{textAlign:'center'}}>
                                        {u.recebe_notificacao ? <span title="Recebe e-mails">🔔 Sim</span> : <span style={{opacity:0.3}}>🔕</span>}
                                    </td>
                                    <td style={{textAlign:'right'}}>
                                        <button onClick={() => abrirModal(u)} className="btn-icon edit" title="Editar">✏️</button>
                                        <button onClick={() => deletarUsuario(u.id)} className="btn-icon del" title="Bloquear">🗑️</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
      </div>

      {modalAberto && (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header"><h3>{form.id ? 'Editar' : 'Novo'} Usuário</h3></div>
                <div className="modal-body">
                    <div className="form-group"><label>Nome Completo</label><input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Ex: João Silva" /></div>
                    <div className="form-group"><label>E-mail (Login)</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} disabled={!!form.id} /></div>
                    {!form.id && (<div className="form-group"><label>Senha Inicial</label><input type="password" value={form.senha} onChange={e => setForm({...form, senha: e.target.value})} placeholder="Mínimo 6 caracteres" style={{borderColor:'#00b894'}}/><small style={{color:'#00b894', fontSize:'0.75rem'}}>*Senha para 1º acesso.</small></div>)}
                    
                    <div className="form-row">
                        <div className="form-col"><label>Filial</label><select value={form.filial} onChange={e => setForm({...form, filial: e.target.value})}><option value="">Selecione...</option><option value="TODAS">TODAS (Master)</option>{filiais.map(f => <option key={f.uf} value={f.uf}>{f.uf}</option>)}</select></div>
                        <div className="form-col"><label>Cargo</label><select value={form.cargo} onChange={e => setForm({...form, cargo: e.target.value})}><option value="Aprovador">Aprovador</option><option value="Master">Master</option><option value="Visualizador">Visualizador</option></select></div>
                    </div>
                    
                    <div className="checkbox-area">
                        <label className="check-label"><input type="checkbox" checked={form.recebe_notificacao} onChange={e => setForm({...form, recebe_notificacao: e.target.checked})} /><span>Receber e-mails de solicitações desta filial?</span></label>
                    </div>
                </div>
                <div className="modal-actions"><button onClick={() => setModalAberto(false)} className="btn-cancel" disabled={loadingSave}>Cancelar</button><button onClick={salvarUsuario} className="btn-confirm" disabled={loadingSave}>{loadingSave ? 'Salvando...' : 'Salvar'}</button></div>
            </div>
        </div>
      )}

      <style>{`
        .admin-container { padding: 0; background-color: #f4f6f8; min-height: 100vh; font-family: 'Segoe UI', sans-serif; }
        .admin-header { background-color: #002B49; color: white; height: 70px; display: flex; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2); padding: 0 40px; margin-bottom: 30px; }
        .header-grid { width: 100%; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; }
        .logo-area { display: flex; flex-direction: column; line-height: 1; }
        .logo-main { font-weight: 900; font-size: 1.4rem; letter-spacing: 1px; color: #fff; }
        .logo-sub { font-size: 0.6rem; color: #ccc; display: block; line-height: 0.8; }
        .title-area { text-align: center; }
        .title-area h2 { margin: 0; font-size: 1.2rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: white; }
        .actions-area { text-align: right; }
        .btn-voltar { color: white; text-decoration: none; border: 1px solid rgba(255,255,255,0.3); padding: 8px 16px; border-radius: 4px; font-size: 0.85rem; font-weight: bold; transition: all 0.2s; }
        .btn-voltar:hover { background: rgba(255,255,255,0.1); }

        .content-wrapper { max-width: 1200px; margin: 0 auto; padding: 0 20px 40px 20px; }
        .card-padrao { background: white; border-radius: 8px; box-shadow: 0 2px 15px rgba(0,0,0,0.05); border-top: 4px solid #F4A900; padding: 25px; }
        
        /* BARRA DE FILTROS */
        .filter-bar { display: flex; gap: 15px; margin-bottom: 20px; align-items: center; padding-bottom: 20px; border-bottom: 1px solid #eee; }
        .search-group { flex: 2; }
        .filter-group { flex: 1; }
        .search-input { width: 100%; padding: 10px 15px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.9rem; }
        .filter-select { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.9rem; }
        .btn-novo { background: #00b894; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-weight: bold; transition:0.2s; white-space: nowrap; }
        .btn-novo:hover { background: #00a383; transform: translateY(-1px); }

        .card-header-line h3 { margin: 0 0 15px 0; color: #002B49; font-size: 1rem; }
        
        .tabela-container { overflow-x: auto; }
        .tabela-users { width: 100%; border-collapse: separate; border-spacing: 0; }
        .tabela-users th { text-align: left; padding: 15px; background: #f8f9fa; border-bottom: 2px solid #e9ecef; color: #444; font-weight: 700; }
        .tabela-users td { padding: 15px; border-bottom: 1px solid #eee; vertical-align: middle; }
        .usuario-row:hover { background-color: #f9fcff; }
        
        .tag-filial { background: #002B49; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; }
        .tag-cargo { padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; }
        .tag-cargo.master { background: #e3f2fd; color: #0d47a1; }
        .tag-cargo.aprovador { background: #e8f5e9; color: #1b5e20; }
        .tag-cargo.visualizador { background: #fff3e0; color: #e65100; }

        .btn-icon { background: white; border: 1px solid #ddd; border-radius: 4px; padding: 6px 8px; cursor: pointer; margin-left: 5px; transition:0.2s; }
        .btn-icon:hover { background: #f0f0f0; }
        .btn-icon.edit:hover { border-color: #002B49; color: #002B49; }
        .btn-icon.del:hover { border-color: #d63031; color: #d63031; }

        .loading-state, .empty-state { text-align: center; padding: 40px; color: #777; font-style: italic; background: #f9f9f9; border-radius: 4px; }

        /* MODAL */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 1100; backdrop-filter: blur(2px); }
        .modal-content { background: white; border-radius: 8px; width: 550px; max-width: 95%; box-shadow: 0 10px 30px rgba(0,0,0,0.3); overflow: hidden; }
        .modal-header { background: #f8f9fa; padding: 20px; border-bottom: 1px solid #eee; }
        .modal-header h3 { margin: 0; color: #002B49; }
        .modal-body { padding: 25px; }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; margin-bottom: 8px; font-weight: bold; color: #555; font-size: 0.9rem; }
        .modal-content input, .modal-content select { width: 100%; padding: 12px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-size: 0.95rem; }
        .form-row { display: flex; gap: 20px; margin-bottom: 20px; }
        .form-col { flex: 1; }
        .form-col label { display: block; margin-bottom: 8px; font-weight: bold; color: #555; font-size: 0.9rem; }
        .checkbox-area { background: #f0f8ff; padding: 20px; border-radius: 6px; border: 1px solid #cce5ff; }
        .check-label { display: flex; align-items: center; cursor: pointer; gap: 12px; font-weight: bold; color: #002B49; font-size: 1rem; }
        .check-label input { width: 20px; height: 20px; margin: 0; accent-color: #002B49; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 12px; padding: 20px; background: #f8f9fa; border-top: 1px solid #eee; }
        .btn-confirm { background: #002B49; color: white; padding: 12px 25px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .btn-cancel { background: white; border: 1px solid #ccc; color: #555; padding: 12px 25px; border-radius: 4px; cursor: pointer; font-weight: bold; }

        @media (max-width: 768px) { 
            .admin-header { padding: 15px; }
            .header-grid { display: flex; justify-content: space-between; }
            .title-area { display: none; }
            .filter-bar { flex-direction: column; align-items: stretch; }
            .form-row { flex-direction: column; gap: 15px; }
        }
      `}</style>
    </div>
  );
}