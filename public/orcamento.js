document.addEventListener('DOMContentLoaded', function () {
  const orcamentoForm = document.getElementById('orcamentoForm');
  const orcArea = document.getElementById('orcArea');
  const orcPeca = document.getElementById('orcPeca');
  const orcUrgencia = document.getElementById('orcUrgencia');
  const orcPreviewValor = document.getElementById('orcPreviewValor');
  const orcResultadoPedido = document.getElementById('orcResultadoPedido');

  let pricing = null;

  function getAreaFromQuery() {
    const params = new URLSearchParams(window.location.search);
    return params.get('area') || '';
  }

  async function loadPricing() {
    const response = await fetch('/api/pricing');
    pricing = await response.json();
  }

  function fillAreas(selectedArea = '') {
    if (!pricing) return;
    const areas = [...new Set(pricing.pecas.filter(item => item.ativo).map(item => item.area))].sort((a, b) => a.localeCompare(b));
    const current = areas.includes(selectedArea) ? selectedArea : '';
    orcArea.innerHTML = '<option value="">Selecione a área</option>' + areas.map(area => `
      <option value="${area}" ${area === current ? 'selected' : ''}>${area}</option>
    `).join('');
  }

  function fillPecas(area) {
    if (!pricing || !area) {
      orcPeca.innerHTML = '<option value="">Selecione a área primeiro</option>';
      return;
    }
    const pecas = pricing.pecas.filter(item => item.ativo && item.area === area);
    orcPeca.innerHTML = '<option value="">Selecione a peça</option>' + pecas.map(item => `
      <option value="${item.id}">${item.nome} — R$ ${Number(item.valorBase).toFixed(2)}</option>
    `).join('');
  }

  async function updatePreview() {
    if (!orcPeca.value) {
      orcPreviewValor.textContent = 'Selecione a área, a peça e a urgência para visualizar o valor automático.';
      return;
    }

    const response = await fetch('/api/solicitacoes/calcular', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pecaId: orcPeca.value, urgencia: orcUrgencia.value })
    });
    const data = await response.json();

    if (!response.ok) {
      orcPreviewValor.textContent = data.message || 'Não foi possível calcular o valor.';
      return;
    }

    orcPreviewValor.innerHTML = `
      <strong>Valor final: R$ ${Number(data.composicao.total).toFixed(2)}</strong><br>
      Base: R$ ${Number(data.composicao.valorBase).toFixed(2)}<br>
      Adicional de urgência: R$ ${Number(data.composicao.adicionalUrgencia).toFixed(2)} (${data.composicao.percentualUrgencia}%)<br>
      Taxa da plataforma: R$ ${Number(data.composicao.taxaPlataforma).toFixed(2)} (${data.composicao.percentualTaxaPlataforma}%)
    `;
  }

  orcArea?.addEventListener('change', () => {
    fillPecas(orcArea.value);
    orcPreviewValor.textContent = 'Selecione a peça e a urgência para visualizar o valor automático.';
  });

  orcPeca?.addEventListener('change', updatePreview);
  orcUrgencia?.addEventListener('change', updatePreview);

  orcamentoForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      nome: document.getElementById('orcNome').value.trim(),
      email: document.getElementById('orcEmail').value.trim(),
      whatsapp: document.getElementById('orcWhatsapp').value.trim(),
      area: document.getElementById('orcArea').value.trim(),
      pecaId: document.getElementById('orcPeca').value,
      urgencia: document.getElementById('orcUrgencia').value,
      descricao: document.getElementById('orcDescricao').value.trim()
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

    orcResultadoPedido.style.display = 'block';
    orcResultadoPedido.innerHTML = `
      <div class="notice-success">Pedido gerado com sucesso.</div>
      <p><strong>Protocolo:</strong> ${data.pedido.protocolo}</p>
      <p><strong>Área:</strong> ${data.pedido.area}</p>
      <p><strong>Peça:</strong> ${data.pedido.tipoPeca}</p>
      <p><strong>Valor:</strong> R$ ${Number(data.pedido.valor).toFixed(2)}</p>
      <p><strong>Status:</strong> ${data.pedido.status}</p>
      <div class="inline-actions top-gap-sm">
        <a class="btn btn-primary" href="${data.pedido.pagamento.checkoutUrl}">Ir para checkout</a>
        <a class="btn btn-secondary btn-secondary-dark" href="/admin.html">Ver no painel</a>
      </div>
      <p class="muted top-gap-sm">Nesta versão, o pedido já é criado no backend. O checkout real pode ser conectado ao gateway na próxima etapa.</p>
    `;

    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  });

  loadPricing()
    .then(() => {
      const initialArea = getAreaFromQuery();
      fillAreas(initialArea);
      fillPecas(initialArea);
      if (initialArea) {
        document.getElementById('orcPreviewValor').textContent = 'Selecione a peça e a urgência para visualizar o valor automático.';
      }
    })
    .catch(() => {
      orcPreviewValor.textContent = 'Não foi possível carregar a tabela de preços.';
    });
});
