// src/pages/Transportadoras.jsx
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { Link } from 'react-router-dom';

export default function Transportadoras() {
  const [transportadoras, setTransportadoras] = useState([]);
  const [form, setForm] = useState({ nome: '', cnpj: '', base64: '' });
  const [loading, setLoading] = useState(false);

  // 1. Carregar
  useEffect(() => {
    const carregar = async () => {
      try {
        const q = query(collection(db, "transportadoras"), orderBy("nome"));
        const snap = await getDocs(q);
        setTransportadoras(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error("Erro:", e); }
    };
    carregar();
  }, []);

  // 2. Arquivo
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 750 * 1024) { 
        alert("Arquivo muito grande (Máx 750KB).");
        e.target.value = null; setForm({ ...form, base64: '' }); return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setForm({ ...form, base64: reader.result });
      reader.readAsDataURL(file);
    } else { setForm({ ...form, base64: '' }); }
  };

  // 3. Salvar (SEM OBRIGATORIEDADE DE PDF)
  const cadastrar = async () => {
    if (!form.nome) return alert("Preencha o Nome da Transportadora.");
    setLoading(true);
    try {
      await addDoc(collection(db, "transportadoras"), {
        nome: form.nome.toUpperCase(),
        cnpj: form.cnpj,
        tabela_pdf: form.base64 || null,
        data_cadastro: new Date()
      });
      alert("✅ Sucesso!");
      setForm({ nome: '', cnpj: '', base64: '' });
      document.getElementById('fileInput').value = '';
      
      // Reload rápido
      const q = query(collection(db, "transportadoras"), orderBy("nome"));
      const snap = await getDocs(q);
      setTransportadoras(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { alert("Erro: " + e.message); } finally { setLoading(false); }
  };

  // 4. Deletar
  const deletar = async (id) => {
    if (!window.confirm("Excluir?")) return;
    await deleteDoc(doc(db, "transportadoras", id));
    setTransportadoras(transportadoras.filter(t => t.id !== id));
  };

  // 5. Download
  const baixar = (base64, nome) => {
    const link = document.createElement('a');
    link.href = base64; link.download = `Tabela_${nome}.pdf`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  return (
    <div className="admin-container">
      {/* CABEÇALHO COM LOGO */}
      <header className="admin-header">
        <div className="header-grid">
            {/* LOGO */}
            <div className="logo-area">
                <span className="logo-main">FOTUS</span>
                <span className="logo-sub">Distribuidora Solar</span>
            </div>
            
            {/* TÍTULO CENTRALIZADO */}
            <div className="title-area">
                <h2>Gerenciar Transportadoras</h2>
            </div>

            {/* BOTÃO VOLTAR */}
            <div className="actions-area">
                <Link to="/admin" className="btn-voltar">← Voltar ao Dashboard</Link>
            </div>
        </div>
      </header>

      <div className="content-grid">
        {/* CARD ESQUERDA (FORM) */}
        <div className="card-form">
          <div className="card-header-title"><h3>➕ Nova Transportadora</h3></div>
          <div className="form-body">
            <div className="form-group">
                <label>Razão Social / Nome Fantasia</label>
                <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Ex: EUREKA TRANSPORTES" />
            </div>
            <div className="form-group">
                <label>CNPJ</label>
                <input value={form.cnpj} onChange={e => setForm({...form, cnpj: e.target.value})} placeholder="00.000.000/0000-00" />
            </div>
            <div className="form-group">
                <label>Tabela de Frete (PDF) <span style={{fontWeight:'normal', fontSize:'0.8rem', color:'#888'}}>(Opcional)</span></label>
                <input type="file" id="fileInput" accept="application/pdf" onChange={handleFileChange} className="input-file" />
                <small className="info-text">*Tamanho máximo: 750KB.</small>
            </div>
            <button onClick={cadastrar} disabled={loading} className="btn-save">{loading ? "Salvando..." : "Cadastrar"}</button>
          </div>
        </div>

        {/* CARD DIREITA (LISTA) */}
        <div className="card-list">
          <div className="card-header-title"><h3>🚛 Transportadoras Ativas ({transportadoras.length})</h3></div>
          <div className="lista-container">
            {transportadoras.length === 0 && <div style={{padding:'20px', textAlign:'center', color:'#999'}}>Nenhuma cadastrada.</div>}
            {transportadoras.map(t => (
              <div key={t.id} className="item-transp">
                <div className="item-info">
                  <strong>{t.nome}</strong>
                  <span>{t.cnpj || "CNPJ não informado"}</span>
                </div>
                <div className="item-actions">
                  {t.tabela_pdf ? (
                      <button onClick={() => baixar(t.tabela_pdf, t.nome)} className="btn-down">⬇ Baixar PDF</button>
                  ) : (
                      <button disabled className="btn-down disabled">Sem PDF</button>
                  )}
                  <button onClick={() => deletar(t.id)} className="btn-del" title="Excluir">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .admin-container { padding: 0; background-color: #f4f6f8; min-height: 100vh; font-family: 'Segoe UI', sans-serif; }
        
        /* HEADER IGUAL AO DASHBOARD */
        .admin-header { background-color: #002B49; color: white; height: 70px; display: flex; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2); padding: 0 40px; margin-bottom: 30px; }
        .header-grid { width: 100%; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; }
        
        /* LOGO */
        .logo-area { display: flex; flex-direction: column; line-height: 1; }
        .logo-main { font-weight: 900; font-size: 1.4rem; letter-spacing: 1px; color: #fff; }
        .logo-sub { font-size: 0.6rem; color: #ccc; display: block; line-height: 0.8; }

        /* TÍTULO E BOTÃO */
        .title-area { text-align: center; }
        .title-area h2 { margin: 0; font-size: 1.2rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: white; }
        .actions-area { text-align: right; }

        .btn-voltar { color: white; text-decoration: none; border: 1px solid rgba(255,255,255,0.3); padding: 8px 16px; border-radius: 4px; font-size: 0.85rem; font-weight: bold; transition: all 0.2s; }
        .btn-voltar:hover { background: rgba(255,255,255,0.1); }

        .content-grid { display: grid; grid-template-columns: 1fr 1.5fr; gap: 25px; max-width: 98%; margin: 0 auto; padding-bottom: 40px; }

        /* CARDS */
        .card-form, .card-list { background: white; border-radius: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-top: 3px solid #F4A900; overflow: hidden; height: fit-content; }
        .card-header-title { padding: 15px 20px; border-bottom: 1px solid #eee; background-color: #fff; }
        .card-header-title h3 { margin: 0; color: #002B49; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.5px; }

        .form-body { padding: 25px; }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; margin-bottom: 8px; font-weight: bold; font-size: 0.85rem; color: #444; }
        .form-group input { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-size: 0.95rem; }
        .form-group input:focus { border-color: #F4A900; outline: none; }
        
        .info-text { display: block; color: #dc3545; font-size: 0.75rem; margin-top: 5px; }

        .btn-save { width: 100%; background: #00b894; color: white; border: none; padding: 12px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 1rem; transition: 0.2s; text-transform: uppercase; }
        .btn-save:hover { background: #00a383; transform: translateY(-1px); }
        .btn-save:disabled { background: #ccc; cursor: not-allowed; transform: none; }

        /* LISTA */
        .lista-container { max-height: 70vh; overflow-y: auto; }
        .item-transp { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; border-bottom: 1px solid #f0f0f0; transition: 0.2s; }
        .item-transp:hover { background-color: #f9f9f9; }
        .item-transp:last-child { border-bottom: none; }
        .item-info { display: flex; flex-direction: column; }
        .item-info strong { color: #002B49; font-size: 0.95rem; margin-bottom: 2px; }
        .item-info span { font-size: 0.8rem; color: #777; }

        .item-actions { display: flex; gap: 10px; align-items: center; }
        .btn-down { background: white; border: 1px solid #002B49; color: #002B49; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; font-weight: bold; transition: 0.2s; }
        .btn-down:hover { background: #002B49; color: white; }
        .btn-down.disabled { border-color: #eee; color: #ccc; cursor: default; background: #f9f9f9; }
        .btn-down.disabled:hover { background: #f9f9f9; color: #ccc; }

        .btn-del { background: none; border: none; font-size: 1.1rem; cursor: pointer; opacity: 0.5; padding: 5px; transition: 0.2s; }
        .btn-del:hover { opacity: 1; color: #d63031; transform: scale(1.1); }

        @media (max-width: 900px) { 
            .content-grid { grid-template-columns: 1fr; } 
            .header-grid { display: flex; justify-content: space-between; }
            .title-area { display: none; } /* Esconde título no mobile se faltar espaço */
        }
      `}</style>
    </div>
  );
}