const express = require('express');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

let mercadoPago = null;
try {
  mercadoPago = require('mercadopago');
} catch (error) {
  mercadoPago = null;
}

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const DATA_FILE = path.join(__dirname, 'data', 'db.json');

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function readDb() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeDb(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function findPiece(db, pieceId) {
  return db.pieces.find((piece) => piece.id === pieceId);
}

function calculatePrice(piece, options, settings) {
  const basePrice = Number(piece.basePrice || 0);
  let subtotal = basePrice;

  if (options.urgency === '24h') {
    subtotal += basePrice * (Number(settings.urgent24hPercent || 0) / 100);
  }

  if (options.urgency === '12h') {
    subtotal += basePrice * (Number(settings.urgent12hPercent || 0) / 100);
  }

  if (options.hearingSupport) {
    subtotal += basePrice * (Number(settings.hearingPercent || 0) / 100);
  }

  if (options.weekendDelivery) {
    subtotal += basePrice * (Number(settings.weekendPercent || 0) / 100);
  }

  const platformFee = subtotal * (Number(settings.platformFeePercent || 0) / 100);
  const total = Number((subtotal + platformFee).toFixed(2));

  return {
    basePrice: Number(basePrice.toFixed(2)),
    subtotal: Number(subtotal.toFixed(2)),
    platformFee: Number(platformFee.toFixed(2)),
    total
  };
}

function buildWhatsappMessage(order) {
  const lines = [
    'Olá. Seguem os dados da solicitação:',
    `Pedido: ${order.id}`,
    `Nome: ${order.customer.name}`,
    `E-mail: ${order.customer.email}`,
    `Telefone: ${order.customer.phone}`,
    `Área: ${order.area}`,
    `Peça: ${order.pieceName}`,
    `Urgência: ${order.options.urgencyLabel}`,
    `Audiência/Diligência: ${order.options.hearingSupport ? 'Sim' : 'Não'}`,
    `Entrega em fim de semana: ${order.options.weekendDelivery ? 'Sim' : 'Não'}`,
    `Prazo pretendido: ${order.deadline || 'Não informado'}`,
    `Valor total: R$ ${order.pricing.total.toFixed(2)}`,
    `Descrição: ${order.description || 'Sem descrição'}`,
    'Encaminho também o comprovante de pagamento.'
  ];

  return encodeURIComponent(lines.join('\n'));
}

async function createMercadoPagoPreference(order) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const publicKey = process.env.MERCADOPAGO_PUBLIC_KEY;

  if (!accessToken || !publicKey || !mercadoPago) {
    return {
      enabled: false,
      reason: 'Credenciais do Mercado Pago não configuradas no servidor.'
    };
  }

  const client = new mercadoPago.MercadoPagoConfig({ accessToken });
  const preference = new mercadoPago.Preference(client);

  const body = {
    items: [
      {
        id: order.pieceId,
        title: `${order.area} - ${order.pieceName}`,
        quantity: 1,
        unit_price: order.pricing.total,
        currency_id: 'BRL'
      }
    ],
    external_reference: order.id,
    statement_descriptor: 'JURISCONNECT',
    payer: {
      name: order.customer.name,
      email: order.customer.email
    },
    back_urls: {
      success: `${BASE_URL}/payment-result.html?status=success`,
      failure: `${BASE_URL}/payment-result.html?status=failure`,
      pending: `${BASE_URL}/payment-result.html?status=pending`
    },
    auto_return: 'approved',
    notification_url: `${BASE_URL}/api/webhooks/mercadopago`
  };

  const response = await preference.create({ body });

  return {
    enabled: true,
    publicKey,
    preferenceId: response.id,
    initPoint: response.init_point,
    sandboxInitPoint: response.sandbox_init_point || null
  };
}

app.get('/api/config', (req, res) => {
  res.json({
    whatsappNumber: process.env.WHATSAPP_NUMBER || '5599999999999',
    mercadoPagoPublicKey: process.env.MERCADOPAGO_PUBLIC_KEY || '',
    mercadoPagoEnabled: Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN && process.env.MERCADOPAGO_PUBLIC_KEY)
  });
});

app.get('/api/pieces', (req, res) => {
  const db = readDb();
  res.json({ pieces: db.pieces, settings: db.priceSettings });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const db = readDb();
  const user = db.users.find((item) => item.email.toLowerCase() === String(email || '').toLowerCase());

  if (!user) {
    return res.status(404).json({ message: 'Não há cadastro para este e-mail.' });
  }

  if (user.password !== password) {
    return res.status(401).json({ message: 'Senha incorreta.' });
  }

  return res.json({
    message: 'Login realizado com sucesso.',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    },
    redirectTo: user.role === 'admin' ? '/admin.html' : '/painel-advogado.html'
  });
});

