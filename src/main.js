import './style.css';
import './auth.css';
import { supabase } from './supabase.js';

/* ---------- État ---------- */
let currentUser = null;
let allProducts = [];
let currentRoute = { page: 'home', category: null };
let catalogState = {
  category: 'Nouveautés',
  filters: { inStock: false, colors: new Set(), sizes: new Set(), priceMin: null, priceMax: null },
  sort: 'recent',
  visibleCount: 12,
};

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

function formatPrice(price) {
  const num = typeof price === 'number' ? price : parseFloat(price);
  if (isNaN(num)) return '';
  return num.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $';
}

const FALLBACK_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='440'%3E%3Crect fill='%23F3ECDF' width='400' height='440'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='%238A8377' font-size='14'%3EImage à venir%3C/text%3E%3C/svg%3E";

/* ---------- Chargement produits ---------- */
async function loadProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('date_created', { ascending: false });

  if (error) {
    console.error('Erreur chargement produits:', error);
    return;
  }
  allProducts = data || [];
  renderCurrentPage();
}

/* ---------- Routing ---------- */
function parseRoute() {
  const hash = window.location.hash.slice(1);
  if (hash.startsWith('/cat/')) {
    const category = decodeURIComponent(hash.slice(5));
    return { page: 'catalog', category };
  }
  return { page: 'home', category: null };
}

function navigate() {
  currentRoute = parseRoute();
  if (currentRoute.page === 'catalog') {
    catalogState.category = currentRoute.category;
    catalogState.visibleCount = 12;
    catalogState.filters = { inStock: false, colors: new Set(), sizes: new Set(), priceMin: null, priceMax: null };
    catalogState.sort = 'recent';
    $('#sortSelect').value = 'recent';
    $('#filterInStock').checked = false;
    $('#priceMin').value = '';
    $('#priceMax').value = '';
  }
  renderCurrentPage();
}

function renderCurrentPage() {
  if (currentRoute.page === 'home') {
    $('#page-home').style.display = '';
    $('#page-catalog').style.display = 'none';
    renderHomePreview();
  } else {
    $('#page-home').style.display = 'none';
    $('#page-catalog').style.display = '';
    renderCatalog();
  }
  window.scrollTo(0, 0);
}

/* ---------- Page d'accueil: aperçu ---------- */
function renderHomePreview() {
  const grid = $('#homePreviewGrid');
  const nouveautes = allProducts.filter((p) => p.is_new).slice(0, 8);
  if (nouveautes.length === 0) {
    grid.innerHTML = '<div class="loading-msg">Aucun produit pour le moment.</div>';
    return;
  }
  grid.innerHTML = '';
  nouveautes.forEach((p) => grid.append(buildProductCard(p)));
}

/* ---------- Page catalogue ---------- */
function getCatalogProducts() {
  let products;
  if (catalogState.category === 'Nouveautés') {
    products = allProducts.filter((p) => p.is_new);
  } else {
    products = allProducts.filter((p) => p.category === catalogState.category);
  }

  const f = catalogState.filters;
  if (f.inStock) products = products.filter((p) => p.total_qt > 0);
  if (f.colors.size > 0) {
    products = products.filter((p) => {
      const colors = Array.isArray(p.colors) ? p.colors : [];
      return colors.some((c) => f.colors.has(c));
    });
  }
  if (f.sizes.size > 0) {
    products = products.filter((p) => {
      const sizes = Array.isArray(p.sizes) ? p.sizes : [];
      return sizes.some((s) => f.sizes.has(s));
    });
  }
  if (f.priceMin != null) products = products.filter((p) => parseFloat(p.price) >= f.priceMin);
  if (f.priceMax != null) products = products.filter((p) => parseFloat(p.price) <= f.priceMax);

  const sort = catalogState.sort;
  if (sort === 'price-asc') products = [...products].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
  else if (sort === 'price-desc') products = [...products].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
  else if (sort === 'name') products = [...products].sort((a, b) => (a.description || '').localeCompare(b.description || '', 'fr'));

  return products;
}

function renderCatalog() {
  const title = $('#catalogTitle');
  const breadcrumbCat = $('#breadcrumbCat');
  const countEl = $('#catalogCount');

  title.textContent = catalogState.category;
  breadcrumbCat.textContent = catalogState.category;

  buildFilterChips();

  const products = getCatalogProducts();
  countEl.textContent = `${products.length} produit${products.length > 1 ? 's' : ''}`;

  const grid = $('#catalogGrid');
  if (products.length === 0) {
    grid.innerHTML = '<div class="loading-msg">Aucun produit ne correspond à vos filtres.</div>';
    $('#loadMoreWrap').style.display = 'none';
    return;
  }

  const visible = products.slice(0, catalogState.visibleCount);
  grid.innerHTML = '';
  visible.forEach((p) => grid.append(buildProductCard(p)));

  const hasMore = products.length > catalogState.visibleCount;
  $('#loadMoreWrap').style.display = hasMore ? 'block' : 'none';
}

