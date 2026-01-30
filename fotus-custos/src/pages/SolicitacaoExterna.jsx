// src/pages/SolicitacaoExterna.jsx
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, where } from 'firebase/firestore';
import CurrencyInput from 'react-currency-input-field';
import { FILIAIS } from '../filiais';
import { notificarTimeFotus } from '../utils/emailService';

const VERSAO_ATUAL = '7.0'; // Versão com Registro de Saving

const ESTADOS_BR = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const MOTIVOS_PADRAO = [ { nome: 'Zona Rural' }, { nome: 'Reentrega' }, { nome: 'Difícil Acesso' }, { nome: 'Endereço Não Localizado' }, { nome: 'Horário Agendado' }, { nome: 'Descarga' }, { nome: 'Área de Risco' }, { nome: 'Outros' } ];

export default function SolicitacaoExterna() {
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  
  const [listaFiliais, setListaFiliais] = useState([]);
  const [listaMotivos, setListaMotivos] = useState([]);
  const [listaTransportadoras, setListaTransportadoras] = useState([]); 

  useEffect(() => {
    const verificarVersao = async () => {
        try {
            const versaoSalva = localStorage.getItem('fotus_versao_app');
            if (versaoSalva !== VERSAO_ATUAL) {
                localStorage.clear();
                localStorage.setItem('fotus_versao_app', VERSAO_ATUAL);
                window.location.reload(true);
            }
        } catch(e) { console.log(e); }
    };
    verificarVersao();
  }, []);

  useEffect(() => {
    const fetchDados = async () => {
        try {
            const snapFiliais = await getDocs(query(collection(db, "filiais"), orderBy("uf")));
            setListaFiliais(snapFiliais.docs.map(d => d.data()));

            const snapMotivos = await getDocs(query(collection(db, "motivos"), orderBy("nome")));
            setListaMotivos(snapMotivos.docs.map(d => d.data()));

            try {
                let snapTransp;
                try { snapTransp = await getDocs(query(collection(db, "transportadoras"), orderBy("razao_social"))); } 
                catch { snapTransp = await getDocs(collection(db, "transportadoras")); }

                if (!snapTransp.empty) {
                    const nomes = snapTransp.docs.map(d => {
                        const data = d.data();
                        return data.razao_social || data.nome || data.nome_fantasia || "";
                    }).filter(n => n !== "");
                    setListaTransportadoras([...new Set(nomes)].sort());
                }
            } catch (errTransp) { console.warn(errTransp); }

        } catch (err) { setListaFiliais(FILIAIS); setListaMotivos(MOTIVOS_PADRAO); }
    };
    fetchDados();
  }, []);

  const [form, setForm] = useState({
    filial_uf: '', nota_fiscal: '', valor_nf: '', transportadora_nome: '', cidade_destino: '', uf_destino: 'GO', 
    valor: '', motivo: '', link_rota: '', km_total: '', observacao: '', nome_solicitante: '', telefone_solicitante: '',
    email_1: '', email_2: '', email_3: '', email_4: '', email_5: ''
  });

  const handleChange = (e) => { setForm({ ...form, [e.target.name]: e.target.value }); };
  const handleCurrencyChange = (value, name) => { setForm({ ...form, [name]: value }); };

  const buscarDestinatariosDinamicamente = async (ufFilialCarga) => {
      try {
          const q = query(collection(db, "usuarios"), where("recebe_notificacao", "==", true));
          const querySnapshot = await getDocs(q);
          if (querySnapshot.empty) return null;

          const emailsDestino = querySnapshot.docs
            .map(doc => doc.data())
            .filter(u => u.filial === 'TODAS' || u.filial === ufFilialCarga)
            .map(u => u.email ? u.email.trim().toLowerCase() : "")
            .filter(email => email !== "");

          return [...new Set(emailsDestino)].join(',');
      } catch (error) { return null; }
  };

  const enviarSolicitacao = async (e) => {
    e.preventDefault();
    if (!form.filial_uf) return alert("Selecione a Filial.");
    if (!form.motivo) return alert("Selecione o Motivo.");
    if (!form.email_1) return alert("Preencha o E-mail Principal.");
    
    setLoading(true);

    try {
      const filialDados = listaFiliais.find(f => f.uf === form.filial_uf);
      const motivoDados = listaMotivos.find(m => m.nome === form.motivo);

      const todosEmailsSolicitante = [form.email_1, form.email_2, form.email_3, form.email_4, form.email_5]
        .filter(email => email && email.trim() !== '').join(', ');

      const valorDigitado = parseFloat(form.valor || 0);

      const dadosParaSalvar = {
        ...form,
        email_solicitante: todosEmailsSolicitante,
        transportadora_nome: form.transportadora_nome.toUpperCase(),
        cidade_destino: form.cidade_destino.toUpperCase(),
        nome_solicitante: form.nome_solicitante.toUpperCase(),
        filial_cnpj: filialDados?.cnpj || '',
        direcionamento: motivoDados?.direcionamento || 'Logística',
        centro_resultado: motivoDados?.centro_resultado || '',
        
        // --- AQUI ESTÁ A MÁGICA DO SAVING ---
        valor: valorDigitado,             // Valor Final (Pode ser editado depois)
        valor_solicitado: valorDigitado,  // Valor Original (Fica registrado para comparação)
        // ------------------------------------

        valor_nf: parseFloat(form.valor_nf || 0),
        km_total: parseFloat(form.km_total) || 0,
        data_criacao: serverTimestamp(),
        status: "Pendente",
        origem: "Portal Externo"
      };

      await addDoc(collection(db, "solicitacoes"), dadosParaSalvar);

      const listaDestinoInterno = await buscarDestinatariosDinamicamente(form.filial_uf);
      await notificarTimeFotus(dadosParaSalvar, listaDestinoInterno);
      
      setSucesso(true);
      setForm(prev => ({ 
          ...prev, nota_fiscal: '', valor_nf: '', cidade_destino: '', valor: '', motivo: '', link_rota: '', km_total: '', observacao: ''
      }));
    } catch (error) { 
        alert("Erro ao enviar: " + error.message); 
    } finally { 
        setLoading(false); 
    }
  };

  if (sucesso) { return <div className="portal-container"><div className="card-sucesso"><div className="icon-check">✓</div><h2>Solicitação Enviada!</h2><p>Recebemos seus dados e notificamos nosso time.</p><button onClick={() => setSucesso(false)} className="btn-nova">Nova Solicitação</button></div><style>{`.portal-container{min-height:100vh;background:#f4f6f8;display:flex;align-items:center;justify-content:center;font-family:'Segoe UI',sans-serif}.card-sucesso{background:white;padding:40px;border-radius:8px;box-shadow:0 10px 25px rgba(0,0,0,0.1);text-align:center;border-top:5px solid #28a745;width:100%;max-width:400px}.icon-check{font-size:50px;color:#28a745}.btn-nova{background:#002B49;color:white;padding:12px 20px;border:none;border-radius:4px;cursor:pointer;margin-top:20px;width:100%;font-weight:bold}`}</style></div>; }

  return (
    <div className="portal-layout">
      <header className="portal-header">
        <div className="header-grid">
           <div className="logo-area"><span className="logo-main">FOTUS</span><span className="logo-sub">Distribuidora Solar</span></div>
           <div className="title-area"><h1 className="page-title">SOLICITAÇÃO DE CUSTO EXTRA</h1></div>
           <div className="spacer"></div>
        </div>
      </header>

      <main className="portal-content">
        <div className="form-card">
          <div className="card-header"><h2>Dados da Carga</h2><p>Preencha os dados da nota fiscal e destino.</p></div>
          <form onSubmit={enviarSolicitacao} className="form-grid">
            <div className="campo-full"><label>FILIAL FOTUS (ORIGEM)</label><select name="filial_uf" value={form.filial_uf} onChange={handleChange} required><option value="">Selecione...</option>{listaFiliais.map(f=><option key={f.uf} value={f.uf}>{f.uf} - {f.nome}</option>)}</select></div>
            <div className="campo-full"><label>TRANSPORTADORA (EMPRESA)</label><input required name="transportadora_nome" value={form.transportadora_nome} onChange={handleChange} placeholder="Comece a digitar..." list="lista-transportadoras" /><datalist id="lista-transportadoras">{listaTransportadoras.map((transp, index) => (<option key={index} value={transp} />))}</datalist></div>
            <div className="campo-metade"><label>NÚMERO DA NF</label><input required name="nota_fiscal" value={form.nota_fiscal} onChange={handleChange} placeholder="Ex: 54321" /></div>
            <div className="campo-metade"><label>VALOR DA NOTA (R$)</label><CurrencyInput name="valor_nf" value={form.valor_nf} onValueChange={handleCurrencyChange} intlConfig={{ locale: 'pt-BR', currency: 'BRL' }} decimalsLimit={2} className="input-moeda" placeholder="R$ 0,00" /></div>
            <div className="campo-full"><label>VALOR CUSTO EXTRA (R$)</label><CurrencyInput name="valor" value={form.valor} onValueChange={handleCurrencyChange} intlConfig={{ locale: 'pt-BR', currency: 'BRL' }} decimalsLimit={2} required className="input-moeda destaque-valor" placeholder="R$ 0,00" /></div>
            <div className="campo-cidade-uf"><div className="input-cidade"><label>CIDADE DESTINO</label><input required name="cidade_destino" value={form.cidade_destino} onChange={handleChange} /></div><div className="input-uf"><label>UF</label><select name="uf_destino" value={form.uf_destino} onChange={handleChange}>{ESTADOS_BR.map(uf=><option key={uf} value={uf}>{uf}</option>)}</select></div></div>
            <div className="campo-full"><label>MOTIVO DA OCORRÊNCIA</label><select name="motivo" value={form.motivo} onChange={handleChange} required><option value="">Selecione...</option>{(listaMotivos.length>0?listaMotivos:MOTIVOS_PADRAO).map((m,i)=><option key={i} value={m.nome}>{m.nome}</option>)}</select></div>
            <div className="campo-metade"><label>LINK ROTA</label><input name="link_rota" value={form.link_rota} onChange={handleChange} /></div>
            <div className="campo-metade"><label>KM TOTAL</label><input name="km_total" type="number" value={form.km_total} onChange={handleChange} /></div>
            <div className="campo-full"><label>OBSERVAÇÃO</label><input name="observacao" value={form.observacao} onChange={handleChange} /></div>
            
            <div className="divider-section"><h3>Dados do Solicitante</h3></div>
            <div className="campo-full"><label>NOME</label><input required name="nome_solicitante" value={form.nome_solicitante} onChange={handleChange} /></div>
            <div className="campo-metade"><label>TELEFONE</label><input required name="telefone_solicitante" value={form.telefone_solicitante} onChange={handleChange} /></div>
            
            <div className="campo-full" style={{marginTop:'10px', background:'#f8f9fa', padding:'15px', borderRadius:'6px', border:'1px solid #e0e0e0'}}>
                <label style={{fontSize:'0.9rem', marginBottom:'10px', display:'block', color:'#002B49'}}>E-MAILS PARA NOTIFICAÇÃO (INTERNO)</label>
                <div className="email-grid">
                    <div className="campo-email-principal"><label>E-MAIL PRINCIPAL</label><input required type="email" name="email_1" value={form.email_1} onChange={handleChange} /></div>
                    <div className="campo-email-extra"><label>ADICIONAL 1</label><input type="email" name="email_2" value={form.email_2} onChange={handleChange} /></div>
                    <div className="campo-email-extra"><label>ADICIONAL 2</label><input type="email" name="email_3" value={form.email_3} onChange={handleChange} /></div>
                    <div className="campo-email-extra"><label>ADICIONAL 3</label><input type="email" name="email_4" value={form.email_4} onChange={handleChange} /></div>
                    <div className="campo-email-extra"><label>ADICIONAL 4</label><input type="email" name="email_5" value={form.email_5} onChange={handleChange} /></div>
                </div>
            </div>

            <button type="submit" disabled={loading} className="btn-enviar">{loading ? "ENVIANDO..." : "ENVIAR SOLICITAÇÃO"}</button>
          </form>
        </div>
      </main>
      <style>{`.portal-layout{background-color:#f4f6f8;min-height:100vh;font-family:'Segoe UI',sans-serif;color:#333}.portal-header{background-color:#002B49;color:white;height:70px;box-shadow:0 4px 6px rgba(0,0,0,0.1);display:flex;align-items:center;padding:0 30px}.header-grid{width:100%;max-width:1400px;margin:0 auto;display:grid;grid-template-columns:1fr auto 1fr;align-items:center}.logo-area{display:flex;flex-direction:column;line-height:1}.logo-main{font-weight:900;font-size:1.5rem;letter-spacing:1px;color:#fff}.logo-sub{font-size:0.65rem;color:#F4A900;text-transform:uppercase;letter-spacing:1px;font-weight:bold}.title-area{text-align:center}.page-title{font-size:1.1rem;font-weight:700;margin:0;color:#fff;text-transform:uppercase;letter-spacing:1px}.portal-content{padding:40px 20px;display:flex;justify-content:center}.form-card{background:white;width:100%;max-width:600px;border-radius:8px;box-shadow:0 5px 20px rgba(0,0,0,0.08);border-top:5px solid #F4A900;padding:40px}.card-header{margin-bottom:20px;border-bottom:1px solid #eee;padding-bottom:15px}.card-header h2{margin:0 0 8px 0;color:#002B49;font-size:1.5rem;font-weight:700}.card-header p{margin:0;color:#666;font-size:0.95rem}.divider-section{width:100%;margin:20px 0 10px 0;border-bottom:2px solid #f0f0f0;padding-bottom:5px}.divider-section h3{margin:0;color:#002B49;font-size:1.1rem;font-weight:700}.form-grid{display:flex;flex-wrap:wrap;gap:20px}.campo-full{width:100%}.campo-metade{width:calc(50% - 10px)}.campo-cidade-uf{width:100%;display:flex;gap:20px}.input-cidade{flex:3}.input-uf{flex:1}label{display:block;margin-bottom:8px;font-weight:600;font-size:0.75rem;color:#555;text-transform:uppercase;letter-spacing:0.5px}input,select,.input-moeda{width:100%;padding:14px;border:1px solid #e0e0e0;border-radius:6px;box-sizing:border-box;font-size:1rem;background-color:#f8f9fa;transition:all 0.2s;font-family:inherit}input:focus,select:focus,.input-moeda:focus{border-color:#F4A900;background-color:#fff;outline:none;box-shadow:0 0 0 4px rgba(244,169,0,0.1)}.destaque-valor{border-color:#F4A900;background-color:#fffcf5;font-weight:bold;color:#002B49}.btn-enviar{width:100%;margin-top:10px;padding:16px;background-color:#F4A900;color:#002B49;font-weight:800;border:none;border-radius:6px;cursor:pointer;font-size:1rem;transition:all 0.2s;text-transform:uppercase;letter-spacing:1px}.btn-enviar:hover{background-color:#e09b00;transform:translateY(-2px);box-shadow:0 4px 10px rgba(244,169,0,0.3)}.btn-enviar:active{transform:translateY(0)}.btn-enviar:disabled{background-color:#ccc;cursor:not-allowed}
      .email-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
      .campo-email-principal { grid-column: 1 / -1; }
      @media (max-width:768px){.header-grid{display:flex;justify-content:space-between}.spacer,.title-area{display:none}.campo-metade{width:100%}.email-grid{grid-template-columns: 1fr;}}`}</style>
    </div>
  );
}