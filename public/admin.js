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

function currency(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function createMetricCard(title, value) {
  return `<div class="mini-card"><strong>${title}</strong><span>${value}</span></div>`;
}

async function loadMetrics() {
  const data = await fetchJson('/api/admin/metrics');
  document.getElementById('metricsGrid').innerHTML = [
    createMetricCard('Pedidos totais', data.totalOrders),
    createMetricCard('Pagamentos pendentes', data.pendingPayment),
    createMetricCard('Pagamentos aprovados', data.approvedPayment),
    createMetricCard('Em execução', data.inProgress),
    createMetricCard('Receita aprovada', currency(data.totalRevenue))
  ].join('');
}

async function loadOrders() {
  const data = await fetchJson('/api/admin/orders');
  const wrap = document.getElementById('ordersTableWrap');

  if (!data.orders.length) {
    wrap.innerHTML = '<p>Nenhuma solicitação cadastrada até o momento.</p>';
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Pedido</th>
          <th>Cliente</th>
          <th>Peça</th>
          <th>Total</th>
          <th>Status</th>
          <th>Pagamento</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${data.orders.map((order) => `
          <tr>
            <td>${order.id}<br><small>${new Date(order.createdAt).toLocaleString('pt-BR')}</small></td>
            <td>${order.customer.name}<br><small>${order.customer.email}</small></td>
            <td>${order.area} — ${order.pieceName}</td>
            <td>${currency(order.pricing.total)}</td>
            <td>
              <select data-order-id="${order.id}" data-field="status">
                ${['aguardando_pagamento','aguardando_distribuicao','em_execucao','concluido','cancelado'].map((status) => `<option value="${status}" ${order.status === status ? 'selected' : ''}>${status}</option>`).join('')}
              </select>
            </td>
            <td>
              <select data-order-id="${order.id}" data-field="paymentStatus">
                ${['pending','approved','rejected'].map((status) => `<option value="${status}" ${order.paymentStatus === status ? 'selected' : ''}>${status}</option>`).join('')}
              </select>
            </td>
            <td>
              <button class="btn btn-outline small save-order" data-order-id="${order.id}">Salvar</button>
              ${order.whatsappUrl ? `<a class="btn btn-outline small" href="${order.whatsappUrl}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  wrap.querySelectorAll('.save-order').forEach((button) => {
    button.addEventListener('click', async () => {
      const orderId = button.dataset.orderId;
      const status = wrap.querySelector(`select[data-order-id="${orderId}"][data-field="status"]`).value;
      const paymentStatus = wrap.querySelector(`select[data-order-id="${orderId}"][data-field="paymentStatus"]`).value;
      await fetchJson(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, paymentStatus })
      });
      await loadMetrics();
      alert('Pedido atualizado com sucesso.');
    });
  });
}

async function loadPieces() {
  const data = await fetchJson('/api/admin/pieces');
  const wrap = document.getElementById('piecesTableWrap');
  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Área</th>
          <th>Peça</th>
          <th>Valor-base</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${data.pieces.map((piece) => `
          <tr>
            <td><input data-piece-id="${piece.id}" data-field="area" value="${piece.area}"></td>
            <td><input data-piece-id="${piece.id}" data-field="name" value="${piece.name}"></td>
            <td><input data-piece-id="${piece.id}" data-field="basePrice" type="number" step="0.01" value="${piece.basePrice}"></td>
            <td><button class="btn btn-outline small save-piece" data-piece-id="${piece.id}">Salvar</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  wrap.querySelectorAll('.save-piece').forEach((button) => {
    button.addEventListener('click', async () => {
      const pieceId = button.dataset.pieceId;
      const area = wrap.querySelector(`input[data-piece-id="${pieceId}"][data-field="area"]`).value;
      const name = wrap.querySelector(`input[data-piece-id="${pieceId}"][data-field="name"]`).value;
      const basePrice = wrap.querySelector(`input[data-piece-id="${pieceId}"][data-field="basePrice"]`).value;
      await fetchJson(`/api/admin/pieces/${pieceId}`, {
        method: 'PUT',
        body: JSON.stringify({ area, name, basePrice })
      });
      alert('Peça atualizada com sucesso.');
    });
  });

  renderSettingsForm(data.settings);
}

function renderSettingsForm(settings) {
  const form = document.getElementById('settingsForm');
  form.innerHTML = [
    ['platformFeePercent', 'Taxa da plataforma (%)'],
    ['urgent24hPercent', 'Adicional urgência 24h (%)'],
    ['urgent12hPercent', 'Adicional urgência 12h (%)'],
    ['hearingPercent', 'Adicional audiência/diligência (%)'],
    ['weekendPercent', 'Adicional fim de semana/feriado (%)']
  ].map(([key, label]) => `
    <div class="field">
      <label for="${key}">${label}</label>
      <input id="${key}" type="number" step="0.01" value="${settings[key] ?? 0}">
    </div>
  `).join('') + '<button type="submit" class="btn btn-primary full">Salvar configurações</button>';

  form.onsubmit = async (event) => {
    event.preventDefault();
    const payload = {
      platformFeePercent: Number(document.getElementById('platformFeePercent').value),
      urgent24hPercent: Number(document.getElementById('urgent24hPercent').value),
      urgent12hPercent: Number(document.getElementById('urgent12hPercent').value),
      hearingPercent: Number(document.getElementById('hearingPercent').value),
      weekendPercent: Number(document.getElementById('weekendPercent').value)
    };
    await fetchJson('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    alert('Configurações salvas com sucesso.');
  };
}

Promise.all([loadMetrics(), loadOrders(), loadPieces()]).catch((error) => {
  alert(error.message || 'Erro ao carregar o painel.');
});