function buildFilterChips() {
  let products;
  if (catalogState.category === 'Nouveautés') {
    products = allProducts.filter((p) => p.is_new);
  } else {
    products = allProducts.filter((p) => p.category === catalogState.category);
  }

  const colorSet = new Set();
  const sizeSet = new Set();
  products.forEach((p) => {
    (Array.isArray(p.colors) ? p.colors : []).forEach((c) => { if (c) colorSet.add(c); });
    (Array.isArray(p.sizes) ? p.sizes : []).forEach((s) => { if (s) sizeSet.add(s); });
  });

  const colorsContainer = $('#filterColors');
  colorsContainer.innerHTML = '';
  [...colorSet].sort().forEach((color) => {
    const chip = ce('button', { class: 'chip' });
    chip.textContent = color;
    chip.addEventListener('click', () => {
      if (catalogState.filters.colors.has(color)) {
        catalogState.filters.colors.delete(color);
        chip.classList.remove('active');
      } else {
        catalogState.filters.colors.add(color);
        chip.classList.add('active');
      }
      catalogState.visibleCount = 12;
      renderCatalog();
    });
    colorsContainer.append(chip);
  });

  const sizesContainer = $('#filterSizes');
  sizesContainer.innerHTML = '';
  const sizeOrder = ['TP/XS','P/S','M/M','G/L','TG/XL','XXL','24','25','26','27','28','29','30','31','32','33','34','36','38','40','42','44','46','1/2','3/4','5/6','7/8','9/10','11/12','13/14'];
  const sortedSizes = [...sizeSet].sort((a, b) => {
    const ia = sizeOrder.indexOf(a);
    const ib = sizeOrder.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
  sortedSizes.forEach((size) => {
    const chip = ce('button', { class: 'chip' });
    chip.textContent = size;
    chip.addEventListener('click', () => {
      if (catalogState.filters.sizes.has(size)) {
        catalogState.filters.sizes.delete(size);
        chip.classList.remove('active');
      } else {
        catalogState.filters.sizes.add(size);
        chip.classList.add('active');
      }
      catalogState.visibleCount = 12;
      renderCatalog();
    });
    sizesContainer.append(chip);
  });
}

/* ---------- Carte produit ---------- */
function buildProductCard(p) {
  const imgSrc = Array.isArray(p.images) && p.images.length > 0
    ? `/images/products/${p.images[0]}`
    : FALLBACK_IMG;

  const card = ce('div', { class: 'prod' });
  const tags = [];
  if (p.is_new) tags.push('<span class="tag">Nouveau</span>');
  if (p.total_qt === 0) tags.push('<span class="tag tag-soldout">Épuisé</span>');

  card.innerHTML = `
    <div class="ph">
      <img src="${imgSrc}" alt="${p.description || ''}" loading="lazy" onerror="this.src='${FALLBACK_IMG}'">
      ${tags.join('')}
    </div>
    <div class="prod-info">
      <div class="prod-nom">${p.description || ''}</div>
      <div class="prod-prix">${formatPrice(p.price)}</div>
    </div>
  `;
  return card;
}

/* ---------- Navigation & events ---------- */
function setupEvents() {
  $('#loadMoreBtn')?.addEventListener('click', () => {
    catalogState.visibleCount += 12;
    renderCatalog();
  });

  $('#sortSelect')?.addEventListener('change', (e) => {
    catalogState.sort = e.target.value;
    catalogState.visibleCount = 12;
    renderCatalog();
  });

  $('#filterInStock')?.addEventListener('change', (e) => {
    catalogState.filters.inStock = e.target.checked;
    catalogState.visibleCount = 12;
    renderCatalog();
  });

  $('#priceMin')?.addEventListener('input', (e) => {
    catalogState.filters.priceMin = e.target.value ? parseFloat(e.target.value) : null;
    catalogState.visibleCount = 12;
    renderCatalog();
  });

  $('#priceMax')?.addEventListener('input', (e) => {
    catalogState.filters.priceMax = e.target.value ? parseFloat(e.target.value) : null;
    catalogState.visibleCount = 12;
    renderCatalog();
  });

  $('#resetFilters')?.addEventListener('click', () => {
    catalogState.filters = { inStock: false, colors: new Set(), sizes: new Set(), priceMin: null, priceMax: null };
    catalogState.visibleCount = 12;
    $('#filterInStock').checked = false;
    $('#priceMin').value = '';
    $('#priceMax').value = '';
    document.querySelectorAll('.chip.active').forEach((c) => c.classList.remove('active'));
    renderCatalog();
  });

  $('#filterToggle')?.addEventListener('click', () => {
    $('#filterSidebar').classList.add('open');
    $('#filterOverlay').classList.add('show');
  });

  $('#filterOverlay')?.addEventListener('click', () => {
    $('#filterSidebar').classList.remove('open');
    $('#filterOverlay').classList.remove('show');
  });

  document.querySelectorAll('.filter-title').forEach((title) => {
    title.addEventListener('click', () => {
      title.closest('.filter-group').classList.toggle('collapsed');
    });
  });

  $('#searchInput')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (!term) return;
    const results = allProducts.filter((p) =>
      (p.description || '').toLowerCase().includes(term) ||
      (p.fournisseur || '').toLowerCase().includes(term) ||
      (p.category || '').toLowerCase().includes(term) ||
      (p.season || '').toLowerCase().includes(term)
    );
    if (results.length > 0) {
      window.location.hash = `#/cat/${results[0].category}`;
    }
  });

  document.querySelector('.news-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Merci ! Vous êtes maintenant abonnée à l\'infolettre du Choix de Sophie.');
  });

  window.addEventListener('hashchange', navigate);
}

