# 🌞 FOTUS - Central de Custos Extras Logísticos

Sistema de gestão logística desenvolvido para controlar, auditar e negociar custos extras de transporte (reentregas, zonas rurais, descargas, etc.). O sistema conecta transportadoras (Portal Externo) ao time de Backoffice (Painel Admin), gerando inteligência de dados em tempo real.

**Versão Atual:** 7.0 (Estável)

## 🚀 Funcionalidades Principais

### 1. Portal do Parceiro (Front-end Externo)
* Formulário público para registro de ocorrências.
* Validação de dados e upload de evidências (Link Rota).
* **Automação:** Identificação automática da filial de origem e disparo de e-mails via **EmailJS**.

### 2. Painel Administrativo (Backoffice)
* Gestão de solicitações (`Pendente`, `Aprovado`, `Reprovado`).
* **Módulo de Negociação (Saving):** Registro do *Valor Solicitado* vs *Valor Aprovado*.
* Controle de permissões (Master, Aprovador, Visualizador) e restrição por Filial.
* Edição e reenvio de notificações.

### 3. BI & Analytics (Dashboard)
* **Visão Macro:** KPIs financeiros, Pareto de motivos e ofensores por filial.
* **Visão Operacional:** Evolução diária e tabelas detalhadas.
* **Visão de Saving:** Indicadores de economia gerada e performance de negociação.

---

## 🛠️ Tecnologias Utilizadas

* **Core:** React.js (Vite)
* **Linguagem:** JavaScript (ES6+)
* **Banco de Dados:** Google Firebase (Firestore Database)
* **Gráficos:** Recharts (Data Visualization)
* **E-mail Service:** EmailJS (Integração SMTP Transactional)
* **Exportação:** XLSX (Excel) e JSPDF (Relatórios PDF)
* **Estilização:** CSS3 Puro (Responsivo)

---

## ⚙️ Instalação e Execução

### Pré-requisitos
* Node.js instalado.

### Passos
1. Clone o repositório:
   ```bash
   git clone [https://github.com/SEU-USUARIO/fotus-custos-extras.git](https://github.com/SEU-USUARIO/fotus-custos-extras.git)
Instale as dependências:

Bash
npm install
Execute o projeto localmente:

Bash
npm run dev
📧 Configuração de E-mails (EmailJS)
O sistema utiliza templates dinâmicos. A lógica de envio está encapsulada em src/utils/emailService.js.

Template Interno: Notifica a equipe da Filial + Matriz.

Template Parceiro: Notifica a transportadora sobre a decisão (Aprovado/Reprovado).

📂 Estrutura de Pastas
/src/pages: Componentes das telas (Dashboard, Login, Solicitação).

/src/utils: Funções auxiliares (EmailService, Formatadores).

/src/filiais.js: Configuração estática de unidades (fallback).


---

### Passo 2: O Arquivo `.gitignore` (Muito Importante)

Verifique se você tem um arquivo chamado **`.gitignore`** na raiz. Se não tiver, crie um e coloque isso dentro. Isso impede que arquivos "lixo" ou pesados subam para o GitHub:

```text
# .gitignore
node_modules
.DS_Store
dist
dist-ssr
*.local
.env
.env.local
