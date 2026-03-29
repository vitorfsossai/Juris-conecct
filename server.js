const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const dbPath = path.join(__dirname, 'data', 'db.json');

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function ensureDb() {
  if (!fs.existsSync(dbPath)) {
    const initial = {
      users: [
        {
          id: 1,
          nome: 'Administrador',
          email: 'admin@jurisconnect.com',
          oab: '00000',
          senha: '123456',
          role: 'admin',
          createdAt: new Date().toISOString()
        }
      ],
      pricing: {
        taxaPlataformaPercentual: 15,
        urgencia: {
          normal: 0,
          '48h': 15,
          '24h': 30,
          '12h': 50
        },
        pecas: [
          { id: 1, area: 'Cível', nome: 'Petição Inicial', valorBase: 180, ativo: true },
          { id: 2, area: 'Cível', nome: 'Contestação', valorBase: 220, ativo: true },
          { id: 3, area: 'Trabalhista', nome: 'Reclamação Trabalhista', valorBase: 250, ativo: true },
          { id: 4, area: 'Previdenciário', nome: 'Recurso Administrativo', valorBase: 160, ativo: true },
          { id: 5, area: 'Penal', nome: 'Resposta à Acusação', valorBase: 240, ativo: true },
          { id: 6, area: 'Consumidor', nome: 'Petição Inicial', valorBase: 170, ativo: true }
        ]
      },
      solicitacoes: []
    };
    fs.writeFileSync(dbPath, JSON.stringify(initial, null, 2), 'utf8');
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function writeDb(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
}

function sanitizeUser(user) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    oab: user.oab,
    role: user.role,
    createdAt: user.createdAt
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

  return {
    peca,
    composicao: {
      valorBase: Number(base.toFixed(2)),
      percentualUrgencia: urgPct,
      adicionalUrgencia: Number(adicionalUrgencia.toFixed(2)),
      percentualTaxaPlataforma: taxaPct,
      taxaPlataforma: Number(taxaPlataforma.toFixed(2)),
      total: Number(total.toFixed(2))
    }
  };
}

app.post('/api/auth/register', (req, res) => {
  try {
    const { nome, email, oab, senha } = req.body;
    if (!nome || !email || !oab || !senha) {
      return res.status(400).json({ message: 'Preencha todos os campos.' });
    }
    const db = readDb();
    const exists = db.users.find(u => u.email.toLowerCase() === String(email).toLowerCase());
    if (exists) {
      return res.status(409).json({ message: 'Já existe usuário com este e-mail.' });
    }
    const newUser = {
      id: Date.now(),
      nome,
      email,
      oab,
      senha,
      role: 'advogado',
      createdAt: new Date().toISOString()
    };
    db.users.push(newUser);
    writeDb(db);
    return res.status(201).json({ message: 'Cadastro realizado com sucesso.', user: sanitizeUser(newUser) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro interno ao cadastrar.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) {
      return res.status(400).json({ message: 'Informe e-mail e senha.' });
    }
    const db = readDb();
    const user = db.users.find(u => u.email.toLowerCase() === String(email).toLowerCase());
    if (!user) {
      return res.status(404).json({ message: 'Não há cadastro para este e-mail.' });
    }
    if (user.senha !== senha) {
      return res.status(401).json({ message: 'Senha incorreta.' });
    }
    return res.json({
      message: 'Login realizado com sucesso.',
      redirectUrl: user.role === 'admin' ? '/admin.html' : '/painel-advogado.html',
      user: sanitizeUser(user)
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro interno ao fazer login.' });
  }
});

app.get('/api/pricing', (req, res) => {
  const db = readDb();
  res.json(db.pricing);
});

app.put('/api/pricing', (req, res) => {
  try {
    const db = readDb();
    const body = req.body || {};
    if (typeof body.taxaPlataformaPercentual === 'number') {
      db.pricing.taxaPlataformaPercentual = body.taxaPlataformaPercentual;
    }
    if (body.urgencia && typeof body.urgencia === 'object') {
      db.pricing.urgencia = { ...db.pricing.urgencia, ...body.urgencia };
    }
    if (Array.isArray(body.pecas)) {
      db.pricing.pecas = body.pecas;
    }
    writeDb(db);
    res.json({ message: 'Tabela de preços atualizada com sucesso.', pricing: db.pricing });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao atualizar preços.' });
  }
});

app.post('/api/solicitacoes/calcular', (req, res) => {
  const { pecaId, urgencia } = req.body;
  const db = readDb();
  const calculo = calcularValor(db.pricing, pecaId, urgencia || 'normal');
  if (!calculo) {
    return res.status(404).json({ message: 'Peça não encontrada.' });
  }
  res.json(calculo);
});

app.post('/api/solicitacoes', (req, res) => {
  try {
    const { nome, email, whatsapp, area, pecaId, urgencia, descricao } = req.body;
    if (!nome || !email || !whatsapp || !area || !pecaId || !descricao) {
      return res.status(400).json({ message: 'Preencha os campos obrigatórios da solicitação.' });
    }
    const db = readDb();
    const calculo = calcularValor(db.pricing, pecaId, urgencia || 'normal');
    if (!calculo) {
      return res.status(404).json({ message: 'Peça não encontrada.' });
    }
    const pedido = {
      id: Date.now(),
      protocolo: `JUR-${Date.now()}`,
      nome,
      email,
      whatsapp,
      area,
      urgencia: urgencia || 'normal',
      descricao,
      pecaId: Number(pecaId),
      tipoPeca: calculo.peca.nome,
      valor: calculo.composicao.total,
      composicao: calculo.composicao,
      status: 'aguardando_pagamento',
      pagamento: {
        status: 'pendente',
        provider: 'externo-demo',
        checkoutUrl: `/checkout.html?pedido=${Date.now()}`
      },
      createdAt: new Date().toISOString()
    };
    db.solicitacoes.unshift(pedido);
    writeDb(db);
    res.status(201).json({
      message: 'Solicitação criada com sucesso.',
      pedido
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao criar solicitação.' });
  }
});

app.get('/api/solicitacoes', (req, res) => {
  const db = readDb();
  res.json(db.solicitacoes);
});

app.get('/api/stats', (req, res) => {
  const db = readDb();
  const total = db.solicitacoes.length;
  const aguardandoPagamento = db.solicitacoes.filter(s => s.status === 'aguardando_pagamento').length;
  const receitaPotencial = db.solicitacoes.reduce((acc, item) => acc + Number(item.valor || 0), 0);
  const users = db.users.length;
  res.json({ total, aguardandoPagamento, receitaPotencial: Number(receitaPotencial.toFixed(2)), users });
});

app.get('/api/users', (req, res) => {
  const db = readDb();
  res.json(db.users.map(sanitizeUser));
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