/* ---------- Auth ---------- */
function buildAuthModal() {
  const overlay = ce('div', { class: 'auth-overlay', id: 'authOverlay' });
  const modal = ce('div', { class: 'auth-modal' });
  const closeBtn = ce('button', { class: 'auth-close', 'aria-label': 'Fermer' });
  closeBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 4 L14 14 M14 4 L4 14" stroke="currentColor" stroke-width="1.3"/></svg>';
  closeBtn.addEventListener('click', closeAuth);
  const surtitre = ce('div', { class: 'surtitre' });
  surtitre.textContent = 'Espace cliente';
  const title = ce('h2');
  title.textContent = 'Bienvenue';
  const sub = ce('p', { class: 'auth-sub' });
  sub.textContent = 'Connectez-vous ou créez un compte pour poursuivre.';
  const tabs = ce('div', { class: 'auth-tabs' });
  const tabConnexion = ce('button', { class: 'auth-tab active' });
  tabConnexion.textContent = 'Connexion';
  const tabInscription = ce('button', { class: 'auth-tab' });
  tabInscription.textContent = 'Inscription';
  tabs.append(tabConnexion, tabInscription);
  const errorBox = ce('div', { class: 'auth-error', id: 'authError' });
  const successBox = ce('div', { class: 'auth-success', id: 'authSuccess' });
  const formConnexion = ce('form', { class: 'auth-form active', id: 'formConnexion' });
  formConnexion.innerHTML = `
    <div class="auth-field"><label for="login-email">Courriel</label><input type="email" id="login-email" autocomplete="email" required></div>
    <div class="auth-field"><label for="login-password">Mot de passe</label><input type="password" id="login-password" autocomplete="current-password" required></div>
    <button type="submit" class="auth-submit">Se connecter</button>`;
  const formInscription = ce('form', { class: 'auth-form', id: 'formInscription' });
  formInscription.innerHTML = `
    <div class="auth-field"><label for="signup-email">Courriel</label><input type="email" id="signup-email" autocomplete="email" required></div>
    <div class="auth-field"><label for="signup-password">Mot de passe</label><input type="password" id="signup-password" autocomplete="new-password" minlength="6" required></div>
    <div class="auth-field"><label for="signup-confirm">Confirmer le mot de passe</label><input type="password" id="signup-confirm" autocomplete="new-password" minlength="6" required></div>
    <button type="submit" class="auth-submit">Créer mon compte</button>`;
  modal.append(closeBtn, surtitre, title, sub, tabs, errorBox, successBox, formConnexion, formInscription);
  overlay.append(modal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAuth(); });
  document.body.append(overlay);
  tabConnexion.addEventListener('click', () => {
    tabConnexion.classList.add('active'); tabInscription.classList.remove('active');
    formConnexion.classList.add('active'); formInscription.classList.remove('active'); hideMessages();
  });
  tabInscription.addEventListener('click', () => {
    tabInscription.classList.add('active'); tabConnexion.classList.remove('active');
    formInscription.classList.add('active'); formConnexion.classList.remove('active'); hideMessages();
  });
  formConnexion.addEventListener('submit', handleLogin);
  formInscription.addEventListener('submit', handleSignUp);
}

