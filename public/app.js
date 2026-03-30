document.addEventListener('DOMContentLoaded', function () {
  const authModal = document.getElementById('authModal');
  const solicitacaoModal = document.getElementById('solicitacaoModal');
  const closeAuthModal = document.getElementById('closeAuthModal');
  const closeSolicitacaoModal = document.getElementById('closeSolicitacaoModal');
  const loginForm = document.getElementById('loginForm');
  const cadastroForm = document.getElementById('cadastroForm');
  const solicitacaoForm = document.getElementById('solicitacaoForm');
  const tabButtons = document.querySelectorAll('.modal-tab');
  const btnLogin = document.getElementById('btnLogin');
  const btnCadastro = document.getElementById('btnCadastro');
  const btnHeroCadastro = document.getElementById('btnHeroCadastro');
  const areaCards = document.querySelectorAll('.area-card');
  const solArea = document.getElementById('solArea');
  const solPeca = document.getElementById('solPeca');
  const solUrgencia = document.getElementById('solUrgencia');
  const previewValor = document.getElementById('previewValor');
  const resultadoPedido = document.getElementById('resultadoPedido');

  let pricing = null;

  function openModal(modal) {
    modal.classList.add('show');
  }

  function closeModal(modal) {
    modal.classList.remove('show');
  }

  function switchTab(tab) {
    tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
    loginForm.style.display = tab === 'login' ? 'block' : 'none';
    cadastroForm.style.display = tab === 'cadastro' ? 'block' : 'none';
  }

  btnLogin?.addEventListener('click', () => { switchTab('login'); openModal(authModal); });
  btnCadastro?.addEventListener('click', () => { switchTab('cadastro'); openModal(authModal); });
  btnHeroCadastro?.addEventListener('click', () => { switchTab('cadastro'); openModal(authModal); });
  closeAuthModal?.addEventListener('click', () => closeModal(authModal));
  closeSolicitacaoModal?.addEventListener('click', () => closeModal(solicitacaoModal));

  authModal?.addEventListener('click', (e) => { if (e.target === authModal) closeModal(authModal); });
  solicitacaoModal?.addEventListener('click', (e) => { if (e.target === solicitacaoModal) closeModal(solicitacaoModal); });
  tabButtons.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  async function loadPricing() {
    const response = await fetch('/api/pricing');
    pricing = await response.json();
  }

  function fillPecas(area) {
    if (!pricing) return;
    const pecas = pricing.pecas.filter(item => item.ativo && item.area === area);
    solPeca.innerHTML = '<option value="">Selecione</option>' + pecas.map(item => `<option value="${item.id}">${item.nome} — R$ ${Number(item.valorBase).toFixed(2)}</option>`).join('');
  }

  async function updatePreview() {
    if (!solPeca.value) {
      previewValor.textContent = 'Selecione a peça e a urgência para visualizar o valor automático.';
      return;
    }
    const response = await fetch('/api/solicitacoes/calcular', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pecaId: solPeca.value, urgencia: solUrgencia.value })
    });
    const data = await response.json();
    if (!response.ok) {
      previewValor.textContent = data.message || 'Não foi possível calcular o valor.';
      return;
    }
    previewValor.innerHTML = `
      <strong>Valor final: R$ ${Number(data.composicao.total).toFixed(2)}</strong><br>
      Base: R$ ${Number(data.composicao.valorBase).toFixed(2)}<br>
      Urgência: ${data.composicao.percentualUrgencia}%<br>
      Taxa da plataforma: ${data.composicao.percentualTaxaPlataforma}%
    `;
  }

  areaCards.forEach(card => {
    card.addEventListener('click', async () => {
      if (!pricing) await loadPricing();
      const area = card.dataset.area;
      solArea.value = area;
      fillPecas(area);
      resultadoPedido.style.display = 'none';
      resultadoPedido.innerHTML = '';
      solicitacaoForm.reset();
      solArea.value = area;
      previewValor.textContent = 'Selecione a peça e a urgência para visualizar o valor automático.';
      openModal(solicitacaoModal);
    });
  });

  solPeca?.addEventListener('change', updatePreview);
  solUrgencia?.addEventListener('change', updatePreview);

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const senha = document.getElementById('loginSenha').value.trim();

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });
    const data = await response.json();
    if (!response.ok) {
      alert(data.message || 'Erro ao fazer login.');
      return;
    }
    alert(data.message);
    window.location.href = data.redirectUrl || '/admin.html';
  });

  cadastroForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('cadastroNome').value.trim();
    const email = document.getElementById('cadastroEmail').value.trim();
    const oab = document.getElementById('cadastroOab').value.trim();
    const senha = document.getElementById('cadastroSenha').value.trim();

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, oab, senha })
    });
    const data = await response.json();
    if (!response.ok) {
      alert(data.message || 'Erro ao cadastrar usuário.');
      return;
    }
    alert(data.message);
    cadastroForm.reset();
    switchTab('login');
  });

  solicitacaoForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      nome: document.getElementById('solNome').value.trim(),
      email: document.getElementById('solEmail').value.trim(),
      whatsapp: document.getElementById('solWhatsapp').value.trim(),
      area: document.getElementById('solArea').value.trim(),
      pecaId: document.getElementById('solPeca').value,
      urgencia: document.getElementById('solUrgencia').value,
      descricao: document.getElementById('solDescricao').value.trim()
    };

    const response = await fetch('/api/solicitacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      alert(data.message || 'Erro ao gerar pedido.');
      return;
    }

    resultadoPedido.style.display = 'block';
    resultadoPedido.innerHTML = `
      <div class="notice-success">Pedido gerado com sucesso.</div>
      <p><strong>Protocolo:</strong> ${data.pedido.protocolo}</p>
      <p><strong>Valor:</strong> R$ ${Number(data.pedido.valor).toFixed(2)}</p>
      <p><strong>Status:</strong> ${data.pedido.status}</p>
      <p><strong>Checkout demo:</strong> ${data.pedido.pagamento.checkoutUrl}</p>
      <p class="muted">Nesta versão corrigida, o pedido é criado no backend. Depois, o checkout real pode ser conectado ao Mercado Pago ou outro gateway.</p>
    `;
  });

  loadPricing().catch(() => {
    previewValor.textContent = 'Não foi possível carregar a tabela de preços.';
  });
});
