// src/utils/emailService.js
import emailjs from '@emailjs/browser';

// --- CHAVES OFICIAIS ---
const SERVICE_ID = "service_sbw2y9u";
const TEMPLATE_INTERNO = "template_vqd5t31"; 
const TEMPLATE_PARCEIRO = "template_dp8ikml"; 
const PUBLIC_KEY = "0KASMP3T3BEIa_Esz"; 

// 1. Notifica Equipe (Matriz + Filial) - Solicitação Nova
export const notificarTimeFotus = async (dados, stringDestinatarios) => {
  try {
    if (!stringDestinatarios) return false;

    const params = {
      to_email: stringDestinatarios,
      saudacao: `🔔 NOVA SOLICITAÇÃO: ${dados.filial_uf} | NF ${dados.nota_fiscal}`,
      filial: dados.filial_uf,
      transportadora: dados.transportadora_nome,
      nf: dados.nota_fiscal,
      valor: parseFloat(dados.valor || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}),
      motivo: dados.motivo,
      solicitante: dados.nome_solicitante,
      link_painel: "https://fotus-custos-extras.web.app/admin"
    };
    
    await emailjs.send(SERVICE_ID, TEMPLATE_INTERNO, params, PUBLIC_KEY);
    console.log(`✅ Notificação Interna enviada para: ${stringDestinatarios}`);
    return true;
  } catch (error) {
    console.error("❌ Erro no envio:", error);
    return false;
  }
};

// 2. Confirmação/Reprovação (AGORA COM CÓPIA PARA FILIAL)
export const notificarParceiro = async (dados, status, emailsFilial = null) => {
  try {
    const valorFormatado = (typeof dados.valor === 'string' ? parseFloat(dados.valor) : dados.valor || 0)
        .toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
    
    let mensagem_acao = "";
    let titulo_status = "";

    if (status === 'Aprovado') {
        titulo_status = "APROVADO";
        mensagem_acao = `✅ Custo extra autorizado no valor de <strong style="font-size: 18px; color: #002B49;">${valorFormatado}</strong>.<br><br>Por favor, sigam com a entrega.`;
    } else {
        titulo_status = "REPROVADO";
        mensagem_acao = "❌ Solicitação reprovada. Contate a logística.";
    }

    // 1. Pega emails do solicitante (se houver)
    const emailsSolicitante = dados.email_solicitante
          ? dados.email_solicitante.split(',').map(e => e.trim()).filter(e => e !== "")
          : [];

    // 2. Pega emails da filial (se houver) e transforma em array
    const listaFilial = emailsFilial 
          ? emailsFilial.split(',').map(e => e.trim()).filter(e => e !== "") 
          : [];

    // 3. Junta tudo numa lista única (Solicitante + Filial) sem repetidos
    const destinatariosFinais = [...new Set([...emailsSolicitante, ...listaFilial])].join(',');

    // Se não tiver ninguem para enviar, aí sim paramos
    if (!destinatariosFinais || destinatariosFinais === "") {
        console.warn("⚠️ Nenhum email encontrado (nem solicitante, nem filial) para notificar.");
        return false;
    }

    const params = {
      to_email: destinatariosFinais, // Envia para Todos
      to_name: dados.nome_solicitante || 'Parceiro',
      nf: dados.nota_fiscal,
      status: titulo_status,
      mensagem_extra: mensagem_acao,
      analista: dados.analista || 'Equipe Fotus'
    };

    await emailjs.send(SERVICE_ID, TEMPLATE_PARCEIRO, params, PUBLIC_KEY);
    console.log(`✅ Decisão (${status}) enviada para: ${destinatariosFinais}`);
    return true;
  } catch (error) {
    console.error("❌ Erro envio parceiro:", error);
    return false;
  }
};