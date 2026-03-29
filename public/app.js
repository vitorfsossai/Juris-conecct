const state = {
  pieces: [],
  settings: {},
  config: {},
  walletBrickController: null
};

function currency(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Erro na requisição.');
  }
  return data;
}

function openModal() {
  document.getElementById('authModal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('authModal').classList.add('hidden');
}

function setAuthTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });
  document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
  document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
}

function getSelectedPiece() {
  const pieceId = document.getElementById('pieceId').value;
  return state.pieces.find((piece) => piece.id === pieceId);
}

function calculateEstimate() {
  const piece = getSelectedPiece();
  if (!piece) {
    document.getElementById('estimateValue').textContent = currency(0);
    return;
  }

  const settings = state.settings;
  const urgency = document.getElementById('urgency').value;
  const hearingSupport = document.getElementById('hearingSupport').checked;
  const weekendDelivery = document.getElementById('weekendDelivery').checked;

  let subtotal = Number(piece.basePrice);
  if (urgency === '24h') subtotal += piece.basePrice * (Number(settings.urgent24hPercent || 0) / 100);
  if (urgency === '12h') subtotal += piece.basePrice * (Number(settings.urgent12hPercent || 0) / 100);
  if (hearingSupport) subtotal += piece.basePrice * (Number(settings.hearingPercent || 0) / 100);
  if (weekendDelivery) subtotal += piece.basePrice * (Number(settings.weekendPercent || 0) / 100);

  const total = subtotal + (subtotal * (Number(settings.platformFeePercent || 0) / 100));
  document.getElementById('estimateValue').textContent = currency(total);
}

