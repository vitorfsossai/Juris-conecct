async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Erro na requisição.');
  return data;
}

function moeda(valor) {
  return Number(valor || 0).toFixed(2);
}

async function loadStats() {
  const stats = await fetchJson('/api/stats');
  document.getElementById('stats').innerHTML = `
    <div class="stat-card"><span class="muted">Total de solicitações</span><strong>${stats.total}</strong></div>
    <div class="stat-card"><span class="muted">Aguardando pagamento</span><strong>${stats.aguardandoPagamento}</strong></div>
    <div class="stat-card"><span class="muted">Receita potencial</span><strong>R$ ${moeda(stats.receitaPotencial)}</strong></div>
    <div class="stat-card"><span class="muted">Usuários</span><strong>${stats.users}</strong></div>
  `;
}

async function loadPricing() {
  const pricing = await fetchJson('/api/pricing');
  document.getElementById('taxaPlataforma').value = pricing.taxaPlataformaPercentual;
  document.getElementById('urgNormal').value = pricing.urgencia.normal || 0;
  document.getElementById('urg48').value = pricing.urgencia['48h'] || 0;
  document.getElementById('urg24').value = pricing.urgencia['24h'] || 0;
  document.getElementById('urg12').value = pricing.urgencia['12h'] || 0;

  document.getElementById('pricingBody').innerHTML = pricing.pecas.map(item => `
    <tr>
      <td>${item.id}</td>
      <td><input data-id="${item.id}" data-field="area" value="${item.area}"></td>
      <td><input data-id="${item.id}" data-field="nome" value="${item.nome}"></td>
      <td><input type="number" step="0.01" data-id="${item.id}" data-field="valorBase" value="${item.valorBase}"></td>
      <td>
        <select data-id="${item.id}" data-field="ativo">
          <option value="true" ${item.ativo ? 'selected' : ''}>Sim</option>
          <option value="false" ${!item.ativo ? 'selected' : ''}>Não</option>
        </select>
      </td>
    </tr>
  `).join('');
}

async function savePricing() {
  const rows = [...document.querySelectorAll('#pricingBody tr')];
  const byId = new Map();
  rows.forEach(row => {
    row.querySelectorAll('input, select').forEach(el => {
      const id = el.dataset.id;
      const field = el.dataset.field;
      if (!byId.has(id)) byId.set(id, { id: Number(id) });
      byId.get(id)[field] = el.value;
    });
  });

  const pecas = [...byId.values()].map(item => ({
    id: Number(item.id),
    area: item.area,
    nome: item.nome,
    valorBase: Number(item.valorBase),
    ativo: String(item.ativo) === 'true'
  }));

  await fetchJson('/api/pricing', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taxaPlataformaPercentual: Number(document.getElementById('taxaPlataforma').value),
      urgencia: {
        normal: Number(document.getElementById('urgNormal').value),
        '48h': Number(document.getElementById('urg48').value),
        '24h': Number(document.getElementById('urg24').value),
        '12h': Number(document.getElementById('urg12').value)
      },
      pecas
    })
  });
  alert('Tabela de preços atualizada com sucesso.');
  await loadPricing();
}

async function loadSolicitacoes() {
  const itens = await fetchJson('/api/solicitacoes');
  document.getElementById('solicitacoesBody').innerHTML = itens.map(item => `
    <tr>
      <td>${item.protocolo}</td>
      <td>${item.nome}<br><span class="muted">${item.email}</span></td>
      <td>${item.area}</td>
      <td>${item.tipoPeca}</td>
      <td>${item.urgencia}</td>
      <td>R$ ${moeda(item.valor)}</td>
      <td>${item.status}</td>
    </tr>
  `).join('') || '<tr><td colspan="7">Nenhuma solicitação cadastrada.</td></tr>';
}

async function loadUsers() {
  const users = await fetchJson('/api/users');
  document.getElementById('usersBody').innerHTML = users.map(user => `
    <tr>
      <td>${user.nome}</td>
      <td>${user.email}</td>
      <td>${user.oab || '-'}</td>
      <td>${user.role}</td>
    </tr>
  `).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('salvarPricing').addEventListener('click', savePricing);
  await loadStats();
  await loadPricing();
  await loadSolicitacoes();
  await loadUsers();
});
