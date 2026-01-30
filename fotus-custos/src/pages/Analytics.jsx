// src/pages/DashboardAnalitico.jsx
import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

const COLORS = ['#002B49', '#F4A900', '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#a05195'];

// TOOLTIP INTELIGENTE
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const totalStack = payload.reduce((sum, entry) => sum + (typeof entry.value === 'number' ? entry.value : 0), 0);
    const showTotal = payload.length > 1;

    return (
      <div style={{ backgroundColor: '#fff', padding: '12px', border: '1px solid #ccc', borderRadius: '6px', boxShadow: '0 4px 15px rgba(0,0,0,0.15)', minWidth: '200px' }}>
        <p style={{ margin: 0, fontWeight: 'bold', color: '#333', borderBottom: '1px solid #eee', paddingBottom: '8px', marginBottom: '8px', fontSize: '0.9rem' }}>
            {data.name || label}
        </p>
        {payload.map((entry, index) => (
            <div key={index} style={{ color: entry.color, marginBottom: '4px', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: '600' }}>{entry.name === 'value' ? 'Valor' : entry.name}:</span>
                <span>R$ {entry.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
        ))}
        {showTotal && (
            <div style={{ borderTop: '2px solid #eee', marginTop: '6px', paddingTop: '6px', color: '#333', fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between' }}>
                <span>∑ Total:</span>
                <span>R$ {totalStack.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
        )}
        {data.count !== undefined && (<div style={{ marginTop: '8px', paddingTop: '5px', borderTop: '1px dashed #eee', fontSize: '0.8rem', color: '#666', textAlign: 'right' }}>📊 {data.count} ocorrências</div>)}
      </div>
    );
  }
  return null;
};

export default function DashboardAnalitico() {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // FILTROS & VISÃO
  const [visao, setVisao] = useState('MACRO');
  const [dataInicio, setDataInicio] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);
  const [filtroFilial, setFiltroFilial] = useState('');
  const [filtroTransp, setFiltroTransp] = useState('');

  const [listaFiliais, setListaFiliais] = useState([]);
  const [listaTransp, setListaTransp] = useState([]);

  useEffect(() => {
    const carregarDados = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "solicitacoes"), orderBy("data_criacao", "asc"));
        const snap = await getDocs(q);
        
        const listaFormatada = snap.docs.map(d => {
            const data = d.data();
            const valFinal = parseFloat(data.valor || 0);
            const valSolicitado = data.valor_solicitado !== undefined ? parseFloat(data.valor_solicitado) : valFinal;

            return {
                id: d.id,
                ...data,
                data: data.data_criacao?.toDate ? data.data_criacao.toDate() : new Date(),
                valor: valFinal,
                valor_solicitado: valSolicitado,
                saving: valSolicitado - valFinal, 
                valor_nf: parseFloat(data.valor_nf || 0),
                valor_frete: parseFloat(data.valor_frete || 0)
            };
        });

        setDados(listaFormatada);
        setListaFiliais([...new Set(listaFormatada.map(i => i.filial_uf))].sort());
        setListaTransp([...new Set(listaFormatada.map(i => i.transportadora_nome))].sort());

      } catch (error) { console.error("Erro BI:", error); } 
      finally { setLoading(false); }
    };
    carregarDados();
  }, []);

  const dadosFiltrados = useMemo(() => {
    return dados.filter(item => {
        const dataItem = item.data.toISOString().split('T')[0];
        if (dataItem < dataInicio || dataItem > dataFim) return false;
        if (filtroFilial && item.filial_uf !== filtroFilial) return false;
        if (filtroTransp && item.transportadora_nome !== filtroTransp) return false;
        return true;
    });
  }, [dados, dataInicio, dataFim, filtroFilial, filtroTransp]);

  // --- CÁLCULOS KPI ---
  const totalExtra = dadosFiltrados.reduce((acc, cur) => acc + cur.valor, 0);
  const totalFrete = dadosFiltrados.reduce((acc, cur) => acc + cur.valor_frete, 0);
  const totalNF = dadosFiltrados.reduce((acc, cur) => acc + cur.valor_nf, 0);
  const custoOperacional = totalExtra + totalFrete;
  const qtd = dadosFiltrados.length;
  const ticketMedio = qtd > 0 ? totalExtra / qtd : 0;
  
  const percFreteOriginal = totalNF > 0 ? (totalFrete / totalNF) * 100 : 0;
  const percExtraFrete = totalFrete > 0 ? (totalExtra / totalFrete) * 100 : 0;
  const percExtraNF = totalNF > 0 ? (totalExtra / totalNF) * 100 : 0;

  // --- KPI SAVING ---
  const totalSolicitado = dadosFiltrados.reduce((acc, cur) => acc + cur.valor_solicitado, 0);
  const totalSaving = dadosFiltrados.reduce((acc, cur) => acc + cur.saving, 0);
  const percSaving = totalSolicitado > 0 ? (totalSaving / totalSolicitado) * 100 : 0;

  // --- GRÁFICOS SAVING ---
  const dadosSavingTransp = Object.values(dadosFiltrados.reduce((acc, cur) => {
      if (!acc[cur.transportadora_nome]) acc[cur.transportadora_nome] = { name: cur.transportadora_nome, valor: 0, count: 0 };
      acc[cur.transportadora_nome].valor += cur.saving;
      acc[cur.transportadora_nome].count += 1;
      return acc;
  }, {})).sort((a,b) => b.valor - a.valor).slice(0, 10);

  const dadosSavingAnalista = Object.values(dadosFiltrados.reduce((acc, cur) => {
      let analista = cur.analista || 'N/A';
      if (!acc[analista]) acc[analista] = { name: analista, valor: 0, count: 0 };
      acc[analista].valor += cur.saving;
      acc[analista].count += 1;
      return acc;
  }, {})).sort((a,b) => b.valor - a.valor);

  // --- GRÁFICOS MACRO --- 
  const dadosGlobal = [{ name: 'Frete Original', value: totalFrete, count: qtd }, { name: 'Custo Extra', value: totalExtra, count: qtd }];
  const dadosMensal = Object.values(dadosFiltrados.reduce((acc, cur) => {
      const mesAno = cur.data.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      const chave = `${cur.data.getFullYear()}-${cur.data.getMonth()}`;
      if (!acc[chave]) acc[chave] = { name: mesAno, frete: 0, extra: 0, count: 0, sort: cur.data };
      acc[chave].frete += cur.valor_frete; acc[chave].extra += cur.valor; acc[chave].count += 1;
      return acc;
  }, {})).sort((a,b) => a.sort - b.sort);
  const dadosSetor = Object.values(dadosFiltrados.reduce((acc, cur) => { const s = cur.direcionamento || 'Indefinido'; if (!acc[s]) acc[s] = { name: s, value: 0, count: 0 }; acc[s].value += cur.valor; acc[s].count += 1; return acc; }, {})).sort((a,b) => b.value - a.value);
  const dadosFilial = Object.values(dadosFiltrados.reduce((acc, cur) => { if (!acc[cur.filial_uf]) acc[cur.filial_uf] = { name: cur.filial_uf, value: 0, count: 0 }; acc[cur.filial_uf].value += cur.valor; acc[cur.filial_uf].count += 1; return acc; }, {})).sort((a,b) => b.value - a.value);
  const dadosMotivo = Object.values(dadosFiltrados.reduce((acc, cur) => { if (!acc[cur.motivo]) acc[cur.motivo] = { name: cur.motivo, value: 0, count: 0 }; acc[cur.motivo].value += cur.valor; acc[cur.motivo].count += 1; return acc; }, {})).sort((a,b) => b.value - a.value);
  const dadosTopTransp = Object.values(dadosFiltrados.reduce((acc, cur) => { if (!acc[cur.transportadora_nome]) acc[cur.transportadora_nome] = { name: cur.transportadora_nome, value: 0, count: 0 }; acc[cur.transportadora_nome].value += cur.valor; acc[cur.transportadora_nome].count += 1; return acc; }, {})).sort((a,b) => b.value - a.value).slice(0, 5);

  // --- DETALHADA ---
  const dadosEvolucaoDiaria = Object.values(dadosFiltrados.reduce((acc, cur) => { const d = cur.data.toLocaleDateString('pt-BR'); if (!acc[d]) acc[d] = { name: d, value: 0, count: 0 }; acc[d].value += cur.valor; acc[d].count += 1; return acc; }, {})).sort((a,b) => { const [d1, m1, y1] = a.name.split('/'); const [d2, m2, y2] = b.name.split('/'); return new Date(y1, m1-1, d1) - new Date(y2, m2-1, d2); });
  const topTranspTable = Object.values(dadosFiltrados.reduce((acc, cur) => { if(!acc[cur.transportadora_nome]) acc[cur.transportadora_nome] = { nome: cur.transportadora_nome, valor: 0, qtd: 0 }; acc[cur.transportadora_nome].valor += cur.valor; acc[cur.transportadora_nome].qtd += 1; return acc; }, {})).sort((a,b) => b.valor - a.valor);

  return (
    <div className="bi-container">
      <header className="bi-header">
        <div className="header-left"><h2>📊 BI & Indicadores Inteligentes</h2><Link to="/admin" className="btn-voltar">← Voltar Operacional</Link></div>
        <div className="filtros-top">
            <div className="f-group"><label>De:</label><input type="date" value={dataInicio} onChange={e=>setDataInicio(e.target.value)} /></div>
            <div className="f-group"><label>Até:</label><input type="date" value={dataFim} onChange={e=>setDataFim(e.target.value)} /></div>
            <div className="f-group"><label>Filial:</label><select value={filtroFilial} onChange={e=>setFiltroFilial(e.target.value)}><option value="">Todas</option>{listaFiliais.map(f => <option key={f} value={f}>{f}</option>)}</select></div>
            <div className="f-group" style={{flex: 2}}><label>Transportadora:</label><select value={filtroTransp} onChange={e=>setFiltroTransp(e.target.value)}><option value="">Todas</option>{listaTransp.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
        </div>
      </header>

      <div className="view-switcher">
          <button className={visao === 'MACRO' ? 'active' : ''} onClick={() => setVisao('MACRO')}>🌎 Visão Macro</button>
          <button className={visao === 'DETALHADA' ? 'active' : ''} onClick={() => setVisao('DETALHADA')}>🔎 Análise Detalhada</button>
          <button className={visao === 'SAVING' ? 'active' : ''} onClick={() => setVisao('SAVING')} style={{background: visao === 'SAVING' ? '#00b894' : '#e0e0e0', color: visao === 'SAVING' ? 'white' : '#666'}}>💰 Saving & Negociação</button>
      </div>

      {loading ? <div className="loading">Calculando...</div> : (
        <div className="content-body">
            
            {/* KPI GRID (Agora com DATA-TOOLTIP em todos os cards) */}
            {visao !== 'SAVING' && (
                <div className="kpi-grid">
                    <div className="kpi-card destaque" data-tooltip="Soma total de custo extra aprovado."><span>Custo Extra Total ℹ️</span><h3>R$ {totalExtra.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3></div>
                    <div className="kpi-card" data-tooltip="Soma do frete original das NFs envolvidas."><span>Frete Original ℹ️</span><h3 style={{color:'#002B49'}}>R$ {totalFrete.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3></div>
                    <div className="kpi-card" data-tooltip="Custo Total (Frete + Extra)."><span>Custo Operacional ℹ️</span><h3 style={{color:'#333'}}>R$ {custoOperacional.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3></div>
                    <div className="kpi-card" data-tooltip="Soma do valor das mercadorias (NFs)."><span>Valor Total NF ℹ️</span><h3 style={{color:'#555'}}>R$ {totalNF.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3></div>
                    <div className="kpi-card" data-tooltip="Quanto o Frete Original representa da venda."><span>% Frete Inicial / NF ℹ️</span><h3 style={{color:'#0056b3'}}>{percFreteOriginal.toFixed(2)}%</h3></div>
                    <div className="kpi-card" data-tooltip="INEFICIÊNCIA: Quanto pagamos a mais sobre o frete contratado."><span>% Extra / Frete ℹ️</span><h3 style={{color: percExtraFrete > 20 ? '#d63031' : '#00b894'}}>{percExtraFrete.toFixed(2)}%</h3></div>
                    <div className="kpi-card" data-tooltip="IMPACTO MARGEM: Perda sobre a venda."><span>% Extra / NF ℹ️</span><h3 style={{color: percExtraNF > 5 ? '#d63031' : '#00b894'}}>{percExtraNF.toFixed(2)}%</h3></div>
                    <div className="kpi-card" data-tooltip="Média de valor por ocorrência."><span>Ticket Médio ℹ️</span><h3>R$ {ticketMedio.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3></div>
                </div>
            )}

            {/* VISÃO SAVING */}
            {visao === 'SAVING' && (
                <div className="saving-view">
                    <div className="kpi-grid" style={{marginBottom:'30px'}}>
                        <div className="kpi-card" style={{borderTopColor:'#999'}} data-tooltip="Valor inicial solicitado pelo transportador."><span>Valor Solicitado ℹ️</span><h3>R$ {totalSolicitado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3></div>
                        <div className="kpi-card" style={{borderTopColor:'#002B49'}} data-tooltip="Valor final aprovado após negociação."><span>Valor Aprovado ℹ️</span><h3 style={{color:'#002B49'}}>R$ {totalExtra.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3></div>
                        <div className="kpi-card" style={{borderTopColor:'#00b894', background:'#e6fffa'}} data-tooltip="Dinheiro economizado (Solicitado - Aprovado)."><span>Economia Gerada (Saving) ℹ️</span><h3 style={{color:'#00b894'}}>R$ {totalSaving.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3></div>
                        <div className="kpi-card" style={{borderTopColor:'#00b894'}} data-tooltip="Percentual de redução obtido."><span>% de Redução ℹ️</span><h3 style={{color:'#00b894'}}>{percSaving.toFixed(2)}%</h3></div>
                    </div>

                    <div className="grid-charts-macro">
                        <div className="chart-card full-width">
                            <h4>📉 Top 10 Maiores Economias por Transportadora</h4>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart layout="vertical" data={dadosSavingTransp} margin={{left: 20}}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" />
                                    <YAxis dataKey="name" type="category" width={200} style={{fontSize:'0.75rem', fontWeight:'bold'}} />
                                    <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
                                    <Bar dataKey="valor" fill="#00b894" name="Valor Economizado" barSize={25} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="chart-card full-width">
                            <h4>🤵 Performance de Negociação por Analista</h4>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={dadosSavingAnalista}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="valor" fill="#002B49" name="Total Economizado">
                                        {dadosSavingAnalista.map((entry, index) => <Cell key={`cell-${index}`} fill={index === 0 ? '#F4A900' : '#002B49'} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* VISÃO MACRO (EXISTENTE) */}
            {visao === 'MACRO' && (
                <div className="grid-charts-macro">
                    <div className="chart-card"><h4>⚖️ Composição Global (Frete vs Extra)</h4><ResponsiveContainer width="100%" height={250}><BarChart data={dadosGlobal} barSize={60}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis /><Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} /><Bar dataKey="value">{dadosGlobal.map((entry, index) => <Cell key={`cell-${index}`} fill={index === 0 ? '#002B49' : '#dc3545'} />)}</Bar></BarChart></ResponsiveContainer></div>
                    <div className="chart-card"><h4>📅 Custo Operacional Mensal</h4><ResponsiveContainer width="100%" height={250}><BarChart data={dadosMensal}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis /><Tooltip content={<CustomTooltip />} /><Legend /><Bar dataKey="frete" stackId="a" fill="#002B49" name="Frete Original" /><Bar dataKey="extra" stackId="a" fill="#dc3545" name="Custo Extra" /></BarChart></ResponsiveContainer></div>
                    <div className="chart-card"><h4>🏢 Custos por Setor</h4><ResponsiveContainer width="100%" height={250}><PieChart><Pie data={dadosSetor} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{dadosSetor.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip content={<CustomTooltip />} /><Legend layout="vertical" verticalAlign="middle" align="right" /></PieChart></ResponsiveContainer></div>
                    <div className="chart-card"><h4>📍 Gasto Extra por Filial</h4><ResponsiveContainer width="100%" height={250}><BarChart data={dadosFilial}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis /><Tooltip content={<CustomTooltip />} /><Bar dataKey="value" fill="#0088FE">{dadosFilial.map((entry, index) => <Cell key={`cell-${index}`} fill={index === 0 ? '#0056b3' : '#0088FE'} />)}</Bar></BarChart></ResponsiveContainer></div>
                    <div className="chart-card full-width"><h4>⚠️ Custo por Motivo (Pareto)</h4><ResponsiveContainer width="100%" height={250}><BarChart data={dadosMotivo} barSize={50}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis /><Tooltip content={<CustomTooltip />} /><Bar dataKey="value" fill="#dc3545" /></BarChart></ResponsiveContainer></div>
                    <div className="chart-card full-width"><h4>🏆 Top 5 Transportadoras (Gasto)</h4><ResponsiveContainer width="100%" height={300}><BarChart layout="vertical" data={dadosTopTransp} margin={{left: 20}}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" /><YAxis dataKey="name" type="category" width={200} style={{fontSize:'0.75rem', fontWeight:'bold'}} /><Tooltip content={<CustomTooltip />} /><Bar dataKey="value" fill="#F4A900" barSize={30} /></BarChart></ResponsiveContainer></div>
                </div>
            )}

            {/* VISÃO DETALHADA (EXISTENTE) */}
            {visao === 'DETALHADA' && (
                <div className="detailed-view">
                    <div className="chart-card full-width"><h4>📈 Evolução Diária</h4><ResponsiveContainer width="100%" height={300}><AreaChart data={dadosEvolucaoDiaria}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis /><Tooltip content={<CustomTooltip />} /><Area type="monotone" dataKey="value" stroke="#F4A900" fill="#F4A900" fillOpacity={0.3} /></AreaChart></ResponsiveContainer></div>
                    <div className="table-card full-width"><h4>🚛 Ranking Detalhado</h4><div className="table-scroll"><table className="bi-table"><thead><tr><th>Rank</th><th>Transportadora</th><th style={{textAlign:'center'}}>Qtd</th><th style={{textAlign:'right'}}>Total Extra</th><th style={{textAlign:'right'}}>Participação</th></tr></thead><tbody>{topTranspTable.map((t, index) => (<tr key={t.nome}><td>#{index + 1}</td><td style={{fontWeight:'bold'}}>{t.nome}</td><td style={{textAlign:'center'}}>{t.qtd}</td><td style={{textAlign:'right', color: '#d63031', fontWeight:'bold'}}>R$ {t.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td><td style={{textAlign:'right'}}>{((t.valor / totalExtra) * 100).toFixed(1)}%</td></tr>))}</tbody></table></div></div>
                </div>
            )}
        </div>
      )}

      <style>{`
        .bi-container { padding: 30px; background: #f4f6f8; min-height: 100vh; font-family: 'Segoe UI', sans-serif; }
        .bi-header { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); margin-bottom: 20px; }
        .header-left { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        .header-left h2 { margin: 0; color: #002B49; }
        .btn-voltar { color: #002B49; text-decoration: none; border: 1px solid #002B49; padding: 5px 15px; border-radius: 4px; font-weight: bold; }
        .filtros-top { display: flex; gap: 15px; flex-wrap: wrap; }
        .f-group { display: flex; flex-direction: column; }
        .f-group label { font-size: 0.75rem; font-weight: bold; color: #666; margin-bottom: 3px; text-transform: uppercase; }
        .f-group input, .f-group select { padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.9rem; min-width: 150px; background: #f9f9f9; }
        .view-switcher { display: flex; gap: 10px; margin-bottom: 20px; }
        .view-switcher button { flex: 1; padding: 15px; border: none; background: #e0e0e0; cursor: pointer; font-size: 1rem; font-weight: bold; color: #666; border-radius: 8px; transition: 0.2s; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
        .view-switcher button.active { background: #002B49; color: white; box-shadow: 0 4px 10px rgba(0,43,73,0.3); transform: translateY(-2px); }
        .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 25px; }
        .kpi-card { position: relative; background: white; padding: 15px; border-radius: 8px; border-top: 4px solid #ccc; box-shadow: 0 2px 10px rgba(0,0,0,0.05); transition: 0.3s; cursor: help; }
        
        /* HOVER EFFECT & Z-INDEX FIX */
        .kpi-card:hover { transform: translateY(-3px); box-shadow: 0 5px 15px rgba(0,0,0,0.1); z-index: 100; }
        
        .kpi-card.destaque { border-top-color: #F4A900; background: #fffcf5; }
        .kpi-card span { font-size: 0.7rem; color: #888; text-transform: uppercase; font-weight: bold; display: block; margin-bottom: 5px; letter-spacing: 0.5px; }
        .kpi-card h3 { margin: 0; font-size: 1.4rem; color: #333; line-height: 1.2; }
        .kpi-card small { display: block; font-size: 0.7rem; color: #999; margin-top: 5px; }
        /* TOOLTIP CSS */
        .kpi-card[data-tooltip]:hover::after { content: attr(data-tooltip); position: absolute; top: 105%; left: 50%; transform: translateX(-50%); background-color: #333; color: #fff; padding: 10px 15px; border-radius: 6px; font-size: 0.75rem; white-space: normal; width: 220px; text-align: center; z-index: 1000; box-shadow: 0 4px 15px rgba(0,0,0,0.3); opacity: 0; animation: fadeIn 0.3s forwards; pointer-events: none; font-weight: normal; line-height: 1.4; }
        .kpi-card[data-tooltip]:hover::before { content: ''; position: absolute; top: 95%; left: 50%; transform: translateX(-50%); border-width: 6px; border-style: solid; border-color: transparent transparent #333 transparent; z-index: 1000; opacity: 0; animation: fadeIn 0.3s forwards; }
        @keyframes fadeIn { to { opacity: 1; } }
        .grid-charts-macro { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .chart-card { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
        .chart-card h4 { margin-top: 0; color: #555; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 20px; font-size: 0.95rem; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; }
        .full-width { grid-column: 1 / -1; }
        .table-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); margin-top: 20px; }
        .table-scroll { max-height: 400px; overflow-y: auto; }
        .bi-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
        .bi-table th { text-align: left; padding: 12px; background: #f8f9fa; border-bottom: 2px solid #ddd; position: sticky; top: 0; font-weight: 700; color: #555; }
        .bi-table td { padding: 12px; border-bottom: 1px solid #eee; }
        .bi-table tr:hover { background: #f0f8ff; }
        @media (max-width: 900px) { .grid-charts-macro { grid-template-columns: 1fr; } .filtros-top { flex-direction: column; } .f-group { width: 100%; } }
      `}</style>
    </div>
  );
}