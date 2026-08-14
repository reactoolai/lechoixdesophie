import './style.css';
import './auth.css';
import { supabase } from './supabase.js';

/* ---------- État ---------- */
let currentUser = null;

/* ---------- Helpers DOM ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const ce = (tag, attrs = {}, children = []) => {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v);
  });
  children.forEach((c) => el.append(c));
  return el;
};

/* ---------- Infolettre ---------- */
document.querySelector('.news-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  alert('Merci ! Vous êtes maintenant abonnée à l\'infolettre du Choix de Sophie.');
});

/* ---------- Construction du modal d'authentification ---------- */
function buildAuthModal() {
  const overlay = ce('div', { class: 'auth-overlay', id: 'authOverlay' });
  const modal = ce('div', { class: 'auth-modal' });

  const closeBtn = ce('button', { class: 'auth-close', 'aria-label': 'Fermer' });
  closeBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 4 L14 14 M14 4 L4 14" stroke="currentColor" stroke-width="1.3"/></svg>';
  closeBtn.addEventListener('click', closeAuth);

  const surtitre = ce('div', { class: 'surtitre' }, []);
  surtitre.textContent = 'Espace cliente';

  const title = ce('h2', {}, []);
  title.textContent = 'Bienvenue';

  const sub = ce('p', { class: 'auth-sub' }, []);
  sub.textContent = 'Connectez-vous ou créez un compte pour poursuivre.';

  const tabs = ce('div', { class: 'auth-tabs' });
  const tabConnexion = ce('button', { class: 'auth-tab active' }, []);
  tabConnexion.textContent = 'Connexion';
  const tabInscription = ce('button', { class: 'auth-tab' }, []);
  tabInscription.textContent = 'Inscription';
  tabs.append(tabConnexion, tabInscription);

  const errorBox = ce('div', { class: 'auth-error', id: 'authError' });
  const successBox = ce('div', { class: 'auth-success', id: 'authSuccess' });

  /* Formulaire de connexion */
  const formConnexion = ce('form', { class: 'auth-form active', id: 'formConnexion' });
  formConnexion.innerHTML = `
    <div class="auth-field">
      <label for="login-email">Courriel</label>
      <input type="email" id="login-email" autocomplete="email" required>
    </div>
    <div class="auth-field">
      <label for="login-password">Mot de passe</label>
      <input type="password" id="login-password" autocomplete="current-password" required>
    </div>
    <button type="submit" class="auth-submit">Se connecter</button>
  `;

  /* Formulaire d'inscription */
  const formInscription = ce('form', { class: 'auth-form', id: 'formInscription' });
  formInscription.innerHTML = `
    <div class="auth-field">
      <label for="signup-email">Courriel</label>
      <input type="email" id="signup-email" autocomplete="email" required>
    </div>
    <div class="auth-field">
      <label for="signup-password">Mot de passe</label>
      <input type="password" id="signup-password" autocomplete="new-password" minlength="6" required>
    </div>
    <div class="auth-field">
      <label for="signup-confirm">Confirmer le mot de passe</label>
      <input type="password" id="signup-confirm" autocomplete="new-password" minlength="6" required>
    </div>
    <button type="submit" class="auth-submit">Créer mon compte</button>
  `;

  modal.append(closeBtn, surtitre, title, sub, tabs, errorBox, successBox, formConnexion, formInscription);
  overlay.append(modal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeAuth();
  });
  document.body.append(overlay);

  /* Gestion des onglets */
  tabConnexion.addEventListener('click', () => {
    tabConnexion.classList.add('active');
    tabInscription.classList.remove('active');
    formConnexion.classList.add('active');
    formInscription.classList.remove('active');
    hideMessages();
  });
  tabInscription.addEventListener('click', () => {
    tabInscription.classList.add('active');
    tabConnexion.classList.remove('active');
    formInscription.classList.add('active');
    formConnexion.classList.remove('active');
    hideMessages();
  });

  /* Soumission des formulaires */
  formConnexion.addEventListener('submit', handleLogin);
  formInscription.addEventListener('submit', handleSignUp);
}

function hideMessages() {
  $('#authError')?.classList.remove('show');
  $('#authSuccess')?.classList.remove('show');
}

function showError(msg) {
  const box = $('#authError');
  if (!box) return;
  box.textContent = msg;
  box.classList.add('show');
  $('#authSuccess')?.classList.remove('show');
}

function showSuccess(msg) {
  const box = $('#authSuccess');
  if (!box) return;
  box.textContent = msg;
  box.classList.add('show');
  $('#authError')?.classList.remove('show');
}

/* ---------- Ouverture / fermeture du modal ---------- */
function openAuth() {
  $('#authOverlay')?.classList.add('open');
}
function closeAuth() {
  $('#authOverlay')?.classList.remove('open');
}