function renderPieces() {
  const grid = document.getElementById('piecesGrid');
  const select = document.getElementById('pieceId');
  grid.innerHTML = '';
  select.innerHTML = '<option value="">Selecione uma peça</option>';

  state.pieces.forEach((piece) => {
    const article = document.createElement('article');
    article.className = 'piece-card';
    article.innerHTML = `
      <span class="tag">${piece.area}</span>
      <h3>${piece.name}</h3>
      <p>Valor-base: <strong>${currency(piece.basePrice)}</strong></p>
      <button class="btn btn-outline small">Selecionar</button>
    `;
    article.querySelector('button').addEventListener('click', () => {
      select.value = piece.id;
      calculateEstimate();
      document.getElementById('orderForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    grid.appendChild(article);

    const option = document.createElement('option');
    option.value = piece.id;
    option.textContent = `${piece.area} — ${piece.name} (${currency(piece.basePrice)})`;
    select.appendChild(option);
  });
}

function renderOrderSummary(order) {
  const container = document.getElementById('orderSummary');
  container.innerHTML = `
    <div class="summary-item"><span>Pedido</span><strong>${order.id}</strong></div>
    <div class="summary-item"><span>Área</span><strong>${order.area}</strong></div>
    <div class="summary-item"><span>Peça</span><strong>${order.pieceName}</strong></div>
    <div class="summary-item"><span>Prazo</span><strong>${order.deadline || 'Não informado'}</strong></div>
    <div class="summary-item"><span>Base</span><strong>${currency(order.pricing.basePrice)}</strong></div>
    <div class="summary-item"><span>Subtotal</span><strong>${currency(order.pricing.subtotal)}</strong></div>
    <div class="summary-item"><span>Taxa da plataforma</span><strong>${currency(order.pricing.platformFee)}</strong></div>
    <div class="summary-item accent"><span>Total</span><strong>${currency(order.pricing.total)}</strong></div>
  `;
}

async function renderMercadoPagoWallet(order) {
  const feedback = document.getElementById('paymentFeedback');
  const walletContainer = document.getElementById('walletBrick_container');
  const externalLink = document.getElementById('externalPaymentLink');
  const whatsappLink = document.getElementById('whatsappLink');

  feedback.classList.remove('hidden');
  feedback.textContent = '';
  walletContainer.innerHTML = '';
  externalLink.classList.add('hidden');
  whatsappLink.classList.remove('hidden');
  whatsappLink.href = order.whatsappUrl;

  if (!order.payment || !order.payment.enabled) {
    feedback.textContent = 'Checkout Mercado Pago não configurado neste ambiente. Configure as credenciais no arquivo .env e reinicie o servidor.';
    return;
  }

  externalLink.classList.remove('hidden');
  externalLink.href = order.payment.initPoint;
  feedback.textContent = 'Pedido criado com sucesso. Você pode pagar pelo botão seguro abaixo ou pelo link externo.';

  if (!window.MercadoPago || !order.payment.publicKey || !order.payment.preferenceId) {
    return;
  }

  try {
    const mp = new window.MercadoPago(order.payment.publicKey, { locale: 'pt-BR' });
    const bricksBuilder = mp.bricks();
    await bricksBuilder.create('wallet', 'walletBrick_container', {
      initialization: {
        preferenceId: order.payment.preferenceId
      },
      customization: {
        texts: {
          valueProp: 'smart_option'
        }
      }
    });
  } catch (error) {
    feedback.textContent = 'Não foi possível renderizar o checkout embutido. Utilize o link externo seguro.';
  }
}

async function initialize() {
  const [piecesData, configData] = await Promise.all([
    fetchJson('/api/pieces'),
    fetchJson('/api/config')
  ]);

  state.pieces = piecesData.pieces;
  state.settings = piecesData.settings;
  state.config = configData;

  renderPieces();
  calculateEstimate();
}

function bindEvents() {
  document.getElementById('openAuthBtn').addEventListener('click', openModal);
  document.getElementById('openRegisterBtn').addEventListener('click', () => {
    openModal();
    setAuthTab('register');
  });
  document.getElementById('closeAuthBtn').addEventListener('click', closeModal);
  document.querySelectorAll('.tab-btn').forEach((button) => {
    button.addEventListener('click', () => setAuthTab(button.dataset.tab));
  });
  document.getElementById('authModal').addEventListener('click', (event) => {
    if (event.target.id === 'authModal') {
      closeModal();
    }
  });

  ['pieceId', 'urgency', 'hearingSupport', 'weekendDelivery'].forEach((id) => {
    document.getElementById(id).addEventListener('change', calculateEstimate);
  });

  document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = document.getElementById('authMessage');
    try {
      const result = await fetchJson('/api/login', {
        method: 'POST',
        body: JSON.stringify({
          email: document.getElementById('loginEmail').value,
          password: document.getElementById('loginPassword').value
        })
      });
      message.classList.remove('hidden');
      message.textContent = result.message;
      window.location.href = result.redirectTo;
    } catch (error) {
      message.classList.remove('hidden');
      message.textContent = error.message;
    }
  });

  document.getElementById('registerForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const result = await fetchJson('/api/register-interest', {
      method: 'POST',
      body: JSON.stringify({
        name: document.getElementById('registerName').value,
        oab: document.getElementById('registerOab').value,
        email: document.getElementById('registerEmail').value,
        phone: document.getElementById('registerPhone').value,
        specialty: document.getElementById('registerSpecialty').value
      })
    });
    window.open(result.whatsappUrl, '_blank');
  });

  document.getElementById('orderForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const submitButton = event.submitter;
    submitButton.disabled = true;
    submitButton.textContent = 'Gerando pedido...';

    try {
      const payload = {
        customerName: document.getElementById('customerName').value,
        customerEmail: document.getElementById('customerEmail').value,
        customerPhone: document.getElementById('customerPhone').value,
        pieceId: document.getElementById('pieceId').value,
        urgency: document.getElementById('urgency').value,
        deadline: document.getElementById('deadline').value,
        description: document.getElementById('description').value,
        hearingSupport: document.getElementById('hearingSupport').checked,
        weekendDelivery: document.getElementById('weekendDelivery').checked
      };

      const result = await fetchJson('/api/orders', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      document.getElementById('paymentSection').classList.remove('hidden');
      renderOrderSummary(result.order);
      await renderMercadoPagoWallet(result.order);
      document.getElementById('paymentSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      alert(error.message);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Gerar pedido e pagamento';
    }
  });
}

bindEvents();
initialize().catch((error) => {
  alert(error.message || 'Erro ao iniciar a aplicação.');
});
