const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const dbPath = path.join(__dirname, "data", "db.json");

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

function ensureDb() {
  if (!fs.existsSync(dbPath)) {
    writeDb({ users: [], pricing: { taxaPlataformaPercentual: 15, urgencia: { normal: 0, "48h": 15, "24h": 30, "12h": 50 }, pecas: [] }, solicitacoes: [], suporte: [] });
  }
  const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
  db.users = Array.isArray(db.users) ? db.users : [];
  db.pricing = db.pricing || { taxaPlataformaPercentual: 15, urgencia: { normal: 0, "48h": 15, "24h": 30, "12h": 50 }, pecas: [] };
  db.pricing.urgencia = db.pricing.urgencia || { normal: 0, "48h": 15, "24h": 30, "12h": 50 };
  db.pricing.pecas = Array.isArray(db.pricing.pecas) ? db.pricing.pecas : [];
  db.solicitacoes = Array.isArray(db.solicitacoes) ? db.solicitacoes : [];
  db.suporte = Array.isArray(db.suporte) ? db.suporte : [];

  let changed = false;
  if (!db.users.some(u => u.role === "admin")) {
    db.users.unshift({ id: 1, nome: "Administrador", email: "admin@jurisconnect.com", oab: "00000", senha: "123456", role: "admin", createdAt: new Date().toISOString() });
    changed = true;
  }
  if (!db.users.some(u => u.role === "advogado")) {
    db.users.push({
      id: Date.now(),
      nome: "Advogado Delegado Teste",
      email: "advogado@jurisconnect.com",
      oab: "RO 12345",
      senha: "123456",
      role: "advogado",
      createdAt: new Date().toISOString(),
      perfilDelegado: {
        telefone: "",
        pix: "",
        banco: "",
        agencia: "",
        conta: "",
        tipoConta: "corrente",
        areasInteresse: ["Cível", "Consumidor"],
        bio: "",
        oabValidada: false,
        ultimoPedidoSuporte: null
      }
    });
    changed = true;
  }
  db.users = db.users.map(user => {
    if (user.role === "advogado") {
      user.perfilDelegado = user.perfilDelegado || {
        telefone: "",
        pix: "",
        banco: "",
        agencia: "",
        conta: "",
        tipoConta: "corrente",
        areasInteresse: [],
        bio: "",
        oabValidada: false,
        ultimoPedidoSuporte: null
      };
    }
    return user;
  });
  if (!db.solicitacoes.length) {
    db.solicitacoes.push(
      {
        id: 1001,
        protocolo: "JUR-1001",
        nome: "Camila Andrade",
        email: "camila@exemplo.com",
        whatsapp: "69999990001",
        area: "Cível",
        urgencia: "48h",
        descricao: "Ação de obrigação de fazer com pedido liminar para fornecimento de medicamento. Cliente já possui documentos médicos e negativa administrativa.",
        pecaId: 1,
        tipoPeca: "Petição Inicial",
        valor: 238.05,
        composicao: { valorBase: 180, percentualUrgencia: 15, adicionalUrgencia: 27, percentualTaxaPlataforma: 15, taxaPlataforma: 31.05, total: 238.05 },
        status: "disponivel_delegado",
        timelineStatus: "disponivel",
        pagamento: { status: "aprovado", provider: "externo-demo", checkoutUrl: "/checkout.html?pedido=1001" },
        createdAt: new Date().toISOString(),
        detalhesFatos: "Paciente hipossuficiente. Documentos médicos e negativa administrativa disponíveis. Prazo curto por risco de agravamento.",
        delegadoId: null,
        aceiteAt: null
      },
      {
        id: 1002,
        protocolo: "JUR-1002",
        nome: "Rafael Gomes",
        email: "rafael@exemplo.com",
        whatsapp: "69999990002",
        area: "Consumidor",
        urgencia: "24h",
        descricao: "Petição inicial por cobrança indevida em cartão e negativação indevida. Possui prints e faturas.",
        pecaId: 6,
        tipoPeca: "Petição Inicial",
        valor: 254.15,
        composicao: { valorBase: 170, percentualUrgencia: 30, adicionalUrgencia: 51, percentualTaxaPlataforma: 15, taxaPlataforma: 33.15, total: 254.15 },
        status: "disponivel_delegado",
        timelineStatus: "disponivel",
        pagamento: { status: "aprovado", provider: "externo-demo", checkoutUrl: "/checkout.html?pedido=1002" },
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        detalhesFatos: "Cliente foi negativado após cobrança de serviço não contratado. Documentos essenciais já reunidos.",
        delegadoId: null,
        aceiteAt: null
      }
    );
    changed = true;
  }
  if (changed) writeDb(db);
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(dbPath, "utf8"));
}