function hideMessages() { $('#authError')?.classList.remove('show'); $('#authSuccess')?.classList.remove('show'); }
function showError(msg) { const b = $('#authError'); if (!b) return; b.textContent = msg; b.classList.add('show'); $('#authSuccess')?.classList.remove('show'); }
function showSuccess(msg) { const b = $('#authSuccess'); if (!b) return; b.textContent = msg; b.classList.add('show'); $('#authError')?.classList.remove('show'); }
function openAuth() { $('#authOverlay')?.classList.add('open'); }
function closeAuth() { $('#authOverlay')?.classList.remove('open'); }

async function handleLogin(e) {
  e.preventDefault(); hideMessages();
  const email = $('#login-email').value.trim();
  const password = $('#login-password').value;
  const btn = e.target.querySelector('.auth-submit');
  btn.disabled = true; btn.textContent = 'Connexion…';
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  btn.disabled = false; btn.textContent = 'Se connecter';
  if (error) { showError('Courriel ou mot de passe incorrect.'); return; }
  currentUser = data.user; closeAuth(); renderAuthState();
}

async function handleSignUp(e) {
  e.preventDefault(); hideMessages();
  const email = $('#signup-email').value.trim();
  const password = $('#signup-password').value;
  const confirm = $('#signup-confirm').value;
  if (password !== confirm) { showError('Les deux mots de passe ne correspondent pas.'); return; }
  if (password.length < 6) { showError('Le mot de passe doit contenir au moins 6 caractères.'); return; }
  const btn = e.target.querySelector('.auth-submit');
  btn.disabled = true; btn.textContent = 'Création…';
  const { data, error } = await supabase.auth.signUp({ email, password });
  btn.disabled = false; btn.textContent = 'Créer mon compte';
  if (error) { showError(error.message || 'Une erreur est survenue.'); return; }
  if (data.user) {
    showSuccess('Compte créé ! Vous pouvez maintenant vous connecter.');
    e.target.reset();
    document.querySelectorAll('.auth-tab').forEach((t) => t.classList.remove('active'));
    document.querySelector('.auth-form').classList.remove('active');
    document.querySelectorAll('.auth-tab')[0].classList.add('active');
    $('#formConnexion').classList.add('active');
    $('#login-email').value = email;
  }
}

async function handleLogout() { await supabase.auth.signOut(); currentUser = null; renderAuthState(); }

function renderAuthState() {
  const slot = document.querySelector('.icons').children[0];
  if (!slot) return;
  const existing = $('#authUserMenu');
  if (existing) existing.remove();
  if (currentUser) {
    const isAdmin = currentUser.email === 'info@lechoixdesophie.com';
    const wrapper = ce('div', { class: 'auth-user-menu', id: 'authUserMenu' });
    const btn = ce('button', { class: 'auth-user-btn' });
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="6.5" r="3.5" stroke="#141416" stroke-width="1.1"/><path d="M3.5 17.5c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5" stroke="#141416" stroke-width="1.1"/></svg><span>Mon compte</span>';
    const dropdown = ce('div', { class: 'auth-dropdown' });
    const emailLine = ce('div', { class: 'auth-dropdown-email' });
    emailLine.textContent = currentUser.email;
    if (isAdmin) { const badge = ce('span', { class: 'auth-badge-admin' }); badge.textContent = 'Admin'; emailLine.append(badge); }
    const divider = ce('div', { class: 'auth-dropdown-divider' });
    const logoutItem = ce('button', { class: 'auth-dropdown-item' });
    logoutItem.textContent = 'Se déconnecter';
    logoutItem.addEventListener('click', handleLogout);
    dropdown.append(emailLine, divider, logoutItem);
    btn.addEventListener('click', (e) => { e.stopPropagation(); dropdown.classList.toggle('show'); });
    document.addEventListener('click', () => dropdown.classList.remove('show'));
    wrapper.append(btn, dropdown);
    slot.replaceWith(wrapper);
  } else {
    const link = ce('a', { href: '#' });
    link.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="6.5" r="3.5" stroke="#141416" stroke-width="1.1"/><path d="M3.5 17.5c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5" stroke="#141416" stroke-width="1.1"/></svg>Connexion';
    link.addEventListener('click', (e) => { e.preventDefault(); openAuth(); });
    slot.replaceWith(link);
  }
}

/* ---------- Init ---------- */
async function init() {
  buildAuthModal();
  setupEvents();

  const { data: { session } } = await supabase.auth.getSession();
  if (session) currentUser = session.user;
  renderAuthState();

  supabase.auth.onAuthStateChange((_event, session) => {
    (async () => { currentUser = session?.user ?? null; renderAuthState(); })();
  });

  const connexionLink = document.querySelector('.icons a');
  if (connexionLink && connexionLink.textContent.includes('Connexion')) {
    connexionLink.addEventListener('click', (e) => { e.preventDefault(); openAuth(); });
  }

  navigate();
  await loadProducts();
}

init();
