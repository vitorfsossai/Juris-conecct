function moeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataHora(valor) {
  try {
    return new Date(valor).toLocaleString("pt-BR");
  } catch {
    return valor || "-";
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) throw new Error(data.message || data || "Erro na requisição.");
  return data;
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem("jurisconnect_user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function renderStats(stats) {
  document.getElementById("statsDelegado").innerHTML = `
    <div class="stat-card"><span class="muted">Demandas recebidas</span><strong>${stats.demandasRecebidas}</strong></div>
    <div class="stat-card"><span class="muted">Oportunidades abertas</span><strong>${stats.oportunidadesAbertas}</strong></div>
    <div class="stat-card"><span class="muted">Ganhos possíveis</span><strong>${moeda(stats.ganhosPossiveis)}</strong></div>
    <div class="stat-card"><span class="muted">Ganhos confirmados</span><strong>${moeda(stats.ganhosConfirmados)}</strong></div>
    <div class="stat-card"><span class="muted">Prazos próximos</span><strong>${stats.prazosProximos}</strong></div>
  `;
}

function statusLabel(item) {
  if (item.aceitoPorMim) return "Aceito por você";
  if (item.status === "disponivel_delegado") return "Disponível";
  return item.status;
}

function urgencyClass(urgencia) {
  return urgencia === "12h" || urgencia === "24h" ? "urgent" : "normal";
}

function renderTimeline(items, userId) {
  const container = document.getElementById("timelineOportunidades");
  if (!items.length) {
    container.innerHTML = `<div class="card"><p class="muted">Nenhuma oportunidade cadastrada no momento.</p></div>`;
    return;
  }

  container.innerHTML = items.map(item => `
    <article class="timeline-card ${item.aceitoPorMim ? "accepted" : ""}">
      <div class="timeline-dot"></div>
      <div class="timeline-content card">
        <div class="timeline-head">
          <div>
            <span class="badge ${urgencyClass(item.urgencia)}">${item.urgencia}</span>
            <span class="badge">${item.area}</span>
          </div>
          <strong>${moeda(item.valor)}</strong>
        </div>
        <h3>${item.tipoPeca}</h3>
        <p class="muted"><strong>Protocolo:</strong> ${item.protocolo} • <strong>Recebido em:</strong> ${dataHora(item.createdAt)}</p>
        <p>${item.detalhesFatos || item.descricao}</p>
        <div class="inline-actions">
          <span class="status-chip ${item.aceitoPorMim ? "success" : "pending"}">${statusLabel(item)}</span>
          ${item.aceitoPorMim ? `<span class="contact-box"><strong>Contato:</strong> ${item.contato?.nome || "-"} • ${item.contato?.email || "-"} • ${item.contato?.whatsapp || "-"}</span>` : `<button class="btn btn-primary btn-sm" data-aceitar="${item.id}">Aceitar trabalho</button>`}
        </div>
      </div>
    </article>
  `).join("");

  container.querySelectorAll("[data-aceitar]").forEach(btn => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await fetchJson(`/api/delegado/oportunidades/${btn.dataset.aceitar}/aceitar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId })
        });
        await loadPainel();
      } catch (error) {
        alert(error.message || "Erro ao aceitar oportunidade.");
        btn.disabled = false;
      }
    });
  });
}

function renderMinhasDemandas(items) {
  const tbody = document.getElementById("minhasDemandasBody");
  const minhas = items.filter(item => item.aceitoPorMim);
  tbody.innerHTML = minhas.map(item => `
    <tr>
      <td>${item.protocolo}</td>
      <td>${item.area}</td>
      <td>${item.tipoPeca}</td>
      <td>${item.urgencia}</td>
      <td>${moeda(item.valor)}</td>
      <td>${item.contato ? `${item.contato.nome}<br><span class="muted">${item.contato.email}<br>${item.contato.whatsapp}</span>` : "-"}</td>
    </tr>
  `).join("") || '<tr><td colspan="6">Você ainda não aceitou nenhuma demanda.</td></tr>';
}

function fillProfile(user) {
  document.getElementById("delegadoNome").textContent = `Olá, ${user.nome}`;
  document.getElementById("delegadoResumo").textContent = `Gestão centralizada de oportunidades, prazos e repasses para o advogado delegado. OAB: ${user.oab || "-"}.`;
  document.getElementById("perfilNome").value = user.nome || "";
  document.getElementById("perfilOab").value = user.oab || "";
  document.getElementById("perfilTelefone").value = user.perfilDelegado?.telefone || "";
  document.getElementById("perfilPix").value = user.perfilDelegado?.pix || "";
  document.getElementById("perfilBanco").value = user.perfilDelegado?.banco || "";
  document.getElementById("perfilAgencia").value = user.perfilDelegado?.agencia || "";
  document.getElementById("perfilConta").value = user.perfilDelegado?.conta || "";
  document.getElementById("perfilTipoConta").value = user.perfilDelegado?.tipoConta || "corrente";
  document.getElementById("perfilAreas").value = (user.perfilDelegado?.areasInteresse || []).join(", ");
  document.getElementById("perfilBio").value = user.perfilDelegado?.bio || "";
  document.getElementById("statusOabBadge").textContent = user.perfilDelegado?.oabValidada ? "OAB validada" : "Validação pendente";
}

async function loadPainel() {
  const currentUser = getCurrentUser();
  const userId = currentUser?.id || "";
  const data = await fetchJson(`/api/delegado/dashboard?userId=${encodeURIComponent(userId)}`);
  localStorage.setItem("jurisconnect_user", JSON.stringify(data.user));
  renderStats(data.stats);
  renderTimeline(data.timeline, data.user.id);
  renderMinhasDemandas(data.timeline);
  fillProfile(data.user);
}

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("btnAtualizarPainel").addEventListener("click", loadPainel);

  document.getElementById("perfilForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const currentUser = getCurrentUser();
    const feedback = document.getElementById("perfilFeedback");
    try {
      const payload = {
        nome: document.getElementById("perfilNome").value,
        oab: document.getElementById("perfilOab").value,
        telefone: document.getElementById("perfilTelefone").value,
        pix: document.getElementById("perfilPix").value,
        banco: document.getElementById("perfilBanco").value,
        agencia: document.getElementById("perfilAgencia").value,
        conta: document.getElementById("perfilConta").value,
        tipoConta: document.getElementById("perfilTipoConta").value,
        areasInteresse: document.getElementById("perfilAreas").value.split(",").map(item => item.trim()).filter(Boolean),
        bio: document.getElementById("perfilBio").value
      };
      const result = await fetchJson(`/api/delegado/perfil/${currentUser?.id || ""}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      localStorage.setItem("jurisconnect_user", JSON.stringify(result.user));
      feedback.textContent = "Cadastro atualizado com sucesso.";
      feedback.className = "feedback-inline notice-success";
      await loadPainel();
    } catch (error) {
      feedback.textContent = error.message || "Erro ao salvar cadastro.";
      feedback.className = "feedback-inline notice-danger";
    }
  });

  document.getElementById("suporteForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const currentUser = getCurrentUser();
    const feedback = document.getElementById("suporteFeedback");
    try {
      await fetchJson("/api/delegado/suporte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser?.id || "",
          assunto: document.getElementById("suporteAssunto").value,
          mensagem: document.getElementById("suporteMensagem").value
        })
      });
      document.getElementById("suporteForm").reset();
      feedback.textContent = "Pedido de suporte registrado com sucesso.";
      feedback.className = "feedback-inline notice-success";
      await loadPainel();
    } catch (error) {
      feedback.textContent = error.message || "Erro ao registrar suporte.";
      feedback.className = "feedback-inline notice-danger";
    }
  });

  await loadPainel();
});