function writeDb(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), "utf8");
}

function sanitizeUser(user) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    oab: user.oab,
    role: user.role,
    createdAt: user.createdAt,
    perfilDelegado: user.role === "advogado" ? (user.perfilDelegado || null) : undefined
  };
}

function calcularValor(pricing, pecaId, urgencia) {
  const peca = pricing.pecas.find(item => String(item.id) === String(pecaId) && item.ativo);
  if (!peca) return null;
  const base = Number(peca.valorBase || 0);
  const urgPct = Number(pricing.urgencia?.[urgencia] || 0);
  const taxaPct = Number(pricing.taxaPlataformaPercentual || 0);
  const adicionalUrgencia = base * (urgPct / 100);
  const subtotal = base + adicionalUrgencia;
  const taxaPlataforma = subtotal * (taxaPct / 100);
  const total = subtotal + taxaPlataforma;
  return { peca, composicao: { valorBase: +base.toFixed(2), percentualUrgencia: urgPct, adicionalUrgencia: +adicionalUrgencia.toFixed(2), percentualTaxaPlataforma: taxaPct, taxaPlataforma: +taxaPlataforma.toFixed(2), total: +total.toFixed(2) } };
}

function getDelegadoById(db, id) {
  return db.users.find(u => String(u.id) === String(id) && u.role === "advogado");
}

function getGanhosPossiveis(db, delegadoId) {
  return db.solicitacoes.filter(item => item.status === "disponivel_delegado" || String(item.delegadoId || "") === String(delegadoId));
}

