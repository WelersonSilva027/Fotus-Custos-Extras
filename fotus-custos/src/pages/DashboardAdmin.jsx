// src/pages/DashboardAdmin.jsx
import { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, getDocs, addDoc, deleteDoc, where } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import CurrencyInput from 'react-currency-input-field';
import { Link, useNavigate } from 'react-router-dom';
import { notificarParceiro, notificarTimeFotus } from '../utils/emailService';

const VERSAO_ADMIN = '2.8'; // Correção: Inclui Matriz (TODAS) na cópia de aprovação

export default function DashboardAdmin() {
  const navigate = useNavigate();
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);
  
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [listaFiliais, setListaFiliais] = useState([]); 
  const [listaMotivos, setListaMotivos] = useState([]);

  // Estados UI
  const [modalAberto, setModalAberto] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [colunasMenuAberto, setColunasMenuAberto] = useState(false); 
  const [modoEdicao, setModoEdicao] = useState(false); 
  const [form, setForm] = useState({}); 
  
  // Filtros
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('Todos');
  const [filtroGlobal, setFiltroGlobal] = useState('');
  const [filtrosCol, setFiltrosCol] = useState({}); 
  const [filtroAtivo, setFiltroAtivo] = useState(null);

  const [cols, setCols] = useState({
    data: true, filial: true, transp: true, nf: true, pedido: true,
    motivo: true, direcionamento: true, cr: false, valor_nf: true,
    frete: false, extra: true, status: true, data_aprovacao: true, aprovador: true, acoes: true
  });

  useEffect(() => {
    const checkLogin = () => {
        const storedUser = localStorage.getItem('fotus_user');
        if (!storedUser) { navigate('/'); return; }
        try {
            const userParsed = JSON.parse(storedUser);
            if (!userParsed.nome) throw new Error("Usuário inválido");
            setUsuarioLogado(userParsed);
        } catch (e) {
            localStorage.removeItem('fotus_user');
            navigate('/');
        }
    };
    checkLogin();
  }, [navigate]);

  useEffect(() => {
    const verificarVersao = () => {
        const versaoSalva = localStorage.getItem('fotus_versao_admin');
        if (versaoSalva !== VERSAO_ADMIN) {
            localStorage.setItem('fotus_versao_admin', VERSAO_ADMIN);
            window.location.reload(true);
        }
    };
    verificarVersao();
  }, []);

  useEffect(() => {
    if (!usuarioLogado) return;
    const loadAux = async () => {
        try {
            const snapFiliais = await getDocs(query(collection(db, "filiais"), orderBy("uf")));
            setListaFiliais(snapFiliais.docs.map(d => d.data()));
            const snapMotivos = await getDocs(query(collection(db, "motivos"), orderBy("nome")));
            setListaMotivos(snapMotivos.docs.map(d => d.data()));
        } catch (error) { console.error("Erro aux:", error); }
    };
    loadAux();
  }, [usuarioLogado]);

  useEffect(() => {
    if (!usuarioLogado) return;
    const q = query(collection(db, "solicitacoes"), orderBy("data_criacao", "desc"));
    return onSnapshot(q, (snap) => {
      const lista = [];
      snap.forEach((doc) => lista.push({ id: doc.id, ...doc.data() }));
      setSolicitacoes(lista);
      setLoading(false);
    });
  }, [usuarioLogado]);

  if (!usuarioLogado) return null;

  const isMaster = usuarioLogado.cargo === 'Master';
  const podeAprovar = isMaster || usuarioLogado.cargo === 'Aprovador';

  // --- BUSCA EMAIL DA FILIAL + MATRIZ PARA CÓPIA ---
  const buscarEmailsFilial = async (ufFilial) => {
      try {
          const q = query(collection(db, "usuarios"), where("recebe_notificacao", "==", true));
          const querySnapshot = await getDocs(q);
          
          if (querySnapshot.empty) return null;

          const emails = querySnapshot.docs
            .map(doc => doc.data())
            // CORREÇÃO AQUI: Filtra Filial da Carga OU Matriz ('TODAS')
            .filter(u => u.filial === ufFilial || u.filial === 'TODAS') 
            .map(u => u.email ? u.email.trim().toLowerCase() : "")
            .filter(e => e !== "");

          return [...new Set(emails)].join(',');
      } catch (error) { 
          console.error("Erro busca email filial:", error);
          return null; 
      }
  };

  const reenviarEmailInterno = async (item) => {
      if(!window.confirm(`Deseja reenviar o e-mail de notificação para a equipe da filial ${item.filial_uf}?`)) return;
      try {
          const q = query(collection(db, "usuarios"), where("recebe_notificacao", "==", true));
          const querySnapshot = await getDocs(q);
          if (querySnapshot.empty) return alert("Nenhum usuário configurado para receber notificações.");

          const emailsDestino = querySnapshot.docs
            .map(doc => doc.data())
            .filter(u => u.filial === 'TODAS' || u.filial === item.filial_uf)
            .map(u => u.email ? u.email.trim().toLowerCase() : "")
            .filter(email => email !== "");

          const listaFinal = [...new Set(emailsDestino)].join(',');
          await notificarTimeFotus(item, listaFinal);
          alert(`✅ E-mail reenviado com sucesso para:\n${listaFinal}`);
      } catch (error) { alert("Erro ao reenviar: " + error.message); }
  };

  const filtrarDados = () => {
    let dados = solicitacoes;
    if (usuarioLogado.filial && usuarioLogado.filial !== 'TODAS') {
        dados = dados.filter(item => item.filial_uf === usuarioLogado.filial);
    }
    if (filtroGlobal) {
        const termo = filtroGlobal.toLowerCase();
        dados = dados.filter(item => 
            (item.transportadora_nome && item.transportadora_nome.toLowerCase().includes(termo)) ||
            (item.nota_fiscal && item.nota_fiscal.toString().includes(termo)) ||
            (item.pedido_fotus && item.pedido_fotus.toString().includes(termo)) ||
            (item.motivo && item.motivo.toLowerCase().includes(termo)) ||
            (item.aprovador && item.aprovador.toLowerCase().includes(termo))
        );
    }
    if (dataInicio) dados = dados.filter(item => item.data_criacao?.toDate && item.data_criacao.toDate() >= new Date(dataInicio + 'T00:00:00'));
    if (dataFim) dados = dados.filter(item => item.data_criacao?.toDate && item.data_criacao.toDate() <= new Date(dataFim + 'T23:59:59'));
    if (filtroStatus !== 'Todos') dados = dados.filter(item => item.status === filtroStatus);

    Object.keys(filtrosCol).forEach(key => {
        const valorBusca = filtrosCol[key]?.toLowerCase();
        if (valorBusca) {
            dados = dados.filter(item => {
                let valorItem = '';
                if (key === 'data') valorItem = item.data_criacao?.toDate ? item.data_criacao.toDate().toLocaleDateString() : '';
                else if (key === 'data_aprovacao') valorItem = item.data_aprovacao?.toDate ? item.data_aprovacao.toDate().toLocaleDateString() : '';
                else if (key === 'filial') valorItem = item.filial_uf || '';
                else if (key === 'transp') valorItem = item.transportadora_nome || '';
                else if (key === 'nf') valorItem = item.nota_fiscal || '';
                else if (key === 'pedido') valorItem = item.pedido_fotus || '';
                else if (key === 'motivo') valorItem = item.motivo || '';
                else if (key === 'direcionamento') valorItem = item.direcionamento || '';
                else if (key === 'cr') valorItem = item.centro_resultado || '';
                else if (key === 'aprovador') valorItem = item.aprovador || '';
                return valorItem.toString().toLowerCase().includes(valorBusca);
            });
        }
    });
    return dados;
  };

  const dadosFiltrados = filtrarDados();
  const kpiData = {
      pendentes: dadosFiltrados.filter(i => i.status === 'Pendente'),
      aprovados: dadosFiltrados.filter(i => i.status === 'Aprovado'),
      reprovados: dadosFiltrados.filter(i => i.status === 'Reprovado'),
      total: dadosFiltrados
  };
  const somarValor = (lista) => lista.reduce((acc, curr) => acc + (curr.valor || 0), 0);

  const toggleFilterMenu = (col) => { setFiltroAtivo(filtroAtivo === col ? null : col); };
  const handleFilterChange = (col, val) => { setFiltrosCol(prev => ({ ...prev, [col]: val })); };
  const toggleColuna = (colKey) => { setCols(prev => ({ ...prev, [colKey]: !prev[colKey] })); };

  const converterParaFloat = (valorString) => {
      if (!valorString) return 0;
      if (typeof valorString === 'number') return valorString;
      let limpo = valorString.toString().replace('R$', '').trim();
      limpo = limpo.replace(/\./g, '').replace(',', '.');
      return parseFloat(limpo) || 0;
  };

  const formatarData = (timestamp) => { if (!timestamp || !timestamp.toDate) return "-"; return timestamp.toDate().toLocaleDateString(); };
  
  const getStatusBadge = (status) => {
    const styles = { 'Pendente': {bg:'#fff3cd', c:'#856404'}, 'Aprovado': {bg:'#d4edda', c:'#155724'}, 'Reprovado': {bg:'#f8d7da', c:'#721c24'} };
    const st = styles[status] || styles['Pendente'];
    return <span style={{backgroundColor: st.bg, color: st.c, padding:'2px 6px', borderRadius:'4px', fontWeight:'bold', fontSize:'0.75rem'}}>{status}</span>;
  };

  const handleImportarClick = () => { if(fileInputRef.current) { fileInputRef.current.click(); setMenuAberto(false); } };
  const baixarModelo = () => { const ws = XLSX.utils.json_to_sheet([{'Data Solicitação':'01/12/2025','Filial':'GO','Transportadora':'EXEMPLO','NF':'123','Cidade Destino':'Goiania','UF de Destino':'GO','Valor Nota Fiscal': 5000, 'Valor do Custo Extra':100,'Observações':'Zona Rural','KM Total':50, 'Nº Fotus': '12345'}]); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Modelo"); XLSX.writeFile(wb, "Modelo_Oficial.xlsx"); setMenuAberto(false); };
  
  const exportarExcel = () => { 
      if (dadosFiltrados.length === 0) return alert("Nada para exportar!"); 
      const dadosExport = dadosFiltrados.map(i => ({ 
          'Data Solic.': formatarData(i.data_criacao), 'Data Aprov.': formatarData(i.data_aprovacao), 'Filial': i.filial_uf, 'Transportadora': i.transportadora_nome, 'NF': i.nota_fiscal, 'Pedido': i.pedido_fotus, 'Motivo': i.motivo, 'Direcionamento': i.direcionamento, 'Valor NF': i.valor_nf, 'Frete Original': i.valor_frete || 0, 'Custo Solicitado': i.valor_solicitado || i.valor, 'Custo Aprovado': i.valor, 'Saving': (i.valor_solicitado || i.valor) - i.valor, 'Status': i.status, 'Aprovador': i.aprovador || '', 'KM': i.km_total || '', 'Link Rota': i.link_rota || '', 'Obs': i.observacao || ''
      })); 
      const ws = XLSX.utils.json_to_sheet(dadosExport); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Dados"); XLSX.writeFile(wb, "Relatorio_Fotus.xlsx"); setMenuAberto(false); 
  };
  
  const deletarSolicitacao = async (id) => { if(!window.confirm("⚠️ Excluir?")) return; try { await deleteDoc(doc(db, "solicitacoes", id)); } catch(e) { alert(e.message); } };

  const processarExcel = async (e) => { 
      const arquivo = e.target.files[0]; if (!arquivo) return; if(!window.confirm("Importar planilha?")) { e.target.value = null; return; } 
      const reader = new FileReader(); reader.readAsArrayBuffer(arquivo); 
      reader.onload = async (evt) => { 
          try { 
              const buffer = evt.target.result; const wb = XLSX.read(buffer, { type: 'array' }); const ws = wb.Sheets[wb.SheetNames[0]]; const dadosJson = XLSX.utils.sheet_to_json(ws); 
              setLoading(true); 
              for (const linha of dadosJson) { 
                  const vlr = linha['Valor do Custo Extra'] || 0;
                  await addDoc(collection(db, "solicitacoes"), { filial_uf: 'GO', transportadora_nome: 'IMPORTADO', nota_fiscal: '000', valor: vlr, valor_solicitado: vlr, status: 'Aprovado', origem: 'Excel', data_criacao: new Date() }); 
              } 
              alert("Importado com sucesso!"); 
          } catch (e) { alert(e.message); } finally { setLoading(false); e.target.value = null; } 
      }; 
  };

  const dispararEmailStatus = async (dadosItem, novoStatus) => {
      // O e-mail dispara sempre que for Aprovado/Reprovado
      if (novoStatus === 'Aprovado' || novoStatus === 'Reprovado') {
          // Busca e-mails da Filial + Matriz para cópia
          const emailsFilial = await buscarEmailsFilial(dadosItem.filial_uf);
          
          // Envia notificação
          await notificarParceiro(dadosItem, novoStatus, emailsFilial); 
      }
  };

  const atualizarStatus = async (id, novoStatus) => {
    if(!window.confirm(`Confirma ${novoStatus}?`)) return;
    const assinatura = `${novoStatus} por: ${usuarioLogado.nome}`; 
    const itemAlvo = solicitacoes.find(s => s.id === id);
    try { 
        await updateDoc(doc(db, "solicitacoes", id), { status: novoStatus, aprovador: assinatura, data_aprovacao: new Date() });
        if (itemAlvo) {
            const itemAtualizado = { ...itemAlvo, status: novoStatus, aprovador: assinatura };
            dispararEmailStatus(itemAtualizado, novoStatus);
        }
    } catch(e) { alert(e.message); }
  };

  const abrirNovoManual = () => { 
      setModoEdicao(false); 
      setForm({ id: null, filial_uf: usuarioLogado.filial !== 'TODAS' ? usuarioLogado.filial : 'GO', transportadora_nome: '', nota_fiscal: '', valor: '', valor_solicitado: '', valor_nf: '', valor_frete: '', motivo: '', direcionamento: 'Logística', centro_resultado: '', cidade_destino: '', uf_destino: 'GO', pedido_fotus: '', status: 'Pendente', data_manual: new Date().toISOString().split('T')[0], email_solicitante: '', nome_solicitante: '', km_total: '', link_rota: '', observacao: '' }); 
      setModalAberto(true); 
  };
  
  const abrirEdicao = (item) => { 
      setModoEdicao(true); 
      const vlrSolicitado = item.valor_solicitado !== undefined ? item.valor_solicitado : item.valor;
      setForm({ id: item.id, filial_uf: item.filial_uf, transportadora_nome: item.transportadora_nome, nota_fiscal: item.nota_fiscal, valor: item.valor, valor_solicitado: vlrSolicitado, valor_nf: item.valor_nf || '', valor_frete: item.valor_frete || '', motivo: item.motivo, direcionamento: item.direcionamento || 'Logística', centro_resultado: item.centro_resultado || '', cidade_destino: item.cidade_destino, uf_destino: item.uf_destino, pedido_fotus: item.pedido_fotus || '', status: item.status, data_manual: item.data_criacao?.toDate().toISOString().split('T')[0], email_solicitante: item.email_solicitante || '', nome_solicitante: item.nome_solicitante || '', km_total: item.km_total || '', link_rota: item.link_rota || '', observacao: item.observacao || '' }); 
      setModalAberto(true); 
  };

  const handleCurrencyChange = (value, name) => { setForm({ ...form, [name]: value }); };
  const handleMotivoChange = (e) => { const novoMotivo = e.target.value; const dadosMotivo = listaMotivos.find(m => m.nome === novoMotivo); setForm(prev => ({ ...prev, motivo: novoMotivo, direcionamento: dadosMotivo?.direcionamento || prev.direcionamento || 'Logística', centro_resultado: dadosMotivo?.centro_resultado || prev.centro_resultado || '' })); };
  
  const salvarFormulario = async () => { 
      try { 
          const duplicada = solicitacoes.find(s => s.nota_fiscal && form.nota_fiscal && s.nota_fiscal.toString().trim() === form.nota_fiscal.toString().trim() && s.filial_uf === form.filial_uf && s.id !== form.id);
          if (duplicada) { if (!window.confirm(`⚠️ ALERTA DE DUPLICIDADE!\n\nA Nota Fiscal ${form.nota_fiscal} já consta lançada na filial ${form.filial_uf}.\n\nDeseja salvar mesmo assim?`)) return; }

          const valorExtra = converterParaFloat(form.valor);
          const valorSolicitado = converterParaFloat(form.valor_solicitado);
          const valorNf = converterParaFloat(form.valor_nf);
          const valorFrete = converterParaFloat(form.valor_frete);

          const payload = { 
              filial_uf: form.filial_uf, transportadora_nome: form.transportadora_nome.toUpperCase(), nota_fiscal: form.nota_fiscal, valor: valorExtra, valor_nf: valorNf, valor_frete: valorFrete, motivo: form.motivo, direcionamento: form.direcionamento, centro_resultado: form.centro_resultado, cidade_destino: form.cidade_destino.toUpperCase(), uf_destino: form.uf_destino.toUpperCase(), pedido_fotus: form.pedido_fotus, status: form.status, analista: usuarioLogado.nome, email_solicitante: form.email_solicitante, nome_solicitante: form.nome_solicitante, km_total: parseFloat(form.km_total)||0, link_rota: form.link_rota, observacao: form.observacao
          }; 
          
          if (form.status === 'Aprovado' || form.status === 'Reprovado') { payload.aprovador = `${form.status} por: ${usuarioLogado.nome}`; payload.data_aprovacao = new Date(); } else if (form.status === 'Pendente') { payload.aprovador = ''; } 
          
          if (!modoEdicao) { 
              payload.data_criacao = new Date(form.data_manual + 'T12:00:00'); 
              payload.origem = 'Inserção Manual';
              payload.valor_solicitado = valorExtra; 
              await addDoc(collection(db, "solicitacoes"), payload); alert("✅ Cadastrado!"); 
          } else { 
              if(form.valor_solicitado === undefined || form.valor_solicitado === '') { payload.valor_solicitado = valorExtra; } else { payload.valor_solicitado = valorSolicitado; }
              await updateDoc(doc(db, "solicitacoes", form.id), payload); alert("✅ Atualizado!"); 
              
              if(form.status !== 'Pendente') {
                  const itemAtualizado = { ...form, ...payload }; 
                  dispararEmailStatus(itemAtualizado, form.status); 
              }
          } 
          setModalAberto(false); 
      } catch(err) { alert("Erro: " + err.message); } 
  };

  const renderHeader = (label, key, width) => (
      <th style={{width: width}}>
          <div className="th-container">
              <span>{label}</span>
              <button className={`btn-filter ${filtrosCol[key] ? 'active' : ''}`} onClick={() => toggleFilterMenu(key)}>▼</button>
              {filtroAtivo === key && (
                  <div className="filter-popup">
                      <input autoFocus placeholder={`Filtrar ${label}...`} value={filtrosCol[key] || ''} onChange={(e) => handleFilterChange(key, e.target.value)} />
                      <div className="popup-actions"><button onClick={() => setFiltroAtivo(null)}>Fechar</button></div>
                  </div>
              )}
          </div>
      </th>
  );

  const calcSavingRealTime = () => {
      const vSolicitado = converterParaFloat(form.valor_solicitado);
      const vFinal = converterParaFloat(form.valor);
      const diff = vSolicitado - vFinal;
      return diff;
  };

  return (
    <div className="layout-fotus">
      <header className="header-fotus">
        <div className="header-grid">
           <div className="logo-area"><span className="logo-text">FOTUS</span><span className="logo-sub">Distribuidora Solar</span></div>
           <div className="title-area"><h1 className="page-title">CENTRAL DE CUSTOS EXTRAS</h1></div>
           <div className="user-area"><span>{usuarioLogado.nome}</span><small style={{display:'block', color:'#ccc', fontSize:'0.7rem'}}>{usuarioLogado.filial} | {usuarioLogado.cargo}</small></div>
        </div>
      </header>

      {modalAberto && (
        <div className="modal-overlay">
            <div className="modal-content-large">
                <h3>{modoEdicao ? 'Editar / Negociar' : 'Novo Lançamento'}</h3>
                
                <div style={{background:'#e3f2fd', padding:'15px', borderRadius:'6px', marginBottom:'20px', border:'1px solid #90caf9'}}>
                    <h4 style={{margin:'0 0 10px 0', color:'#0d47a1'}}>💰 Área de Negociação</h4>
                    <div className="form-row">
                        <div className="form-group half">
                            <label>Valor Solicitado (Original)</label>
                            <CurrencyInput 
                                value={form.valor_solicitado} 
                                onValueChange={(val) => setForm({...form, valor_solicitado: val})} 
                                intlConfig={{locale:'pt-BR',currency:'BRL'}} 
                                disabled={modoEdicao} 
                                style={{backgroundColor: modoEdicao ? '#f0f0f0' : '#fff', fontWeight:'bold', color:'#555'}}
                            />
                        </div>
                        <div className="form-group half">
                            <label>Valor Final (Aprovado)</label>
                            <CurrencyInput 
                                name="valor" 
                                value={form.valor} 
                                onValueChange={handleCurrencyChange} 
                                intlConfig={{locale:'pt-BR',currency:'BRL'}} 
                                style={{borderColor:'#F4A900', background:'#fff', fontWeight:'bold', color:'#000'}}
                            />
                        </div>
                    </div>
                    {modoEdicao && (
                        <div style={{textAlign:'right', fontWeight:'bold', color: calcSavingRealTime() > 0 ? 'green' : '#666'}}>
                            Economia (Saving): R$ {calcSavingRealTime().toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                        </div>
                    )}
                </div>

                <div className="form-row"><div className="form-group half"><label>Data</label><input type="date" value={form.data_manual} onChange={e=>setForm({...form, data_manual:e.target.value})} disabled={modoEdicao}/></div><div className="form-group half"><label>Filial</label><select value={form.filial_uf} onChange={e=>setForm({...form, filial_uf:e.target.value})} disabled={!isMaster}>{listaFiliais.length>0?listaFiliais.map(f=><option key={f.uf} value={f.uf}>{f.uf}</option>):<option value="GO">GO</option>}</select></div></div>
                <div className="form-group"><label>Transportadora</label><input value={form.transportadora_nome} onChange={e=>setForm({...form, transportadora_nome:e.target.value})}/></div>
                <div className="form-row"><div className="form-group half"><label>NF</label><input value={form.nota_fiscal} onChange={e=>setForm({...form, nota_fiscal:e.target.value})}/></div><div className="form-group half"><label>Valor NF (R$)</label><CurrencyInput name="valor_nf" value={form.valor_nf} onValueChange={handleCurrencyChange} intlConfig={{locale:'pt-BR',currency:'BRL'}} decimalsLimit={2}/></div></div>
                <div className="form-row"><div className="form-group half"><label>Frete Original (R$)</label><CurrencyInput name="valor_frete" value={form.valor_frete} onValueChange={handleCurrencyChange} intlConfig={{locale:'pt-BR',currency:'BRL'}} decimalsLimit={2} placeholder="Valor Frete" style={{borderColor:'#ccc', background:'#f0f4f8'}}/></div><div className="form-group half"><label>Motivo</label><select value={form.motivo} onChange={handleMotivoChange}><option value="">Selecione...</option>{listaMotivos.map(m=><option key={m.nome} value={m.nome}>{m.nome}</option>)}</select></div></div>
                <div className="form-row"><div className="form-group half"><label>Direcionamento</label><select value={form.direcionamento} onChange={e=>setForm({...form, direcionamento:e.target.value})}><option value="Logística">Logística</option><option value="Comercial">Comercial</option><option value="Expedição">Expedição</option><option value="Financeiro">Financeiro</option><option value="Transportadora">Transportadora</option></select></div><div className="form-group half"><label>Centro de Resultado</label><input value={form.centro_resultado} onChange={e=>setForm({...form, centro_resultado:e.target.value})}/></div></div>
                <div className="form-row"><div className="form-group half"><label>Pedido Fotus</label><input value={form.pedido_fotus} onChange={e=>setForm({...form, pedido_fotus:e.target.value})}/></div><div className="form-group half"><label>Link Rota</label><div style={{display:'flex',gap:'5px'}}><input value={form.link_rota} onChange={e=>setForm({...form, link_rota:e.target.value})} style={{flex:1}}/>{form.link_rota && <a href={form.link_rota} target="_blank" rel="noopener noreferrer" className="btn-outline" style={{padding:'8px',textDecoration:'none'}}>🗺️</a>}</div></div></div>
                <div className="form-group"><label>Observação</label><textarea value={form.observacao} onChange={e=>setForm({...form, observacao:e.target.value})} style={{width:'100%', height:'50px', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} /></div>
                <div className="form-row"><div className="form-group half"><label>Nome Solicitante</label><input value={form.nome_solicitante} onChange={e=>setForm({...form, nome_solicitante:e.target.value})} /></div><div className="form-group half"><label>Email Notificação</label><input type="email" value={form.email_solicitante} onChange={e=>setForm({...form, email_solicitante:e.target.value})} /></div></div>
                <div className="form-group"><label>Status</label><select value={form.status} onChange={e=>setForm({...form, status:e.target.value})} disabled={!podeAprovar}><option value="Pendente">Pendente</option><option value="Aprovado">Aprovado</option><option value="Reprovado">Reprovado</option></select></div>
                <div className="modal-actions"><button onClick={()=>setModalAberto(false)} className="btn-cancel">Cancelar</button><button onClick={salvarFormulario} className="btn-confirm">Salvar</button></div>
            </div>
        </div>
      )}

      <main className="main-content">
        <div className="card-padrao">
          <div className="card-header-line">
            <h2>Gestão de Solicitações | {usuarioLogado.filial}</h2>
            <div className="top-actions">
              <button onClick={abrirNovoManual} className="btn-novo-manual">➕ Novo</button>
              <div className="menu-container"><button className="btn-outline" onClick={() => setColunasMenuAberto(!colunasMenuAberto)}>👁️ Colunas</button>{colunasMenuAberto && (<div className="dropdown-menu dropdown-colunas"><h4>Mostrar/Ocultar</h4>{Object.keys(cols).map(k => (<label key={k} className="col-toggle"><input type="checkbox" checked={cols[k]} onChange={() => toggleColuna(k)} /> {k.toUpperCase()}</label>))}</div>)}</div>
              <div className="menu-container"><button className="btn-menu" onClick={() => setMenuAberto(!menuAberto)}>⚙️ Menu ▼</button>{menuAberto && (<div className="dropdown-menu"><Link to="/admin/analises" className="menu-item">📈 BI & Indicadores</Link><Link to="/admin/transportadoras" className="menu-item">🚚 Transportadoras</Link>{isMaster && (<><hr className="menu-divisor"/><Link to="/admin/usuarios" className="menu-item">👥 Gestão de Usuários</Link><Link to="/admin/filiais" className="menu-item">🏢 Gestão de Unidades</Link><Link to="/admin/motivos" className="menu-item">⚠️ Gestão de Motivos</Link></>)}{podeAprovar && (<><hr className="menu-divisor"/><button onClick={handleImportarClick} className="menu-item-btn">📥 Importar Excel</button><button onClick={baixarModelo} className="menu-item-btn">📄 Baixar Modelo</button></>)}<hr className="menu-divisor"/><button onClick={exportarExcel} className="menu-item-btn">📊 Exportar CSV</button></div>)}<input type="file" ref={fileInputRef} style={{display:'none'}} onChange={processarExcel} /></div>
            </div>
          </div>

          <div className="kpi-area">
            <div className="kpi-card card-pendente"><div className="kpi-label">⏳ Pendentes</div><div className="kpi-value">{kpiData.pendentes.length}</div><div className="kpi-money">R$ {somarValor(kpiData.pendentes).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div></div>
            <div className="kpi-card card-aprovado"><div className="kpi-label">✅ Aprovados</div><div className="kpi-value">{kpiData.aprovados.length}</div><div className="kpi-money">R$ {somarValor(kpiData.aprovados).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div></div>
            <div className="kpi-card card-reprovado"><div className="kpi-label">❌ Reprovados</div><div className="kpi-value">{kpiData.reprovados.length}</div><div className="kpi-money">R$ {somarValor(kpiData.reprovados).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div></div>
            <div className="kpi-card card-total"><div className="kpi-label">📊 Total</div><div className="kpi-value">{kpiData.total.length}</div><div className="kpi-money">R$ {somarValor(kpiData.total).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div></div>
          </div>

          <div className="filtros-bar">
             <div className="filtro-item"><label>Data Início</label><input type="date" value={dataInicio} onChange={e=>setDataInicio(e.target.value)}/></div>
             <div className="filtro-item"><label>Data Fim</label><input type="date" value={dataFim} onChange={e=>setDataFim(e.target.value)}/></div>
             <div className="filtro-item" style={{flex: 1}}><label>Busca Ampla (Geral)</label><input placeholder="Digite NF, Transportadora, Pedido ou Motivo..." value={filtroGlobal} onChange={e=>setFiltroGlobal(e.target.value)}/></div>
             <div className="filtro-item" style={{width: '150px'}}><label>Status</label><select value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}><option value="Todos">Todos</option><option value="Pendente">Pendente</option><option value="Aprovado">Aprovado</option></select></div>
             <div className="filtro-info"><span>{dadosFiltrados.length} registros</span></div>
          </div>

          {loading ? <div className="loading-state">Carregando...</div> : (
            <div className="tabela-container">
              <table className="tabela-fotus">
                <thead>
                  <tr>
                    {cols.data && renderHeader('Data Sol.', 'data')}
                    {cols.filial && renderHeader('Filial', 'filial')}
                    {cols.transp && renderHeader('Transportadora', 'transp')}
                    {cols.nf && renderHeader('NF', 'nf')}
                    {cols.pedido && renderHeader('Pedido', 'pedido')}
                    {cols.motivo && renderHeader('Motivo', 'motivo')}
                    {cols.direcionamento && renderHeader('Setor', 'direcionamento')}
                    {cols.cr && renderHeader('C.R.', 'cr')}
                    {cols.valor_nf && <th>Vlr. NF</th>}
                    {cols.frete && <th>Frete</th>}
                    {cols.extra && <th>Custo Extra</th>}
                    {cols.status && <th>Status</th>}
                    {cols.data_aprovacao && renderHeader('Data Aprov.', 'data_aprovacao')}
                    {cols.aprovador && renderHeader('Aprovador', 'aprovador')}
                    {cols.acoes && <th>Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {dadosFiltrados.map((item) => (
                    <tr key={item.id}>
                      {cols.data && <td>{formatarData(item.data_criacao)}</td>}
                      {cols.filial && <td><span className="filial-tag">{item.filial_uf}</span></td>}
                      {cols.transp && <td><strong>{item.transportadora_nome}</strong></td>}
                      {cols.nf && <td>{item.nota_fiscal}</td>}
                      {cols.pedido && <td style={{color:'#0056b3',fontWeight:'bold'}}>{item.pedido_fotus}</td>}
                      {cols.motivo && <td>{item.motivo}</td>}
                      {cols.direcionamento && <td>{item.direcionamento}</td>}
                      {cols.cr && <td>{item.centro_resultado}</td>}
                      {cols.valor_nf && <td>R$ {(item.valor_nf||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>}
                      {cols.frete && <td>R$ {(item.valor_frete||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>}
                      {cols.extra && <td className="valor-real">R$ {(item.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>}
                      {cols.status && <td>{getStatusBadge(item.status)}</td>}
                      {cols.data_aprovacao && <td>{formatarData(item.data_aprovacao)}</td>}
                      {cols.aprovador && <td style={{fontSize:'0.7rem', color:'#666'}}>{item.aprovador}</td>}
                      {cols.acoes && (
                        <td>
                            <div className="action-buttons">
                            <button onClick={()=>abrirEdicao(item)} className="btn-icon btn-edit" title="Editar / Negociar">✏️</button>
                            <button onClick={()=>reenviarEmailInterno(item)} className="btn-icon btn-email" title="Reenviar Notificação (Equipe)">✉️</button>
                            {podeAprovar && item.status === 'Pendente' && (<><button onClick={()=>atualizarStatus(item.id, 'Aprovado')} className="btn-icon btn-check">✓</button><button onClick={()=>atualizarStatus(item.id, 'Reprovado')} className="btn-icon btn-cross">✕</button></>)}
                            {podeAprovar && (<button onClick={()=>deletarSolicitacao(item.id)} className="btn-icon btn-trash">🗑️</button>)}
                            </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      
      <style>{`
        .layout-fotus { background-color: #f4f6f8; min-height: 100vh; font-family: 'Segoe UI', sans-serif; color: #333; }
        .header-fotus { background-color: #002B49; color: white; padding: 0 40px; height: 60px; display: flex; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        .header-grid { width: 100%; max-width: 98%; margin: 0 auto; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; }
        .logo-area { display: flex; flex-direction: column; line-height: 1; }
        .logo-text { font-weight: 900; font-size: 1.4rem; letter-spacing: 1px; }
        .logo-sub { font-size: 0.6rem; color: #ccc; display: block; line-height: 0.8; }
        .title-area { text-align: center; }
        .page-title { font-size: 1.2rem; font-weight: 700; margin: 0; text-transform: uppercase; letter-spacing: 1px; color: white; }
        .user-area { text-align: right; font-size: 0.9rem; color: #e0e0e0; }
        .main-content { padding: 20px; max-width: 98%; margin: 0 auto; width: 100%; box-sizing: border-box; }
        .card-padrao { background: white; border-radius: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-top: 3px solid #F4A900; padding: 20px; min-height: 500px; }
        .kpi-area { display: flex; gap: 15px; margin-bottom: 15px; flex-wrap: wrap; }
        .kpi-card { flex: 1; min-width: 140px; background: white; padding: 10px 15px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-left: 4px solid #ccc; text-align: center; transition: 0.2s; display: flex; flex-direction: column; justify-content: center; }
        .kpi-card:hover { transform: translateY(-2px); }
        .kpi-label { font-size: 0.7rem; font-weight: bold; color: #666; text-transform: uppercase; margin-bottom: 2px; }
        .kpi-value { font-size: 1.4rem; font-weight: 800; color: #333; line-height: 1.1; }
        .kpi-money { font-size: 0.75rem; color: #888; font-weight: 600; margin-top: 2px; }
        .card-pendente { border-color: #ffc107; } .card-aprovado { border-color: #28a745; } .card-reprovado { border-color: #dc3545; } .card-total { border-color: #002B49; }
        .card-header-line { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 15px; }
        .tabela-container { overflow-x: auto; max-width: 100%; border: 1px solid #eee; margin-top: 15px; max-height: 70vh; overflow-y: auto; }
        .tabela-fotus { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
        .tabela-fotus th { text-align: left; padding: 12px 10px; background-color: #f8f9fa; border-bottom: 2px solid #dee2e6; white-space: nowrap; font-weight: 700; color: #555; position: sticky; top: 0; z-index: 10; }
        .th-container { display: flex; align-items: center; justify-content: space-between; position: relative; gap: 5px; }
        .btn-filter { background: none; border: none; font-size: 0.7rem; cursor: pointer; color: #aaa; padding: 2px 4px; border-radius: 3px; }
        .btn-filter:hover { background: #e2e6ea; color: #333; }
        .btn-filter.active { color: #002B49; font-weight: bold; background: #e2e6ea; }
        .filter-popup { position: absolute; top: 30px; left: 0; background: white; border: 1px solid #ccc; box-shadow: 0 4px 10px rgba(0,0,0,0.15); padding: 10px; border-radius: 4px; z-index: 100; min-width: 180px; }
        .filter-popup input { width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 0.8rem; box-sizing: border-box; }
        .popup-actions { margin-top: 8px; text-align: right; }
        .popup-actions button { background: none; border: none; color: #002B49; font-size: 0.75rem; cursor: pointer; text-decoration: underline; }
        .tabela-fotus td { padding: 10px; border-bottom: 1px solid #eee; vertical-align: middle; white-space: nowrap; }
        .dropdown-colunas { padding: 10px; width: 200px; }
        .dropdown-colunas h4 { margin: 0 0 10px 0; font-size: 0.9rem; color: #002B49; border-bottom: 1px solid #eee; padding-bottom: 5px; }
        .col-toggle { display: block; margin-bottom: 5px; font-size: 0.85rem; cursor: pointer; }
        .col-toggle input { margin-right: 8px; }
        .valor-real { font-family: monospace; font-weight: bold; color: #333; }
        .filial-tag { background: #002B49; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; }
        .filtros-bar { display: flex; gap: 15px; background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 15px; align-items: flex-end; border: 1px solid #eee; }
        .filtro-item { display: flex; flex-direction: column; gap: 5px; }
        .filtro-item input, select { padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.9rem; }
        .top-actions { display: flex; gap: 10px; align-items: center; }
        .btn-novo-manual { background: #F4A900; color: #002B49; padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer; font-weight: 800; display: flex; align-items: center; gap: 5px; }
        .menu-container { position: relative; }
        .btn-menu { background: #002B49; color: white; padding: 8px 14px; border-radius: 4px; border: none; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 5px; }
        .btn-outline { background: white; border: 1px solid #002B49; color: #002B49; padding: 7px 14px; border-radius: 4px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 5px; }
        .dropdown-menu { position: absolute; right: 0; top: 40px; background: white; border-radius: 6px; box-shadow: 0 5px 20px rgba(0,0,0,0.15); width: 220px; z-index: 100; border: 1px solid #eee; overflow: hidden; }
        .menu-item { display: block; padding: 10px 15px; color: #333; text-decoration: none; font-size: 0.9rem; transition: 0.2s; }
        .menu-item:hover { background: #f4f6f8; color: #002B49; }
        .menu-item-btn { display: block; width: 100%; text-align: left; padding: 10px 15px; background: none; border: none; color: #333; font-size: 0.9rem; cursor: pointer; font-family: inherit; transition: 0.2s; }
        .menu-item-btn:hover { background: #f4f6f8; color: #002B49; }
        .menu-divisor { border: 0; border-top: 1px solid #eee; margin: 0; }
        .action-buttons { display: flex; gap: 4px; justify-content: center; }
        .btn-icon { width: 24px; height: 24px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; background: white; transition: 0.2s; font-size: 0.8rem; }
        .btn-edit:hover { background: #e2e6ea; color: #0056b3; border-color: #0056b3; }
        .btn-email:hover { background: #fff3cd; color: #856404; border-color: #ffeeba; }
        .btn-check:hover { background: #d4edda; color: green; border-color: green; }
        .btn-cross:hover { background: #f8d7da; color: red; border-color: red; }
        .btn-trash:hover { background: #6c757d; color: white; }
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; }
        .modal-content-large { background: white; padding: 30px; border-radius: 8px; width: 700px; max-width: 95%; box-shadow: 0 4px 20px rgba(0,0,0,0.2); max-height: 90vh; overflow-y: auto; }
        .form-row { display: flex; gap: 15px; margin-bottom: 15px; }
        .half { width: 50%; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: bold; font-size: 0.85rem; color: #444; }
        .form-group input, select, textarea { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 15px; margin-top: 25px; pt: 15px; border-top: 1px solid #eee; }
        .btn-cancel { background: #6c757d; color: white; border: none; padding: 10px 25px; border-radius: 4px; cursor: pointer; }
        .btn-confirm { background: #002B49; color: white; border: none; padding: 10px 25px; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .loading-state { text-align: center; padding: 40px; font-weight: bold; color: #007bff; font-size: 1.1rem; }
      `}</style>
    </div>
  );
}