app.post('/api/register-interest', (req, res) => {
  const { name, oab, email, phone, specialty } = req.body;
  const number = process.env.WHATSAPP_NUMBER || '5599999999999';
  const text = encodeURIComponent([
    'Olá. Solicito cadastro como advogado delegado.',
    `Nome: ${name}`,
    `OAB: ${oab}`,
    `E-mail: ${email}`,
    `Telefone: ${phone}`,
    `Área principal: ${specialty}`
  ].join('\n'));

  res.json({
    whatsappUrl: `https://wa.me/${number}?text=${text}`
  });
});

app.post('/api/orders', async (req, res) => {
  try {
    const db = readDb();
    const {
      customerName,
      customerEmail,
      customerPhone,
      pieceId,
      deadline,
      description,
      urgency,
      hearingSupport,
      weekendDelivery
    } = req.body;

    const piece = findPiece(db, pieceId);
    if (!piece) {
      return res.status(400).json({ message: 'Tipo de peça não encontrado.' });
    }

    const orderId = generateId('PED');
    const options = {
      urgency: urgency || 'normal',
      urgencyLabel: urgency === '12h' ? 'Até 12 horas' : urgency === '24h' ? 'Até 24 horas' : 'Prazo normal',
      hearingSupport: Boolean(hearingSupport),
      weekendDelivery: Boolean(weekendDelivery)
    };

    const pricing = calculatePrice(piece, options, db.priceSettings);

    const order = {
      id: orderId,
      createdAt: new Date().toISOString(),
      status: 'aguardando_pagamento',
      paymentStatus: 'pending',
      customer: {
        name: customerName,
        email: customerEmail,
        phone: customerPhone
      },
      area: piece.area,
      pieceId: piece.id,
      pieceName: piece.name,
      deadline,
      description,
      options,
      pricing
    };

    const payment = await createMercadoPagoPreference(order);
    order.payment = payment;
    order.whatsappUrl = `https://wa.me/${process.env.WHATSAPP_NUMBER || '5599999999999'}?text=${buildWhatsappMessage(order)}`;

    db.orders.unshift(order);
    writeDb(db);

    return res.status(201).json({ order });
  } catch (error) {
    return res.status(500).json({
      message: 'Erro ao criar a solicitação.',
      details: error.message
    });
  }
});

app.get('/api/admin/orders', (req, res) => {
  const db = readDb();
  res.json({ orders: db.orders });
});

app.get('/api/admin/metrics', (req, res) => {
  const db = readDb();
  const paidOrders = db.orders.filter((order) => order.paymentStatus === 'approved');
  const totalRevenue = paidOrders.reduce((sum, order) => sum + Number(order.pricing.total || 0), 0);

  res.json({
    totalOrders: db.orders.length,
    pendingPayment: db.orders.filter((order) => order.paymentStatus === 'pending').length,
    approvedPayment: paidOrders.length,
    inProgress: db.orders.filter((order) => order.status === 'em_execucao').length,
    totalRevenue: Number(totalRevenue.toFixed(2))
  });
});

app.get('/api/admin/pieces', (req, res) => {
  const db = readDb();
  res.json({ pieces: db.pieces, settings: db.priceSettings });
});

app.put('/api/admin/pieces/:id', (req, res) => {
  const db = readDb();
  const piece = db.pieces.find((item) => item.id === req.params.id);

  if (!piece) {
    return res.status(404).json({ message: 'Peça não encontrada.' });
  }

  piece.name = req.body.name ?? piece.name;
  piece.area = req.body.area ?? piece.area;
  piece.basePrice = Number(req.body.basePrice ?? piece.basePrice);

  writeDb(db);
  return res.json({ message: 'Peça atualizada com sucesso.', piece });
});

app.put('/api/admin/settings', (req, res) => {
  const db = readDb();
  db.priceSettings = {
    ...db.priceSettings,
    ...req.body
  };
  writeDb(db);
  res.json({ message: 'Configurações atualizadas com sucesso.', settings: db.priceSettings });
});

app.patch('/api/admin/orders/:id', (req, res) => {
  const db = readDb();
  const order = db.orders.find((item) => item.id === req.params.id);

  if (!order) {
    return res.status(404).json({ message: 'Pedido não encontrado.' });
  }

  order.status = req.body.status ?? order.status;
  order.paymentStatus = req.body.paymentStatus ?? order.paymentStatus;
  order.adminNotes = req.body.adminNotes ?? order.adminNotes ?? '';

  writeDb(db);
  res.json({ message: 'Pedido atualizado com sucesso.', order });
});

app.post('/api/webhooks/mercadopago', (req, res) => {
  const db = readDb();
  db.notifications.unshift({
    id: generateId('WH'),
    createdAt: new Date().toISOString(),
    payload: req.body
  });
  writeDb(db);

  // Nesta versão inicial, o webhook apenas registra a notificação.
  // Em produção, o ideal é consultar a API do Mercado Pago para confirmar
  // o status do pagamento e então atualizar o pedido correspondente.
  res.sendStatus(200);
});

app.get('/admin', (req, res) => {
  res.redirect('/admin.html');
});

app.get('/painel', (req, res) => {
  res.redirect('/painel-advogado.html');
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado em ${BASE_URL}`);
});