app.post("/api/auth/register", (req, res) => {
  try {
    const { nome, email, oab, senha } = req.body;
    if (!nome || !email || !oab || !senha) return res.status(400).json({ message: "Preencha todos os campos." });
    const db = readDb();
    const exists = db.users.find(u => u.email.toLowerCase() === String(email).toLowerCase());
    if (exists) return res.status(409).json({ message: "Já existe usuário com este e-mail." });
    const newUser = { id: Date.now(), nome, email, oab, senha, role: "advogado", createdAt: new Date().toISOString(), perfilDelegado: { telefone: "", pix: "", banco: "", agencia: "", conta: "", tipoConta: "corrente", areasInteresse: [], bio: "", oabValidada: false, ultimoPedidoSuporte: null } };
    db.users.push(newUser);
    writeDb(db);
    return res.status(201).json({ message: "Cadastro realizado com sucesso.", user: sanitizeUser(newUser) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro interno ao cadastrar." });
  }
});

app.post("/api/auth/login", (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ message: "Informe e-mail e senha." });
    const db = readDb();
    const user = db.users.find(u => u.email.toLowerCase() === String(email).toLowerCase());
    if (!user) return res.status(404).json({ message: "Não há cadastro para este e-mail." });
    if (user.senha !== senha) return res.status(401).json({ message: "Senha incorreta." });
    return res.json({ message: "Login realizado com sucesso.", redirectUrl: user.role === "admin" ? "/admin.html" : "/painel-advogado.html", user: sanitizeUser(user) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro interno ao fazer login." });
  }
});

app.get("/api/pricing", (req, res) => {
  const db = readDb();
  res.json(db.pricing);
});

app.put("/api/pricing", (req, res) => {
  try {
    const db = readDb();
    const body = req.body || {};
    if (typeof body.taxaPlataformaPercentual === "number") db.pricing.taxaPlataformaPercentual = body.taxaPlataformaPercentual;
    if (body.urgencia && typeof body.urgencia === "object") db.pricing.urgencia = { ...db.pricing.urgencia, ...body.urgencia };
    if (Array.isArray(body.pecas)) db.pricing.pecas = body.pecas;
    writeDb(db);
    res.json({ message: "Tabela de preços atualizada com sucesso.", pricing: db.pricing });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao atualizar preços." });
  }
});

app.post("/api/solicitacoes/calcular", (req, res) => {
  const { pecaId, urgencia } = req.body;
  const db = readDb();
  const calculo = calcularValor(db.pricing, pecaId, urgencia || "normal");
  if (!calculo) return res.status(404).json({ message: "Peça não encontrada." });
  res.json(calculo);
});

app.post("/api/solicitacoes", (req, res) => {
  try {
    const { nome, email, whatsapp, area, pecaId, urgencia, descricao } = req.body;
    if (!nome || !email || !whatsapp || !area || !pecaId || !descricao) return res.status(400).json({ message: "Preencha os campos obrigatórios da solicitação." });
    const db = readDb();
    const calculo = calcularValor(db.pricing, pecaId, urgencia || "normal");
    if (!calculo) return res.status(404).json({ message: "Peça não encontrada." });
    const id = Date.now();
    const pedido = {
      id,
      protocolo: `JUR-${id}`,
      nome,
      email,
      whatsapp,
      area,
      urgencia: urgencia || "normal",
      descricao,
      pecaId: Number(pecaId),
      tipoPeca: calculo.peca.nome,
      valor: calculo.composicao.total,
      composicao: calculo.composicao,
      status: "aguardando_pagamento",
      timelineStatus: "aguardando_pagamento",
      pagamento: { status: "pendente", provider: "externo-demo", checkoutUrl: `/checkout.html?pedido=${id}` },
      createdAt: new Date().toISOString(),
      detalhesFatos: descricao,
      delegadoId: null,
      aceiteAt: null
    };
    db.solicitacoes.unshift(pedido);
    writeDb(db);
    res.status(201).json({ message: "Solicitação criada com sucesso.", pedido });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao criar solicitação." });
  }
});

app.get("/api/solicitacoes", (req, res) => {
  const db = readDb();
  res.json(db.solicitacoes);
});

app.get("/api/stats", (req, res) => {
  const db = readDb();
  const total = db.solicitacoes.length;
  const aguardandoPagamento = db.solicitacoes.filter(s => s.status === "aguardando_pagamento").length;
  const receitaPotencial = db.solicitacoes.reduce((acc, item) => acc + Number(item.valor || 0), 0);
  const users = db.users.length;
  res.json({ total, aguardandoPagamento, receitaPotencial: +receitaPotencial.toFixed(2), users });
});

app.get("/api/users", (req, res) => {
  const db = readDb();
  res.json(db.users.map(sanitizeUser));
});

app.get("/api/delegado/dashboard", (req, res) => {
  const db = readDb();
  const userId = req.query.userId;
  const delegado = getDelegadoById(db, userId) || db.users.find(u => u.role === "advogado");
  if (!delegado) return res.status(404).json({ message: "Advogado delegado não encontrado." });
  const minhas = db.solicitacoes.filter(item => String(item.delegadoId || "") === String(delegado.id));
  const oportunidades = db.solicitacoes.filter(item => item.status === "disponivel_delegado");
  const ganhosConfirmados = minhas.filter(item => ["aceito_delegado", "em_andamento", "concluido"].includes(item.status)).reduce((acc, item) => acc + Number(item.valor || 0), 0);
  const ganhosPossiveis = getGanhosPossiveis(db, delegado.id).reduce((acc, item) => acc + Number(item.valor || 0), 0);
  const prazosProximos = minhas.filter(item => item.urgencia === "24h" || item.urgencia === "12h").length;
  res.json({
    user: sanitizeUser(delegado),
    stats: {
      demandasRecebidas: minhas.length,
      oportunidadesAbertas: oportunidades.length,
      ganhosPossiveis: +ganhosPossiveis.toFixed(2),
      ganhosConfirmados: +ganhosConfirmados.toFixed(2),
      prazosProximos
    },
    timeline: db.solicitacoes
      .filter(item => item.status === "disponivel_delegado" || String(item.delegadoId || "") === String(delegado.id))
      .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(item => ({
        id: item.id,
        protocolo: item.protocolo,
        area: item.area,
        tipoPeca: item.tipoPeca,
        urgencia: item.urgencia,
        valor: item.valor,
        status: item.status,
        descricao: item.descricao,
        detalhesFatos: item.detalhesFatos || item.descricao,
        createdAt: item.createdAt,
        aceitoPorMim: String(item.delegadoId || "") === String(delegado.id),
        contato: String(item.delegadoId || "") === String(delegado.id) ? { nome: item.nome, email: item.email, whatsapp: item.whatsapp } : null
      }))
  });
});

app.post("/api/delegado/oportunidades/:id/aceitar", (req, res) => {
  try {
    const db = readDb();
    const { userId } = req.body || {};
    const delegado = getDelegadoById(db, userId) || db.users.find(u => u.role === "advogado");
    if (!delegado) return res.status(404).json({ message: "Advogado delegado não encontrado." });
    const item = db.solicitacoes.find(s => String(s.id) === String(req.params.id));
    if (!item) return res.status(404).json({ message: "Oportunidade não encontrada." });
    if (item.status !== "disponivel_delegado") return res.status(409).json({ message: "Esta oportunidade não está mais disponível." });
    item.delegadoId = delegado.id;
    item.aceiteAt = new Date().toISOString();
    item.status = "aceito_delegado";
    item.timelineStatus = "aceito";
    writeDb(db);
    res.json({ message: "Serviço aceito com sucesso.", solicitacao: item });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao aceitar oportunidade." });
  }
});

app.get("/api/delegado/perfil/:userId", (req, res) => {
  const db = readDb();
  const delegado = getDelegadoById(db, req.params.userId) || db.users.find(u => u.role === "advogado");
  if (!delegado) return res.status(404).json({ message: "Perfil não encontrado." });
  res.json({ user: sanitizeUser(delegado) });
});

app.put("/api/delegado/perfil/:userId", (req, res) => {
  try {
    const db = readDb();
    const delegado = getDelegadoById(db, req.params.userId) || db.users.find(u => u.role === "advogado");
    if (!delegado) return res.status(404).json({ message: "Perfil não encontrado." });
    const body = req.body || {};
    delegado.nome = body.nome || delegado.nome;
    delegado.oab = body.oab || delegado.oab;
    delegado.perfilDelegado = delegado.perfilDelegado || {};
    delegado.perfilDelegado.telefone = body.telefone || "";
    delegado.perfilDelegado.pix = body.pix || "";
    delegado.perfilDelegado.banco = body.banco || "";
    delegado.perfilDelegado.agencia = body.agencia || "";
    delegado.perfilDelegado.conta = body.conta || "";
    delegado.perfilDelegado.tipoConta = body.tipoConta || "corrente";
    delegado.perfilDelegado.bio = body.bio || "";
    delegado.perfilDelegado.areasInteresse = Array.isArray(body.areasInteresse) ? body.areasInteresse : [];
    writeDb(db);
    res.json({ message: "Perfil atualizado com sucesso.", user: sanitizeUser(delegado) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao atualizar perfil." });
  }
});

app.post("/api/delegado/suporte", (req, res) => {
  try {
    const db = readDb();
    const { userId, assunto, mensagem } = req.body || {};
    const delegado = getDelegadoById(db, userId) || db.users.find(u => u.role === "advogado");
    if (!delegado) return res.status(404).json({ message: "Advogado delegado não encontrado." });
    if (!assunto || !mensagem) return res.status(400).json({ message: "Preencha assunto e mensagem." });
    const ticket = { id: Date.now(), userId: delegado.id, assunto, mensagem, status: "aberto", createdAt: new Date().toISOString() };
    db.suporte.unshift(ticket);
    delegado.perfilDelegado = delegado.perfilDelegado || {};
    delegado.perfilDelegado.ultimoPedidoSuporte = ticket.createdAt;
    writeDb(db);
    res.status(201).json({ message: "Pedido de suporte registrado com sucesso.", ticket });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao registrar suporte." });
  }
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
