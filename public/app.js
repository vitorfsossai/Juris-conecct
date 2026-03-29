document.addEventListener('DOMContentLoaded', function () {
  const authModal = document.getElementById('authModal');
  const closeAuthModal = document.getElementById('closeAuthModal');
  const loginForm = document.getElementById('loginForm');
  const cadastroForm = document.getElementById('cadastroForm');
  const tabButtons = document.querySelectorAll('.modal-tab');
  const btnLogin = document.getElementById('btnLogin');
  const btnCadastro = document.getElementById('btnCadastro');
  const btnHeroCadastro = document.getElementById('btnHeroCadastro');

  function openModal(modal) {
    modal?.classList.add('show');
  }

  function closeModal(modal) {
    modal?.classList.remove('show');
  }

  function switchTab(tab) {
    tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
    if (loginForm) loginForm.style.display = tab === 'login' ? 'block' : 'none';
    if (cadastroForm) cadastroForm.style.display = tab === 'cadastro' ? 'block' : 'none';
  }

  btnLogin?.addEventListener('click', () => { switchTab('login'); openModal(authModal); });
  btnCadastro?.addEventListener('click', () => { switchTab('cadastro'); openModal(authModal); });
  btnHeroCadastro?.addEventListener('click', () => { switchTab('cadastro'); openModal(authModal); });
  closeAuthModal?.addEventListener('click', () => closeModal(authModal));
  authModal?.addEventListener('click', (e) => { if (e.target === authModal) closeModal(authModal); });
  tabButtons.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

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
});