/* ---------- Connexion ---------- */
async function handleLogin(e) {
  e.preventDefault();
  hideMessages();
  const email = $('#login-email').value.trim();
  const password = $('#login-password').value;
  const btn = e.target.querySelector('.auth-submit');
  btn.disabled = true;
  btn.textContent = 'Connexion…';

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  btn.disabled = false;
  btn.textContent = 'Se connecter';

  if (error) {
    showError('Courriel ou mot de passe incorrect.');
    return;
  }
  currentUser = data.user;
  closeAuth();
  renderAuthState();
}

/* ---------- Inscription ---------- */
async function handleSignUp(e) {
  e.preventDefault();
  hideMessages();
  const email = $('#signup-email').value.trim();
  const password = $('#signup-password').value;
  const confirm = $('#signup-confirm').value;

  if (password !== confirm) {
    showError('Les deux mots de passe ne correspondent pas.');
    return;
  }
  if (password.length < 6) {
    showError('Le mot de passe doit contenir au moins 6 caractères.');
    return;
  }

  const btn = e.target.querySelector('.auth-submit');
  btn.disabled = true;
  btn.textContent = 'Création…';

  const { data, error } = await supabase.auth.signUp({ email, password });
  btn.disabled = false;
  btn.textContent = 'Créer mon compte';

  if (error) {
    showError(error.message || 'Une erreur est survenue lors de l\'inscription.');
    return;
  }
  if (data.user) {
    showSuccess('Compte créé avec bienvenue ! Vous pouvez maintenant vous connecter.');
    e.target.reset();
    /* Basculer vers l'onglet connexion */
    document.querySelectorAll('.auth-tab').forEach((t) => t.classList.remove('active'));
    document.querySelector('.auth-form').classList.remove('active');
    const tabConnexion = document.querySelectorAll('.auth-tab')[0];
    const formConnexion = $('#formConnexion');
    tabConnexion.classList.add('active');
    formConnexion.classList.add('active');
    $('#login-email').value = email;
  }
}

/* ---------- Déconnexion ---------- */
async function handleLogout() {
  await supabase.auth.signOut();
  currentUser = null;
  renderAuthState();
}

/* ---------- Rendu de l'état d'authentification dans l'en-tête ---------- */
function renderAuthState() {
  const connexionSlot = document.querySelector('.icons').children[0];
  if (!connexionSlot) return;

  /* Supprimer tout menu utilisateur précédent */
  const existingMenu = $('#authUserMenu');
  if (existingMenu) existingMenu.remove();

  if (currentUser) {
    /* Utilisateur connecté : remplacer par le menu utilisateur */
    const isAdmin = currentUser.email === 'info@lechoixdesophie.com';
    const wrapper = ce('div', { class: 'auth-user-menu', id: 'authUserMenu' });

    const btn = ce('button', { class: 'auth-user-btn' });
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="6.5" r="3.5" stroke="#141416" stroke-width="1.1"/><path d="M3.5 17.5c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5" stroke="#141416" stroke-width="1.1"/></svg>
      <span>Mon compte</span>
    `;

    const dropdown = ce('div', { class: 'auth-dropdown' });
    const emailLine = ce('div', { class: 'auth-dropdown-email' });
    emailLine.textContent = currentUser.email;
    if (isAdmin) {
      const badge = ce('span', { class: 'auth-badge-admin' }, []);
      badge.textContent = 'Admin';
      emailLine.append(badge);
    }
    const divider = ce('div', { class: 'auth-dropdown-divider' });
    const logoutItem = ce('button', { class: 'auth-dropdown-item' }, []);
    logoutItem.textContent = 'Se déconnecter';
    logoutItem.addEventListener('click', handleLogout);

    dropdown.append(emailLine, divider, logoutItem);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });
    document.addEventListener('click', () => dropdown.classList.remove('show'));

    wrapper.append(btn, dropdown);
    connexionSlot.replaceWith(wrapper);
  } else {
    /* Visiteur : bouton Connexion */
    const link = ce('a', { href: '#' });
    link.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="6.5" r="3.5" stroke="#141416" stroke-width="1.1"/><path d="M3.5 17.5c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5" stroke="#141416" stroke-width="1.1"/></svg>
      Connexion
    `;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      openAuth();
    });
    connexionSlot.replaceWith(link);
  }
}

/* ---------- Initialisation ---------- */
async function initAuth() {
  buildAuthModal();

  /* Récupérer la session existante */
  const { data: { session } } = await supabase.auth.getSession();
  if (session) currentUser = session.user;
  renderAuthState();

  /* Écouter les changements d'état d'authentification */
  supabase.auth.onAuthStateChange((_event, session) => {
    (async () => {
      currentUser = session?.user ?? null;
      renderAuthState();
    })();
  });

  /* Brancher le bouton Connexion initial */
  const connexionLink = document.querySelector('.icons a');
  if (connexionLink && connexionLink.textContent.includes('Connexion')) {
    connexionLink.addEventListener('click', (e) => {
      e.preventDefault();
      openAuth();
    });
  }
}

initAuth();
