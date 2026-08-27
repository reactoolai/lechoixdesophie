import { supabase } from './supabase.js';

let allProducts = [];
let adminView = 'dashboard';
let adminSearchTerm = '';
let editingProduct = null;
let editingImages = [];

const FALLBACK_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='440'%3E%3Crect fill='%23F3ECDF' width='400' height='440'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='%238A8377' font-size='14'%3EImage à venir%3C/text%3E%3C/svg%3E";
const STORAGE_NEW = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/product-images/`;
const STORAGE_OLD = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/product-photos/products/`;
function adminImgUrl(filename) {
  if (!filename) return FALLBACK_IMG;
  if (filename.startsWith('http') || filename.startsWith('data:')) return filename;
  if (filename.includes('/')) return STORAGE_NEW + filename;
  return STORAGE_OLD + filename;
}

const COLOR_MAP = {
  noir: '#1a1a1a', black: '#1a1a1a', nero: '#1a1a1a', charbon: '#2a2a2a',
  blanc: '#f8f8f0', white: '#f8f8f0', offwhite: '#f0ece0', ecru: '#e8e2d4', creme: '#f5f0e0', ivoire: '#f3ecdf',
  blanc_casse: '#f0ece0', casse: '#f0ece0',
  beige: '#d9c9b0', nude: '#e0c4a8', taupe: '#b0a090', sable: '#c8b89c', camel: '#c19a6b', kaki: '#8a7a5a',
  naturel: '#e8e0d0', light_nude: '#e0c4a8',
  gris: '#8a8a8a', grey: '#8a8a8a', gray: '#8a8a8a', ardoise: '#5a5a5e', anthracite: '#3a3a3e', gris_pale: '#c0c0c0',
  brun: '#6b4e3a', marron: '#5a4030', chocolate: '#4a3020', cafe: '#5a3825', cognac: '#8a5a30',
  caramel: '#c08040', bronze: '#a07050', tan: '#c0a080',
  bleu: '#3a6a9a', blue: '#3a6a9a', marine: '#1a2a4a', navy: '#1a2a4a', denim: '#4a6a8a', ciel: '#a8c8e0', paon: '#1a4a4a',
  bleu_pale: '#7a9ac0', royal: '#1a3a9a',
  vert: '#4a7a4a', green: '#4a7a4a', olive: '#6a7a3a', sauge: '#9aaa8a', kaki_vert: '#7a8a5a', menthe: '#8ac8a0',
  sarcelle: '#40a090',
  rouge: '#b03030', red: '#b03030', bordeaux: '#6a1a1a', wine: '#7a1a2a', brique: '#9a4030', bourgogne: '#6a1a1a',
  rouille: '#a8502a',
  rose: '#e8a8b0', pink: '#e8a8b0', poudre: '#f0c8c8', corail: '#e87060', fuchsia: '#c8407a', fushia: '#c8407a',
  blush: '#f0c8c0', saumon: '#e8a890', peche: '#f0c0a0',
  jaune: '#e8c83a', yellow: '#e8c83a', moutarde: '#c8a020', or: '#c9a962', gold: '#c9a962',
  orange: '#e87830', rust: '#a8502a', terracotta: '#c0604a',
  violet: '#6a3a7a', purple: '#6a3a7a', mauve: '#9a7aaa', lavande: '#b8a8d0', lilas: '#b8a8d0',
  turquoise: '#40c0b0', aqua: '#50b8c8',
  argent: '#c8c8c8', silver: '#c8c8c8', metal: '#b0b0b8',
  multi: 'multi', assorted: 'multi', varie: 'multi', raye: 'multi',
};

function normalizeColorKey(s) {
  return s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
}

function colorToHex(color) {
  if (!color) return '#ccc';
  if (typeof color === 'object' && color.hex) return color.hex;
  const name = typeof color === 'string' ? color : (color.name || '');
  if (!name) return '#ccc';
  const key = normalizeColorKey(name);
  if (COLOR_MAP[key]) return COLOR_MAP[key];
  for (const [k, v] of Object.entries(COLOR_MAP)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return '#ccc';
}

function colorName(color) {
  if (!color) return '';
  if (typeof color === 'string') return color;
  return color.name || '';
}

function colorHex(color) {
  if (!color) return '';
  if (typeof color === 'object' && color.hex) return color.hex;
  const h = colorToHex(color);
  return h === 'multi' ? '#ccc' : h;
}

function formatPrice(price) {
  const num = typeof price === 'number' ? price : parseFloat(price);
  if (isNaN(num)) return '';
  return num.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $';
}

function initAdmin(products) {
  allProducts = products;
}

async function renderAdmin(products) {
  allProducts = products;
  const root = document.getElementById('adminRoot');
  if (!root) return;

  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) {
    root.innerHTML = `
      <div class="admin-login-msg">
        <h2>Tableau de bord admin</h2>
        <p>Vous devez être connecté en tant qu'administrateur pour accéder à cette page.</p>
        <button class="admin-btn" onclick="document.querySelector('.icons a')?.click()">Se connecter</button>
      </div>`;
    return;
  }

  root.innerHTML = `
    <div class="admin-root">
      <div class="admin-header">
        <h1>Tableau de bord — Le Choix de Sophie</h1>
        <div class="admin-user">${user.email}</div>
      </div>
      <div class="admin-layout">
        <div class="admin-sidebar">
          <div class="admin-nav-item ${adminView === 'dashboard' ? 'active' : ''}" data-view="dashboard">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="2" width="6" height="6" stroke="currentColor" stroke-width="1.2"/><rect x="10" y="2" width="6" height="6" stroke="currentColor" stroke-width="1.2"/><rect x="2" y="10" width="6" height="6" stroke="currentColor" stroke-width="1.2"/><rect x="10" y="10" width="6" height="6" stroke="currentColor" stroke-width="1.2"/></svg>
            Aperçu
          </div>
          <div class="admin-nav-item ${adminView === 'products' ? 'active' : ''}" data-view="products">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 4h12M3 9h12M3 14h12" stroke="currentColor" stroke-width="1.2"/></svg>
            Inventaire
          </div>
          <div class="admin-nav-item ${adminView === 'users' ? 'active' : ''}" data-view="users">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="6" r="3" stroke="currentColor" stroke-width="1.2"/><path d="M3 15c1-3 3-4.5 6-4.5s5 1.5 6 4.5" stroke="currentColor" stroke-width="1.2"/></svg>
            Utilisateurs
          </div>
          <div class="admin-nav-item ${adminView === 'media' ? 'active' : ''}" data-view="media">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="4" width="14" height="10" rx="1" stroke="currentColor" stroke-width="1.2"/><path d="M7 7l4 2-4 2V7z" fill="currentColor"/></svg>
            Vidéos accueil
          </div>
          <div class="admin-nav-item ${adminView === 'orders' ? 'active' : ''}" data-view="orders">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 4h12v8H3z" stroke="currentColor" stroke-width="1.2"/><path d="M3 4l2 6h10l-2-6" stroke="currentColor" stroke-width="1.2"/><circle cx="6" cy="14" r="1" fill="currentColor"/><circle cx="12" cy="14" r="1" fill="currentColor"/></svg>
            Commandes
            <span class="admin-nav-badge" id="ordersBadge" style="display:none"></span>
          </div>
          <div class="admin-nav-item ${adminView === 'carts' ? 'active' : ''}" data-view="carts">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 6h12l-1 8H4z" stroke="currentColor" stroke-width="1.2"/><path d="M6 6V4a3 3 0 0 1 6 0v2" stroke="currentColor" stroke-width="1.2"/></svg>
            Paniers non finalisés
          </div>
          <div class="admin-nav-item ${adminView === 'newsletter' ? 'active' : ''}" data-view="newsletter">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="4" width="14" height="10" rx="1" stroke="currentColor" stroke-width="1.2"/><path d="M2 5l7 5 7-5" stroke="currentColor" stroke-width="1.2"/></svg>
            Infolettre
          </div>
          <div class="admin-nav-item" onclick="window.location.href='/'">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9l6-6 6 6M5 7v8h8V7" stroke="currentColor" stroke-width="1.2"/></svg>
            Retour au site
          </div>
        </div>
        <div class="admin-content" id="adminContent"></div>
        <div class="admin-provider-credit">
          <span>Propulsé par</span>
          <a href="https://reactool.ai" target="_blank" rel="noopener noreferrer" aria-label="Reactool AI">
            <img src="/assets/logo_blanc_reactool_ai.png" alt="Reactool AI">
          </a>
        </div>
      </div>
    </div>
  `;

  root.querySelectorAll('.admin-nav-item[data-view]').forEach((item) => {
    item.addEventListener('click', () => {
      adminView = item.dataset.view;
      renderAdmin(allProducts);
    });
  });

  const content = document.getElementById('adminContent');
  if (adminView === 'dashboard') renderDashboard(content);
  else if (adminView === 'products') renderProducts(content);
  else if (adminView === 'users') renderUsers(content);
  else if (adminView === 'media') renderMediaManager(content);
  else if (adminView === 'orders') renderOrders(content);
  else if (adminView === 'carts') renderCarts(content);
  else if (adminView === 'newsletter') renderNewsletter(content);

  updateOrdersBadge();
}

function renderDashboard(content) {
  const total = allProducts.length;
  const inStock = allProducts.filter((p) => p.total_qt > 0).length;
  const soldOut = total - inStock;
  const withImages = allProducts.filter((p) => Array.isArray(p.images) && p.images.length > 0).length;
  const totalValue = allProducts.reduce((sum, p) => sum + (parseFloat(p.price) || 0) * (p.total_qt || 0), 0);

  content.innerHTML = `
    <div class="admin-stats">
      <div class="admin-stat-card">
        <div class="admin-stat-num">${total}</div>
        <div class="admin-stat-label">Produits totaux</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-num">${inStock}</div>
        <div class="admin-stat-label">En stock</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-num">${soldOut}</div>
        <div class="admin-stat-label">Épuisés</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-num">${withImages}</div>
        <div class="admin-stat-label">Avec photos</div>
      </div>
    </div>
    <div class="admin-stat-card" style="margin-bottom:24px">
      <div class="admin-stat-label">Valeur de l'inventaire</div>
      <div class="admin-stat-num" style="font-size:28px">${formatPrice(totalValue)}</div>
    </div>
    <h3 style="font-family:'Cormorant Garamond',serif;font-size:24px;margin-bottom:16px">Actions rapides</h3>
    <button class="admin-btn" onclick="document.querySelector('.admin-nav-item[data-view=products]')?.click()">Gérer l'inventaire</button>
  `;
}

let adminConfidenceFilter = 'all';

const CATEGORY_SLOTS = [
  { key: 'cat-robes', label: 'Robes', cat: 'Robes' },
  { key: 'cat-shorts', label: 'Shorts', cat: 'Shorts' },
  { key: 'cat-jupes', label: 'Jupes', cat: 'Jupes' },
  { key: 'cat-tops', label: 'Tops', cat: 'Tops' },
  { key: 'cat-blouses', label: 'Blouses', cat: 'Blouses' },
];
const VIDEO_BUCKET = 'category-videos';
const VIDEO_STORAGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${VIDEO_BUCKET}/`;

function renderProducts(content) {
  content.innerHTML = `
    <div class="admin-toolbar">
      <div class="admin-search">
        <input type="search" id="adminProductSearch" placeholder="Rechercher par nom, numéro, catégorie…" value="${adminSearchTerm}">
      </div>
      <div class="admin-filter-confiance">
        <label>Confiance photo:</label>
        <select id="adminConfidenceFilter">
          <option value="all" ${adminConfidenceFilter === 'all' ? 'selected' : ''}>Toutes</option>
          <option value="exact" ${adminConfidenceFilter === 'exact' ? 'selected' : ''}>Exacte</option>
          <option value="approx" ${adminConfidenceFilter === 'approx' ? 'selected' : ''}>Approximative</option>
          <option value="none" ${adminConfidenceFilter === 'none' ? 'selected' : ''}>Sans photo</option>
        </select>
      </div>
    </div>
    <div class="admin-table" id="adminProductTable">
      <div class="admin-loading">Chargement…</div>
    </div>
  `;

  document.getElementById('adminProductSearch').addEventListener('input', (e) => {
    adminSearchTerm = e.target.value;
    renderProductTable();
  });
  document.getElementById('adminConfidenceFilter').addEventListener('change', (e) => {
    adminConfidenceFilter = e.target.value;
    renderProductTable();
  });
  renderProductTable();
}

function renderProductTable() {
  let products = allProducts;
  if (adminConfidenceFilter === 'none') {
    products = products.filter((p) => !p.image_confidence);
  } else if (adminConfidenceFilter === 'exact') {
    products = products.filter((p) => p.image_confidence === 'exact');
  } else if (adminConfidenceFilter === 'approx') {
    products = products.filter((p) => p.image_confidence === 'approx');
  }
  if (adminSearchTerm) {
    const term = adminSearchTerm.toLowerCase();
    products = products.filter((p) =>
      (p.description || '').toLowerCase().includes(term) ||
      (p.numref || '').toLowerCase().includes(term) ||
      (p.category || '').toLowerCase().includes(term) ||
      (p.fournisseur || '').toLowerCase().includes(term)
    );
  }

  const tableEl = document.getElementById('adminProductTable');
  if (products.length === 0) {
    tableEl.innerHTML = '<div class="admin-loading">Aucun produit trouvé.</div>';
    return;
  }

  tableEl.innerHTML = `
    <table>
      <thead>
        <tr>
          <th></th>
          <th>Numéro</th>
          <th>Description</th>
          <th>Catégorie</th>
          <th>Prix</th>
          <th>Stock</th>
          <th>Couleurs</th>
          <th>Confiance</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${products.slice(0, 200).map((p) => {
          const imgSrc = Array.isArray(p.images) && p.images.length > 0 ? adminImgUrl(p.images[0]) : FALLBACK_IMG;
          const stockClass = p.total_qt <= 0 ? 'out' : p.total_qt < 5 ? 'low' : '';
          const colors = Array.isArray(p.colors) ? p.colors : [];
          return `
            <tr>
              <td><img class="admin-thumb" src="${imgSrc}" onerror="this.src='${FALLBACK_IMG}'"></td>
              <td>${p.numref}</td>
              <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.description || ''}</td>
              <td>${p.category || ''}</td>
              <td>${formatPrice(p.price)}</td>
              <td class="admin-stock ${stockClass}">${p.total_qt || 0}</td>
              <td>${colors.length}</td>
              <td>${p.image_confidence === 'exact' ? '<span style="color:#2a7a4a">Exacte</span>' : p.image_confidence === 'approx' ? '<span style="color:#c08020">Approx.</span>' : '<span style="color:#999">—</span>'}</td>
              <td><button class="admin-btn admin-btn-sm" data-numref="${p.numref}">Modifier</button></td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  tableEl.querySelectorAll('button[data-numref]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const product = allProducts.find((p) => p.numref === btn.dataset.numref);
      if (product) openEditModal(product);
    });
  });
}

function syncColorSelect(overlay) {
  const select = overlay.querySelector('#uploadColor');
  if (!select) return;
  const currentVal = select.value;
  const colors = Array.from(overlay.querySelectorAll('#editColors .color-name-input'))
    .map((input) => input.value.trim())
    .filter(Boolean);
  select.innerHTML = '<option value="">— Générique (toutes couleurs) —</option>' +
    colors.map((c) => `<option value="${c}">${c}</option>`).join('');
  if (colors.includes(currentVal)) select.value = currentVal;
}

async function openEditModal(product) {
  editingProduct = product;
  const { data: images } = await supabase
    .from('product_images')
    .select('*')
    .eq('product_numref', product.numref)
    .order('sort_order', { ascending: true });
  editingImages = images || [];

  const rawColors = Array.isArray(product.colors) ? product.colors.filter(Boolean) : [];
  const colorMap = new Map();
  rawColors.forEach((c) => { if (!colorMap.has(normalizeColorKey(colorName(c)))) colorMap.set(normalizeColorKey(colorName(c)), c); });
  for (const img of editingImages) {
    if (img.color && !colorMap.has(normalizeColorKey(img.color))) {
      colorMap.set(normalizeColorKey(img.color), { name: img.color, hex: colorToHex(img.color) });
    }
  }
  const colors = [...colorMap.values()];
  const sizes = Array.isArray(product.sizes) ? product.sizes.filter(Boolean) : [];

  const overlay = document.createElement('div');
  overlay.className = 'admin-modal-overlay';
  overlay.id = 'editModal';

  return new Promise((resolve) => {
    const closeModal = () => { overlay.remove(); resolve(); };

  overlay.innerHTML = `
    <div class="admin-modal">
      <div class="admin-modal-header">
        <h2>${product.description || ''}</h2>
        <button class="admin-modal-close">&times;</button>
      </div>

      <div class="admin-form-row">
        <div class="admin-form-group">
          <label>Prix</label>
          <input type="number" step="0.01" id="editPrice" value="${product.price || ''}">
        </div>
        <div class="admin-form-group">
          <label>Quantité totale</label>
          <input type="number" id="editStock" value="${product.total_qt || 0}">
        </div>
      </div>

      <div class="admin-form-row">
        <div class="admin-form-group">
          <label>Catégorie</label>
          <input type="text" id="editCategory" value="${product.category || ''}">
        </div>
        <div class="admin-form-group">
          <label>Saison</label>
          <input type="text" id="editSeason" value="${product.season || ''}">
        </div>
      </div>

      <div class="admin-form-row">
        <div class="admin-form-group">
          <label>Marque</label>
          <input type="text" id="editFournisseur" value="${product.fournisseur || ''}">
        </div>
        <div class="admin-form-group">
          <label>Confiance photo</label>
          <select id="editConfidence">
            <option value="" ${!product.image_confidence ? 'selected' : ''}>— Aucune —</option>
            <option value="exact" ${product.image_confidence === 'exact' ? 'selected' : ''}>Exacte</option>
            <option value="approx" ${product.image_confidence === 'approx' ? 'selected' : ''}>Approximative</option>
          </select>
        </div>
      </div>

      <div class="admin-form-group">
        <label>Description</label>
        <textarea id="editDescription" rows="2">${product.description || ''}</textarea>
      </div>

      <div class="admin-form-group">
        <label>Nouveau (badge)</label>
        <select id="editIsNew">
          <option value="false" ${!product.is_new ? 'selected' : ''}>Non</option>
          <option value="true" ${product.is_new ? 'selected' : ''}>Oui</option>
        </select>
      </div>

      <div class="admin-colors-section">
        <label style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--gris);font-weight:500;display:block;margin-bottom:10px">Couleurs</label>
        <div id="editColors">
          ${colors.map((c, i) => {
            const name = colorName(c);
            const hex = colorHex(c);
            const isMulti = colorToHex(c) === 'multi';
            return `
            <div class="admin-color-item" data-idx="${i}">
              <span class="admin-color-dot${isMulti ? ' dot-multi' : ''}" style="${isMulti ? '' : 'background:' + hex}"></span>
              <input type="text" class="color-name-input" value="${name}" placeholder="Nom de la couleur">
              <input type="color" class="color-picker-input" value="${hex}">
              <button class="admin-btn admin-btn-sm admin-btn-ok" data-action="confirm-color" data-idx="${i}" title="Confirmer">✓</button>
              <button class="admin-btn admin-btn-sm admin-btn-danger" data-action="remove-color" data-idx="${i}">&times;</button>
            </div>`;
          }).join('')}
        </div>
        <button class="admin-btn admin-btn-sm admin-btn-outline" id="addColorBtn" style="margin-top:8px">+ Ajouter couleur</button>
      </div>

      <div class="admin-sizes-section">
        <label style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--gris);font-weight:500;display:block;margin-bottom:10px">Tailles</label>
        <div class="admin-size-chips" id="editSizes">
          ${sizes.map((s, i) => `
            <div class="admin-size-chip" data-idx="${i}">
              <span>${s}</span>
              <button data-action="remove-size" data-idx="${i}">&times;</button>
            </div>
          `).join('')}
        </div>
        <div class="admin-size-add">
          <input type="text" id="newSizeInput" placeholder="Nouvelle taille">
          <button class="admin-btn admin-btn-sm" id="addSizeBtn">Ajouter</button>
        </div>
      </div>

      <div class="admin-matrix-section" id="matrixSection">
        <label style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--gris);font-weight:500;display:block;margin-bottom:6px">Matrice couleurs / tailles</label>
        <p style="font-size:13px;color:var(--gris);margin:0 0 12px">Toutes les tailles sont disponibles par défaut. Cliquez sur une case pour retirer une taille d'une couleur.</p>
        <div id="editMatrix" style="overflow-x:auto"></div>
      </div>

      <div class="admin-images-section">
        <label style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--gris);font-weight:500;display:block;margin-bottom:10px">Photos par couleur</label>
        <div class="admin-upload-area" id="uploadArea">
          <label for="fileInput">Cliquez ou glissez des photos ici pour les téléverser</label>
          <input type="file" id="fileInput" accept="image/*" multiple>
        </div>
        <div class="admin-color-select" id="uploadColorSelect">
          <label style="font-size:13px;color:var(--gris);white-space:nowrap">Couleur de la photo:</label>
          <select id="uploadColor">
            <option value="">— Générique (toutes couleurs) —</option>
            ${colors.map((c) => `<option value="${colorName(c)}">${colorName(c)}</option>`).join('')}
          </select>
        </div>
        <div class="admin-image-grid" id="imageGrid">
          ${editingImages.map((img) => {
            const allColorNames = new Set(colors.map((c) => colorName(c)).filter(Boolean));
            for (const im of editingImages) { if (im.color) allColorNames.add(im.color); }
            const dots = [...allColorNames].map((cn) => {
              const hex = colorToHex(cn);
              const sel = img.color === cn ? ' selected' : '';
              if (hex === 'multi') return `<button class="img-color-dot swatch-multi${sel}" data-color="${cn}" title="${cn}"></button>`;
              return `<button class="img-color-dot${sel}" style="--dot-color:${hex}" data-color="${cn}" title="${cn}"></button>`;
            }).join('');
            return `
            <div class="admin-image-card" data-id="${img.id}">
              <img src="${img.image_url.startsWith('http') ? img.image_url : adminImgUrl(img.image_url)}" onerror="this.src='${FALLBACK_IMG}'">
              <div class="admin-image-dots">
                <button class="img-color-dot${!img.color ? ' selected' : ''}" data-color="" title="Générique" style="--dot-color:#ddd;border:1px dashed #aaa"></button>
                ${dots}
              </div>
              <button class="admin-image-del" data-id="${img.id}" data-action="delete-img">&times;</button>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="admin-modal-footer">
        <button class="admin-btn admin-btn-outline" id="cancelEdit">Annuler</button>
        <button class="admin-btn" id="saveEdit">Enregistrer</button>
        <span id="saveStatus" style="font-size:13px;color:var(--gris);margin-left:12px"></span>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('.admin-modal-close').addEventListener('click', closeModal);
  overlay.querySelector('#cancelEdit').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

  overlay.querySelector('#addColorBtn').addEventListener('click', () => {
    const colorsContainer = overlay.querySelector('#editColors');
    const idx = colorsContainer.children.length;
    const div = document.createElement('div');
    div.className = 'admin-color-item';
    div.dataset.idx = idx;
    div.innerHTML = `
      <span class="admin-color-dot" style="background:#ccc"></span>
      <input type="text" class="color-name-input" value="" placeholder="Nom de la couleur">
      <input type="color" class="color-picker-input" value="#cccccc">
      <button class="admin-btn admin-btn-sm admin-btn-ok" data-action="confirm-color" data-idx="${idx}" title="Confirmer">✓</button>
      <button class="admin-btn admin-btn-sm admin-btn-danger" data-action="remove-color" data-idx="${idx}">&times;</button>
    `;
    colorsContainer.appendChild(div);
    const nameInput = div.querySelector('.color-name-input');
    const picker = div.querySelector('.color-picker-input');
    const dot = div.querySelector('.admin-color-dot');
    nameInput.addEventListener('input', (e) => {
      const hex = colorToHex(e.target.value);
      dot.style.background = hex === 'multi' ? 'conic-gradient(#e87060 0deg 72deg, #4a7a4a 72deg 144deg, #3a6a9a 144deg 216deg, #e8c83a 216deg 288deg, #b03030 288deg 360deg)' : hex;
      if (hex !== 'multi' && hex !== '#ccc') picker.value = hex;
    });
    picker.addEventListener('input', (e) => {
      dot.style.background = e.target.value;
    });
    div.querySelector('[data-action=remove-color]').addEventListener('click', () => { div.remove(); syncColorSelect(overlay); refreshImageDots(overlay); refreshMatrix(overlay); });
    div.querySelector('[data-action=confirm-color]').addEventListener('click', () => { syncColorSelect(overlay); refreshImageDots(overlay); refreshMatrix(overlay); });
    nameInput.addEventListener('blur', () => { syncColorSelect(overlay); refreshMatrix(overlay); });
  });

  overlay.querySelectorAll('[data-action=remove-color]').forEach((btn) => {
    btn.addEventListener('click', () => { btn.closest('.admin-color-item').remove(); syncColorSelect(overlay); refreshImageDots(overlay); refreshMatrix(overlay); });
  });

  overlay.querySelectorAll('[data-action=confirm-color]').forEach((btn) => {
    btn.addEventListener('click', () => { syncColorSelect(overlay); refreshImageDots(overlay); refreshMatrix(overlay); });
  });

  overlay.querySelectorAll('.color-name-input').forEach((input) => {
    input.addEventListener('input', (e) => {
      const item = input.closest('.admin-color-item');
      const dot = item.querySelector('.admin-color-dot');
      const picker = item.querySelector('.color-picker-input');
      const hex = colorToHex(e.target.value);
      dot.style.background = hex === 'multi' ? 'conic-gradient(#e87060 0deg 72deg, #4a7a4a 72deg 144deg, #3a6a9a 144deg 216deg, #e8c83a 216deg 288deg, #b03030 288deg 360deg)' : hex;
      if (hex !== 'multi' && hex !== '#ccc' && picker) picker.value = hex;
    });
  });

  overlay.querySelectorAll('.color-picker-input').forEach((picker) => {
    picker.addEventListener('input', (e) => {
      const item = picker.closest('.admin-color-item');
      const dot = item.querySelector('.admin-color-dot');
      dot.style.background = e.target.value;
      dot.classList.remove('dot-multi');
    });
  });

  overlay.querySelector('#addSizeBtn').addEventListener('click', () => {
    const input = overlay.querySelector('#newSizeInput');
    const val = input.value.trim();
    if (!val) return;
    const sizesContainer = overlay.querySelector('#editSizes');
    const idx = sizesContainer.children.length;
    const chip = document.createElement('div');
    chip.className = 'admin-size-chip';
    chip.dataset.idx = idx;
    chip.innerHTML = `<span>${val}</span><button data-action="remove-size" data-idx="${idx}">&times;</button>`;
    sizesContainer.appendChild(chip);
    chip.querySelector('[data-action=remove-size]').addEventListener('click', () => { chip.remove(); refreshMatrix(overlay); });
    input.value = '';
    refreshMatrix(overlay);
  });

  overlay.querySelectorAll('[data-action=remove-size]').forEach((btn) => {
    btn.addEventListener('click', () => { btn.closest('.admin-size-chip').remove(); refreshMatrix(overlay); });
  });

  refreshMatrix(overlay);

  const fileInput = overlay.querySelector('#fileInput');
  const uploadArea = overlay.querySelector('#uploadArea');
  fileInput.addEventListener('change', () => handleFileUpload(fileInput.files, overlay));
  uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    handleFileUpload(e.dataTransfer.files, overlay);
  });

  overlay.querySelectorAll('[data-action=delete-img]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const imgId = btn.dataset.id;
      const { error } = await supabase.from('product_images').delete().eq('id', imgId);
      if (error) { alert('Erreur lors de la suppression de l\'image.'); return; }
      editingImages = editingImages.filter((img) => img.id !== imgId);
      btn.closest('.admin-image-card').remove();
    });
  });

  overlay.querySelectorAll('.admin-image-card').forEach((card) => {
    card.querySelectorAll('.img-color-dot').forEach((dot) => {
      dot.addEventListener('click', async (e) => {
        e.preventDefault();
        const imgId = card.dataset.id;
        const color = dot.dataset.color || null;
        const { error } = await supabase.from('product_images').update({ color }).eq('id', imgId);
        if (error) { alert('Erreur lors de l\'assignation de couleur.'); return; }
        const img = editingImages.find((i) => i.id === imgId);
        if (img) img.color = color;
        card.querySelectorAll('.img-color-dot').forEach((d) => d.classList.remove('selected'));
        dot.classList.add('selected');
        const statusEl = overlay.querySelector('#saveStatus');
        if (statusEl) statusEl.innerHTML = '<span style="color:#2a7a4a">Couleur assignée ✓</span>';
      });
    });
  });

  overlay.querySelector('#saveEdit').addEventListener('click', () => saveProductEdit(overlay, closeModal));
  });
}

async function handleFileUpload(files, overlay) {
  if (!files || files.length === 0) return;
  const color = overlay.querySelector('#uploadColor').value || null;
  const grid = overlay.querySelector('#imageGrid');
  const uploadArea = overlay.querySelector('#uploadArea');
  const statusEl = overlay.querySelector('#saveStatus');

  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    if (statusEl) statusEl.textContent = `Téléversement de ${file.name}…`;
    const ext = file.name.split('.').pop();
    const fileName = `${editingProduct.numref}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = `products/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, file);

    if (uploadError) {
      if (statusEl) statusEl.innerHTML = `<span style="color:#b03030">Erreur: ${uploadError.message}</span>`;
      alert('Erreur téléversement: ' + uploadError.message);
      continue;
    }

    const { data: insertData, error: insertError } = await supabase
      .from('product_images')
      .insert({ product_numref: editingProduct.numref, image_url: filePath, color, sort_order: editingImages.length })
      .select();
    if (insertError) {
      if (statusEl) statusEl.innerHTML = `<span style="color:#b03030">Erreur: ${insertError.message}</span>`;
      alert('Erreur: ' + insertError.message);
      continue;
    }
    if (insertData && insertData[0]) {
      editingImages.push(insertData[0]);
      appendImageCard(grid, insertData[0], overlay);
      if (statusEl) statusEl.innerHTML = '<span style="color:#2a7a4a">Photo ajoutée ✓</span>';
    }
  }
}

function refreshImageDots(overlay) {
  overlay.querySelectorAll('.admin-image-card').forEach((card) => {
    const imgId = card.dataset.id;
    const img = editingImages.find((i) => i.id === imgId);
    if (!img) return;
    const dotsContainer = card.querySelector('.admin-image-dots');
    if (!dotsContainer) return;
    const confirmed = Array.from(overlay.querySelectorAll('#editColors .color-name-input'))
      .map((inp) => inp.value.trim())
      .filter(Boolean);
    const allColorNames = new Set(confirmed);
    for (const im of editingImages) { if (im.color) allColorNames.add(im.color); }
    const genericDot = `<button class="img-color-dot${!img.color ? ' selected' : ''}" data-color="" title="Générique" style="--dot-color:#ddd;border:1px dashed #aaa"></button>`;
    const colorDots = [...allColorNames].map((cn) => {
      const hex = colorToHex(cn);
      const sel = img.color === cn ? ' selected' : '';
      if (hex === 'multi') return `<button class="img-color-dot swatch-multi${sel}" data-color="${cn}" title="${cn}"></button>`;
      return `<button class="img-color-dot${sel}" style="--dot-color:${hex}" data-color="${cn}" title="${cn}"></button>`;
    }).join('');
    dotsContainer.innerHTML = genericDot + colorDots;
    dotsContainer.querySelectorAll('.img-color-dot').forEach((dot) => {
      dot.addEventListener('click', async (e) => {
        e.preventDefault();
        const color = dot.dataset.color || null;
        const { error } = await supabase.from('product_images').update({ color }).eq('id', imgId);
        if (error) { alert('Erreur.'); return; }
        img.color = color;
        dotsContainer.querySelectorAll('.img-color-dot').forEach((d) => d.classList.remove('selected'));
        dot.classList.add('selected');
      });
    });
  });
}

function appendImageCard(grid, imgData, overlay) {
  const card = document.createElement('div');
  card.className = 'admin-image-card';
  card.dataset.id = imgData.id;
  const colorNames = overlay
    ? Array.from(overlay.querySelectorAll('#editColors .color-name-input')).map((i) => i.value.trim()).filter(Boolean)
    : [];
  const allColorNames = new Set(colorNames);
  for (const im of editingImages) { if (im.color) allColorNames.add(im.color); }
  const dots = [...allColorNames].map((cn) => {
    const hex = colorToHex(cn);
    const sel = imgData.color === cn ? ' selected' : '';
    if (hex === 'multi') return `<button class="img-color-dot swatch-multi${sel}" data-color="${cn}" title="${cn}"></button>`;
    return `<button class="img-color-dot${sel}" style="--dot-color:${hex}" data-color="${cn}" title="${cn}"></button>`;
  }).join('');
  card.innerHTML = `
    <img src="${imgData.image_url.startsWith('http') ? imgData.image_url : adminImgUrl(imgData.image_url)}" onerror="this.src='${FALLBACK_IMG}'">
    <div class="admin-image-dots">
      <button class="img-color-dot${!imgData.color ? ' selected' : ''}" data-color="" title="Générique" style="--dot-color:#ddd;border:1px dashed #aaa"></button>
      ${dots}
    </div>
    <button class="admin-image-del" data-id="${imgData.id}" data-action="delete-img">&times;</button>
  `;
  card.querySelector('[data-action=delete-img]').addEventListener('click', async () => {
    const imgId = imgData.id;
    const { error } = await supabase.from('product_images').delete().eq('id', imgId);
    if (error) { alert('Erreur.'); return; }
    editingImages = editingImages.filter((img) => img.id !== imgId);
    card.remove();
  });
  card.querySelectorAll('.img-color-dot').forEach((dot) => {
    dot.addEventListener('click', async (e) => {
      e.preventDefault();
      const color = dot.dataset.color || null;
      const { error } = await supabase.from('product_images').update({ color }).eq('id', imgData.id);
      if (error) { alert('Erreur.'); return; }
      imgData.color = color;
      card.querySelectorAll('.img-color-dot').forEach((d) => d.classList.remove('selected'));
      dot.classList.add('selected');
    });
  });
  grid.appendChild(card);
}

function refreshMatrix(overlay) {
  const matrixEl = overlay.querySelector('#editMatrix');
  if (!matrixEl) return;
  const colorItems = Array.from(overlay.querySelectorAll('#editColors .admin-color-item'));
  const colors = colorItems.map((item) => {
    const name = item.querySelector('.color-name-input').value.trim();
    if (!name) return null;
    const hex = item.querySelector('.color-picker-input').value;
    return { name, hex };
  }).filter(Boolean);

  const sizes = Array.from(overlay.querySelectorAll('#editSizes .admin-size-chip span'))
    .map((span) => span.textContent.trim())
    .filter(Boolean);

  if (colors.length === 0 || sizes.length === 0) {
    matrixEl.innerHTML = '<p style="font-size:13px;color:var(--gris)">Ajoutez des couleurs et des tailles pour configurer la matrice.</p>';
    return;
  }

  const existingMatrix = editingProduct.color_size_matrix || {};
  const sizeOrder = ['TP/XS','P/S','M/M','G/L','TG/XL','XXL','24','25','26','27','28','29','30','31','32','33','34','36','38','40','42','44','46','1/2','3/4','5/6','7/8','9/10','11/12','13/14'];
  const sortedSizes = [...sizes].sort((a, b) => {
    const ia = sizeOrder.indexOf(a);
    const ib = sizeOrder.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

  let html = '<table class="admin-matrix-table" style="border-collapse:collapse;font-size:13px"><thead><tr><th style="padding:6px 10px;text-align:left;border-bottom:2px solid var(--ivoire)"></th>';
  sortedSizes.forEach((s) => {
    html += `<th style="padding:6px 8px;text-align:center;border-bottom:2px solid var(--ivoire);font-weight:500;white-space:nowrap">${s}</th>`;
  });
  html += '</tr></thead><tbody>';

  colors.forEach((c) => {
    const key = normalizeColorKey(c.name);
    const hex = c.hex || colorToHex(c.name);
    const isMulti = hex === 'multi';
    const colorSizes = existingMatrix[key];
    html += `<tr><td style="padding:6px 10px;border-bottom:1px solid var(--ivoire);white-space:nowrap"><span class="admin-color-dot${isMulti ? ' dot-multi' : ''}" style="${isMulti ? '' : 'background:' + hex + ';display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:8px;vertical-align:middle'}"></span><span style="vertical-align:middle">${c.name}</span></td>`;
    sortedSizes.forEach((s) => {
      const isAvailable = !colorSizes || colorSizes.includes(s);
      html += `<td style="padding:4px;text-align:center;border-bottom:1px solid var(--ivoire)"><button class="matrix-cell${isAvailable ? ' active' : ''}" data-color="${key}" data-size="${s}" title="${isAvailable ? 'Disponible — cliquez pour retirer' : 'Indisponible — cliquez pour ajouter'}" style="width:28px;height:28px;border-radius:4px;border:1px solid ${isAvailable ? 'var(--or)' : '#ddd'};background:${isAvailable ? 'var(--or-clair)' : 'transparent'};cursor:pointer;color:${isAvailable ? 'var(--or-fonce)' : '#ccc'};font-size:11px;transition:all .15s">${isAvailable ? '✓' : '—'}</button></td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  matrixEl.innerHTML = html;

  matrixEl.querySelectorAll('.matrix-cell').forEach((cell) => {
    cell.addEventListener('click', () => {
      const colorKey = cell.dataset.color;
      const size = cell.dataset.size;
      const m = editingProduct.color_size_matrix || {};
      if (!m[colorKey]) m[colorKey] = sortedSizes.slice();
      const idx = m[colorKey].indexOf(size);
      if (idx >= 0) m[colorKey].splice(idx, 1);
      else m[colorKey].push(size);
      editingProduct.color_size_matrix = m;
      const isActive = cell.classList.toggle('active');
      cell.style.border = isActive ? '1px solid var(--or)' : '1px solid #ddd';
      cell.style.background = isActive ? 'var(--or-clair)' : 'transparent';
      cell.style.color = isActive ? 'var(--or-fonce)' : '#ccc';
      cell.textContent = isActive ? '✓' : '—';
      cell.title = isActive ? 'Disponible — cliquez pour retirer' : 'Indisponible — cliquez pour ajouter';
    });
  });
}

async function saveProductEdit(overlay, closeModal) {
  const statusEl = overlay.querySelector('#saveStatus');
  if (statusEl) statusEl.textContent = 'Enregistrement…';
  const colorItems = Array.from(overlay.querySelectorAll('#editColors .admin-color-item'));
  const formColors = colorItems.map((item) => {
    const name = item.querySelector('.color-name-input').value.trim();
    const hex = item.querySelector('.color-picker-input').value;
    if (!name) return null;
    return { name, hex };
  }).filter(Boolean);

  const colorMap = new Map();
  formColors.forEach((c) => { if (!colorMap.has(normalizeColorKey(c.name))) colorMap.set(normalizeColorKey(c.name), c); });
  for (const img of editingImages) {
    if (img.color) {
      const key = normalizeColorKey(img.color);
      if (!colorMap.has(key)) colorMap.set(key, { name: img.color, hex: colorToHex(img.color) });
    }
  }
  const colors = [...colorMap.values()];

  const sizes = Array.from(overlay.querySelectorAll('#editSizes .admin-size-chip span'))
    .map((span) => span.textContent.trim())
    .filter(Boolean);

  const updates = {
    price: parseFloat(overlay.querySelector('#editPrice').value) || 0,
    total_qt: parseInt(overlay.querySelector('#editStock').value) || 0,
    category: overlay.querySelector('#editCategory').value.trim(),
    season: overlay.querySelector('#editSeason').value.trim(),
    fournisseur: overlay.querySelector('#editFournisseur').value.trim(),
    image_confidence: overlay.querySelector('#editConfidence').value || null,
    description: overlay.querySelector('#editDescription').value.trim(),
    is_new: overlay.querySelector('#editIsNew').value === 'true',
    colors: colors,
    sizes: sizes,
    color_size_matrix: editingProduct.color_size_matrix || {},
  };

  const { error } = await supabase
    .from('products')
    .update(updates)
    .eq('numref', editingProduct.numref);

  if (error) {
    if (statusEl) statusEl.innerHTML = '<span style="color:#b03030">Erreur: ' + error.message + '</span>';
    alert('Erreur lors de l\'enregistrement: ' + error.message);
    return;
  }

  Object.assign(editingProduct, updates);
  if (statusEl) statusEl.innerHTML = '<span style="color:#2a7a4a">Enregistré ✓</span>';
  if (closeModal) closeModal();
  const adminContent = document.getElementById('adminContent');
  if (adminContent) renderProducts(adminContent);
}

function renderUsers(content) {
  content.innerHTML = `
    <div class="admin-stat-card" style="margin-bottom:24px">
      <div class="admin-stat-label">Gestion des utilisateurs</div>
      <p style="font-size:14px;color:var(--gris);margin-top:8px">La gestion des comptes clients se fait via le système d'authentification Supabase. Les utilisateurs peuvent créer leur compte depuis la page d'accueil. En tant qu'admin, vous pouvez voir les statistiques ci-dessous.</p>
    </div>
    <div class="admin-stats">
      <div class="admin-stat-card">
        <div class="admin-stat-num" id="totalUsers">—</div>
        <div class="admin-stat-label">Utilisateurs inscrits</div>
      </div>
    </div>
    <p style="font-size:13px;color:var(--gris-clair);margin-top:16px">Pour gérer les utilisateurs en détail (suppression, changement de mot de passe, etc.), utilisez le tableau de bord Supabase.</p>
  `;
}

async function renderMediaManager(content) {
  content.innerHTML = `
    <div class="admin-media-intro">
      <h2 style="font-family:'Cormorant Garamond',serif;font-size:28px;margin:0 0 8px">Vidéos de la page d'accueil</h2>
      <p style="font-size:14px;color:var(--gris);margin:0 0 24px;max-width:600px">Téléversez une vidéo MP4 pour chaque catégorie. Elle s'affichera en boucle, sans son, à la place de l'image fixe sur la page d'accueil. Recommandé : format vertical ou carré, 5 à 15 secondes, moins de 20 Mo.</p>
    </div>
    <div class="admin-media-grid" id="mediaGrid"><div class="admin-loading">Chargement…</div></div>
  `;
  await loadMediaSlots();
}

async function loadMediaSlots() {
  const { data: mediaRows } = await supabase
    .from('site_media')
    .select('*')
    .in('media_key', CATEGORY_SLOTS.map((s) => s.key));

  const mediaMap = {};
  (mediaRows || []).forEach((row) => { mediaMap[row.media_key] = row; });

  const grid = document.getElementById('mediaGrid');
  if (!grid) return;
  grid.innerHTML = '';

  for (const slot of CATEGORY_SLOTS) {
    const existing = mediaMap[slot.key];
    const card = document.createElement('div');
    card.className = 'admin-media-card';
    card.innerHTML = `
      <div class="admin-media-label">${slot.label}</div>
      <div class="admin-media-preview" id="preview-${slot.key}">
        ${existing ? renderMediaPreview(existing) : '<div class="admin-media-empty">Aucune vidéo — image par défaut affichée</div>'}
      </div>
      <div class="admin-media-actions">
        <label class="admin-btn admin-btn-sm" for="upload-${slot.key}">Téléverser MP4</label>
        <input type="file" id="upload-${slot.key}" accept="video/mp4,video/*" style="display:none">
        ${existing ? `<button class="admin-btn admin-btn-sm admin-btn-danger" id="delete-${slot.key}">Supprimer</button>` : ''}
      </div>
      <div class="admin-media-status" id="status-${slot.key}"></div>
    `;
    grid.appendChild(card);

    const fileInput = card.querySelector(`#upload-${slot.key}`);
    fileInput.addEventListener('change', (e) => handleVideoUpload(e.target.files[0], slot, card));

    if (existing) {
      const delBtn = card.querySelector(`#delete-${slot.key}`);
      delBtn.addEventListener('click', () => handleVideoDelete(existing, slot, card));
    }
  }
}

function renderMediaPreview(mediaRow) {
  const url = mediaRow.url.startsWith('http') ? mediaRow.url : VIDEO_STORAGE_URL + mediaRow.url;
  return `<video src="${url}" autoplay muted loop playsinline style="width:100%;height:200px;object-fit:cover;border-radius:6px"></video>`;
}

async function handleVideoUpload(file, slot, card) {
  const status = card.querySelector(`#status-${slot.key}`);
  if (!file) return;
  if (file.size > 50 * 1024 * 1024) {
    status.innerHTML = '<span style="color:#b03030">Le fichier dépasse 50 Mo.</span>';
    return;
  }
  status.textContent = 'Téléversement en cours…';
  const ext = file.name.split('.').pop().toLowerCase();
  const fileName = `${slot.key}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(VIDEO_BUCKET)
    .upload(fileName, file);

  if (uploadError) {
    status.innerHTML = `<span style="color:#b03030">Erreur: ${uploadError.message}</span>`;
    return;
  }

  const { error: upsertError } = await supabase
    .from('site_media')
    .upsert({ media_key: slot.key, media_type: 'video', url: fileName }, { onConflict: 'media_key' });

  if (upsertError) {
    status.innerHTML = `<span style="color:#b03030">Erreur: ${upsertError.message}</span>`;
    return;
  }

  status.innerHTML = '<span style="color:#2a7a4a">Vidéo téléversée avec succès.</span>';
  await loadMediaSlots();
}

async function handleVideoDelete(mediaRow, slot, card) {
  const status = card.querySelector(`#status-${slot.key}`);
  if (!confirm(`Supprimer la vidéo pour « ${slot.label} » ? L'image par défaut sera réaffichée.`)) return;

  if (!mediaRow.url.startsWith('http')) {
    await supabase.storage.from(VIDEO_BUCKET).remove([mediaRow.url]);
  }
  const { error } = await supabase
    .from('site_media')
    .delete()
    .eq('media_key', slot.key);

  if (error) {
    status.innerHTML = `<span style="color:#b03030">Erreur: ${error.message}</span>`;
    return;
  }
  await loadMediaSlots();
}

/* ====== ONGLET COMMANDES ====== */
const ORDER_STATUSES = [
  { value: 'paid', label: 'Payée', color: '#2a7a4a' },
  { value: 'preparing', label: 'En préparation', color: '#c08020' },
  { value: 'ready_for_pickup', label: 'Prête pour ramassage', color: '#3a6a9a' },
  { value: 'shipping', label: 'En livraison', color: '#3a6a9a' },
  { value: 'delivered', label: 'Livrée', color: '#2a7a4a' },
  { value: 'cancelled', label: 'Annulée', color: '#b03030' },
];

function statusLabel(val) { return ORDER_STATUSES.find((s) => s.value === val)?.label || val; }
function statusColor(val) { return ORDER_STATUSES.find((s) => s.value === val)?.color || '#999'; }

let allOrders = [];
let orderFilterStatus = 'all';
let orderFilterMode = 'all';
let orderSearchTerm = '';
let selectedOrderId = null;

async function updateOrdersBadge() {
  const { count } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .in('status', ['paid', 'preparing']);
  const badge = document.getElementById('ordersBadge');
  if (!badge) return;
  if (count && count > 0) {
    badge.textContent = count;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

async function renderOrders(content) {
  content.innerHTML = `
    <h2 style="font-family:'Cormorant Garamond',serif;font-size:28px;margin:0 0 20px">Commandes</h2>
    <div class="admin-toolbar">
      <div class="admin-search"><input type="search" id="orderSearch" placeholder="N° commande, nom, courriel…" value="${orderSearchTerm}"></div>
      <div class="admin-filter-confiance">
        <label>Statut:</label>
        <select id="orderStatusFilter">
          <option value="all">Tous</option>
          ${ORDER_STATUSES.map((s) => `<option value="${s.value}" ${orderFilterStatus === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
        </select>
      </div>
      <div class="admin-filter-confiance">
        <label>Mode:</label>
        <select id="orderModeFilter">
          <option value="all">Tous</option>
          <option value="pickup" ${orderFilterMode === 'pickup' ? 'selected' : ''}>Ramassage</option>
          <option value="delivery" ${orderFilterMode === 'delivery' ? 'selected' : ''}>Livraison</option>
        </select>
      </div>
    </div>
    <div class="admin-table" id="ordersTable"><div class="admin-loading">Chargement…</div></div>
    <div id="orderDetailPanel"></div>
  `;

  document.getElementById('orderSearch').addEventListener('input', (e) => { orderSearchTerm = e.target.value; renderOrdersTable(); });
  document.getElementById('orderStatusFilter').addEventListener('change', (e) => { orderFilterStatus = e.target.value; renderOrdersTable(); });
  document.getElementById('orderModeFilter').addEventListener('change', (e) => { orderFilterMode = e.target.value; renderOrdersTable(); });

  await loadOrders();
}

async function loadOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('loadOrders error:', error); return; }
  allOrders = data || [];
  renderOrdersTable();
}

function renderOrdersTable() {
  let orders = allOrders;
  if (orderFilterStatus !== 'all') orders = orders.filter((o) => o.status === orderFilterStatus);
  if (orderFilterMode !== 'all') orders = orders.filter((o) => o.fulfillment_type === orderFilterMode);
  if (orderSearchTerm) {
    const t = orderSearchTerm.toLowerCase();
    orders = orders.filter((o) =>
      (o.order_number || '').toLowerCase().includes(t) ||
      (o.customer_first_name || '').toLowerCase().includes(t) ||
      (o.customer_last_name || '').toLowerCase().includes(t) ||
      (o.customer_email || '').toLowerCase().includes(t)
    );
  }

  const tableEl = document.getElementById('ordersTable');
  if (!tableEl) return;
  if (orders.length === 0) { tableEl.innerHTML = '<div class="admin-loading">Aucune commande trouvée.</div>'; return; }

  tableEl.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>N° commande</th>
          <th>Date</th>
          <th>Client</th>
          <th>Courriel</th>
          <th>Mode</th>
          <th>Total</th>
          <th>Statut</th>
        </tr>
      </thead>
      <tbody>
        ${orders.map((o) => {
          const date = new Date(o.created_at).toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' });
          const mode = o.fulfillment_type === 'pickup' ? 'Ramassage' : 'Livraison';
          const sc = statusColor(o.status);
          return `
            <tr class="order-row" data-id="${o.id}" style="cursor:pointer">
              <td style="font-weight:500">${o.order_number}</td>
              <td>${date}</td>
              <td>${o.customer_first_name} ${o.customer_last_name}</td>
              <td style="font-size:12px">${o.customer_email}</td>
              <td>${mode}</td>
              <td>${formatPrice(o.total)}</td>
              <td><span class="admin-status-badge" style="background:${sc}1a;color:${sc};border:1px solid ${sc}55">${statusLabel(o.status)}</span></td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;

  tableEl.querySelectorAll('.order-row').forEach((row) => {
    row.addEventListener('click', () => {
      selectedOrderId = row.dataset.id;
      renderOrderDetail(row.dataset.id);
    });
  });
}

async function renderOrderDetail(orderId) {
  const panel = document.getElementById('orderDetailPanel');
  if (!panel) return;
  const order = allOrders.find((o) => o.id === orderId);
  if (!order) return;

  panel.innerHTML = '<div class="admin-loading">Chargement du détail…</div>';
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const { data: items } = await supabase.from('order_items').select('*').eq('order_id', orderId);
  const { data: history } = await supabase.from('order_status_history').select('*').eq('order_id', orderId).order('created_at', { ascending: true });

  const itemsHtml = (items || []).map((it) => {
    const img = it.image_url ? (it.image_url.startsWith('http') ? it.image_url : adminImgUrl(it.image_url)) : FALLBACK_IMG;
    return `
      <div class="order-item-row">
        <img src="${img}" onerror="this.src='${FALLBACK_IMG}'" class="admin-thumb">
        <div class="order-item-info">
          <div style="font-weight:500">${it.name}</div>
          <div style="font-size:12px;color:var(--gris)">${[it.color, it.size].filter(Boolean).join(' / ') || ''}</div>
          <div style="font-size:12px;color:var(--gris)">Qté: ${it.quantity} × ${formatPrice(it.unit_price)}</div>
        </div>
        <div style="font-weight:500">${formatPrice(it.line_total)}</div>
      </div>`;
  }).join('');

  const historyHtml = (history || []).map((h) => {
    const date = new Date(h.created_at).toLocaleString('fr-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `<div class="history-row"><span class="history-dot" style="background:${statusColor(h.status)}"></span><span style="font-weight:500">${statusLabel(h.status)}</span> — ${date}${h.email_sent ? ' <span style="color:#2a7a4a;font-size:11px">✉ courriel envoyé</span>' : ''}</div>`;
  }).join('');

  const fulfillmentDetail = order.fulfillment_type === 'pickup'
    ? 'Ramassage en boutique — 630 Rue Sacré-Coeur O, Alma'
    : [order.ship_address1, order.ship_address2, order.ship_city, order.ship_province, order.ship_postal_code].filter(Boolean).join(', ');

  panel.innerHTML = `
    <div class="admin-order-detail">
      <div class="order-detail-header">
        <h3 style="font-family:'Cormorant Garamond',serif;font-size:24px;margin:0">${order.order_number}</h3>
        <button class="admin-btn admin-btn-sm admin-btn-outline" id="closeOrderDetail">Fermer</button>
      </div>
      <div class="order-detail-grid">
        <div class="order-detail-section">
          <div class="order-detail-label">Articles</div>
          ${itemsHtml}
          <div class="order-totals">
            <div class="row"><span>Sous-total</span><span>${formatPrice(order.subtotal)}</span></div>
            <div class="row"><span>Livraison</span><span>${order.shipping_total == 0 ? 'Gratuite' : formatPrice(order.shipping_total)}</span></div>
            <div class="row"><span>TPS</span><span>${formatPrice(order.tps)}</span></div>
            <div class="row"><span>TVQ</span><span>${formatPrice(order.tvq)}</span></div>
            <div class="row total"><span>Total</span><span>${formatPrice(order.total)}</span></div>
          </div>
        </div>
        <div class="order-detail-section">
          <div class="order-detail-label">Client</div>
          <div class="order-detail-info">
            <div>${order.customer_first_name} ${order.customer_last_name}</div>
            <div style="font-size:13px;color:var(--gris)">${order.customer_email}</div>
            ${order.customer_phone ? `<div style="font-size:13px;color:var(--gris)">${order.customer_phone}</div>` : ''}
            ${order.customer_note ? `<div style="font-size:13px;color:var(--gris);margin-top:6px;font-style:italic">Note: ${order.customer_note}</div>` : ''}
          </div>
          <div class="order-detail-label" style="margin-top:16px">Réception</div>
          <div class="order-detail-info">${fulfillmentDetail}</div>
          ${order.square_payment_id ? `<div class="order-detail-label" style="margin-top:16px">Paiement</div><div class="order-detail-info" style="font-size:12px;color:var(--gris)">Square ID: ${order.square_payment_id}</div>` : ''}
          <div class="order-detail-label" style="margin-top:16px">Statut</div>
          <div class="order-status-control">
            <select id="orderStatusSelect" class="admin-status-select">
              ${ORDER_STATUSES.map((s) => `<option value="${s.value}" ${order.status === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
            </select>
            <button class="admin-btn admin-btn-sm" id="updateStatusBtn">Mettre à jour</button>
            <span id="statusUpdateMsg" style="font-size:13px;margin-left:8px"></span>
          </div>
          <div class="order-detail-label" style="margin-top:16px">Historique</div>
          <div class="order-history">${historyHtml || '<div style="font-size:13px;color:var(--gris)">Aucun historique.</div>'}</div>
        </div>
      </div>
    </div>`;

  document.getElementById('closeOrderDetail').addEventListener('click', () => { panel.innerHTML = ''; selectedOrderId = null; });

  document.getElementById('updateStatusBtn').addEventListener('click', async () => {
    const newStatus = document.getElementById('orderStatusSelect').value;
    const msgEl = document.getElementById('statusUpdateMsg');
    const btn = document.getElementById('updateStatusBtn');
    btn.disabled = true;
    msgEl.textContent = 'Mise à jour…';

    const { data: { session } } = await supabase.auth.getSession();
    const jwt = session?.access_token;
    if (!jwt) { msgEl.innerHTML = '<span style="color:#b03030">Session expirée</span>'; btn.disabled = false; return; }

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-order-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ order_id: orderId, status: newStatus }),
      });
      const data = await resp.json();
      if (!resp.ok || data.error) { msgEl.innerHTML = `<span style="color:#b03030">${data.error || 'Erreur'}</span>`; btn.disabled = false; return; }
      const orderRef = allOrders.find((o) => o.id === orderId);
      if (orderRef) orderRef.status = newStatus;
      const emailStatus = ['preparing', 'ready_for_pickup', 'shipping', 'delivered'].includes(newStatus);
      msgEl.innerHTML = emailStatus
        ? `<span style="color:#2a7a4a">Statut mis à jour — courriel envoyé à ${order.customer_email}</span>`
        : `<span style="color:#2a7a4a">Statut mis à jour</span>`;
      btn.disabled = false;
      renderOrdersTable();
      renderOrderDetail(orderId);
      updateOrdersBadge();
    } catch (e) {
      msgEl.innerHTML = '<span style="color:#b03030">Erreur de communication</span>';
      btn.disabled = false;
    }
  });
}

/* ====== ONGLET PANIERS NON FINALISÉS ====== */
let allCarts = [];
let cartFilterEmailOnly = false;

async function renderCarts(content) {
  content.innerHTML = `
    <h2 style="font-family:'Cormorant Garamond',serif;font-size:28px;margin:0 0 20px">Paniers non finalisés</h2>
    <div class="admin-toolbar">
      <label class="admin-filter-confiance" style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="cartEmailOnly" ${cartFilterEmailOnly ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--or-fonce)">
        <span style="font-size:13px">Avec courriel seulement</span>
      </label>
    </div>
    <div class="admin-table" id="cartsTable"><div class="admin-loading">Chargement…</div></div>
    <div id="cartDetailPanel"></div>
  `;
  document.getElementById('cartEmailOnly').addEventListener('change', (e) => { cartFilterEmailOnly = e.target.checked; renderCartsTable(); });
  await loadCarts();
}

async function loadCarts() {
  const { data, error } = await supabase
    .from('abandoned_carts')
    .select('*')
    .eq('status', 'active')
    .order('last_seen_at', { ascending: false });
  if (error) { console.error('loadCarts error:', error); return; }
  allCarts = data || [];
  renderCartsTable();
}

function renderCartsTable() {
  let carts = allCarts;
  if (cartFilterEmailOnly) carts = carts.filter((c) => c.email);

  const tableEl = document.getElementById('cartsTable');
  if (!tableEl) return;
  if (carts.length === 0) { tableEl.innerHTML = '<div class="admin-loading">Aucun panier non finalisé.</div>'; return; }

  tableEl.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Dernière activité</th>
          <th>Courriel</th>
          <th>Nom</th>
          <th>Articles</th>
          <th>Sous-total</th>
          <th>Caisse</th>
        </tr>
      </thead>
      <tbody>
        ${carts.map((c) => {
          const date = new Date(c.last_seen_at).toLocaleString('fr-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
          const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || '—';
          return `
            <tr class="cart-row" data-id="${c.id}" style="cursor:pointer">
              <td>${date}</td>
              <td style="font-size:12px">${c.email || '<span style="color:var(--gris-clair)">inconnu</span>'}</td>
              <td>${name}</td>
              <td>${c.items_count || 0}</td>
              <td>${formatPrice(c.subtotal)}</td>
              <td>${c.reached_checkout ? '<span class="admin-status-badge" style="background:#c080201a;color:#c08020;border:1px solid #c0802055">A atteint la caisse</span>' : '—'}</td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;

  tableEl.querySelectorAll('.cart-row').forEach((row) => {
    row.addEventListener('click', () => renderCartDetail(row.dataset.id));
  });
}

function renderCartDetail(cartId) {
  const panel = document.getElementById('cartDetailPanel');
  if (!panel) return;
  const cart = allCarts.find((c) => c.id === cartId);
  if (!cart) return;

  const items = Array.isArray(cart.items) ? cart.items : [];
  const itemsHtml = items.map((it) => {
    const img = it.image ? (it.image.startsWith('http') ? it.image : adminImgUrl(it.image)) : FALLBACK_IMG;
    return `
      <div class="order-item-row">
        <img src="${img}" onerror="this.src='${FALLBACK_IMG}'" class="admin-thumb">
        <div class="order-item-info">
          <div style="font-weight:500">${it.name || ''}</div>
          <div style="font-size:12px;color:var(--gris)">${[it.color, it.size].filter(Boolean).join(' / ') || ''}</div>
          <div style="font-size:12px;color:var(--gris)">Qté: ${it.quantity} × ${formatPrice(it.price)}</div>
        </div>
        <div style="font-weight:500">${formatPrice((it.price || 0) * (it.quantity || 1))}</div>
      </div>`;
  }).join('');

  const name = [cart.first_name, cart.last_name].filter(Boolean).join(' ') || '';
  const emailSubject = 'Votre panier vous attend — Le Choix de Sophie';
  const itemListText = items.map((it) => `- ${it.name || 'Article'}${it.color ? ' (' + it.color + ')' : ''}${it.size ? ' ' + it.size : ''} — Qté: ${it.quantity} — ${formatPrice((it.price || 0) * (it.quantity || 1))}`).join('\\n');
  const emailBody = `Bonjour${name ? ' ' + name : ''},\\n\\nVous avez laissé des articles dans votre panier sur notre boutique. Voici un rappel de votre sélection :\\n\\n${itemListText}\\n\\nSous-total: ${formatPrice(cart.subtotal)}\\n\\nIl n'est pas trop tard pour finaliser votre commande ! Rendez-vous sur ${import.meta.env.VITE_SUPABASE_URL ? 'lechoixdesophie.com' : 'notre boutique'} pour compléter votre achat.\\n\\nÀ bientôt,\\nSophie — Le Choix de Sophie`;
  const mailtoLink = cart.email ? `mailto:${cart.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}` : null;

  panel.innerHTML = `
    <div class="admin-order-detail">
      <div class="order-detail-header">
        <h3 style="font-family:'Cormorant Garamond',serif;font-size:24px;margin:0">Détail du panier</h3>
        <button class="admin-btn admin-btn-sm admin-btn-outline" id="closeCartDetail">Fermer</button>
      </div>
      <div class="order-detail-grid">
        <div class="order-detail-section">
          <div class="order-detail-label">Articles (${items.length})</div>
          ${itemsHtml || '<div style="font-size:13px;color:var(--gris)">Panier vide.</div>'}
          <div class="order-totals">
            <div class="row total"><span>Sous-total</span><span>${formatPrice(cart.subtotal)}</span></div>
          </div>
        </div>
        <div class="order-detail-section">
          <div class="order-detail-label">Client</div>
          <div class="order-detail-info">
            ${name || '<span style="color:var(--gris-clair)">Nom inconnu</span>'}
            ${cart.email ? `<div style="font-size:13px;color:var(--gris)">${cart.email}</div>` : '<div style="font-size:13px;color:var(--gris-clair)">Courriel inconnu</div>'}
            ${cart.phone ? `<div style="font-size:13px;color:var(--gris)">${cart.phone}</div>` : ''}
          </div>
          ${cart.reached_checkout ? '<div class="admin-status-badge" style="background:#c080201a;color:#c08020;border:1px solid #c0802055;margin-top:12px;display:inline-block;padding:4px 10px;border-radius:4px;font-size:12px">A atteint la caisse</div>' : ''}
          ${mailtoLink ? `<button class="admin-btn admin-btn-sm" id="emailReminderBtn" style="margin-top:16px">Relancer par courriel</button>` : ''}
        </div>
      </div>
    </div>`;

  document.getElementById('closeCartDetail').addEventListener('click', () => { panel.innerHTML = ''; });
  const emailBtn = document.getElementById('emailReminderBtn');
  if (emailBtn) emailBtn.addEventListener('click', () => { window.location.href = mailtoLink; });

  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ====== ONGLET INFOLETTRE ====== */
let allSubscribers = [];

async function renderNewsletter(content) {
  content.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <h2 style="font-family:'Cormorant Garamond',serif;font-size:28px;margin:0">Infolettre</h2>
      <button class="admin-btn admin-btn-sm" id="exportCsvBtn">Exporter en CSV</button>
    </div>
    <div class="admin-stat-card" style="margin-bottom:20px">
      <div class="admin-stat-num" id="subscriberCount">—</div>
      <div class="admin-stat-label">Abonnés</div>
    </div>
    <div class="admin-table" id="newsletterTable"><div class="admin-loading">Chargement…</div></div>
  `;

  document.getElementById('exportCsvBtn').addEventListener('click', exportSubscribersCsv);

  const { data, error } = await supabase
    .from('newsletter_subscribers')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('newsletter load error:', error); return; }
  allSubscribers = data || [];

  const countEl = document.getElementById('subscriberCount');
  if (countEl) countEl.textContent = allSubscribers.length;

  const tableEl = document.getElementById('newsletterTable');
  if (allSubscribers.length === 0) { tableEl.innerHTML = '<div class="admin-loading">Aucun abonné pour le moment.</div>'; return; }

  tableEl.innerHTML = `
    <table>
      <thead>
        <tr><th>Courriel</th><th>Source</th><th>Date d'inscription</th></tr>
      </thead>
      <tbody>
        ${allSubscribers.map((s) => {
          const date = new Date(s.created_at).toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' });
          return `<tr><td style="font-weight:500">${s.email}</td><td>${s.source || 'footer'}</td><td style="font-size:12px;color:var(--gris)">${date}</td></tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function exportSubscribersCsv() {
  if (allSubscribers.length === 0) return;
  const rows = [['Courriel', 'Source', 'Date'], ...allSubscribers.map((s) => [s.email, s.source || 'footer', new Date(s.created_at).toISOString()])];
  const csv = rows.map((r) => r.map((f) => `"${(f || '').replace(/"/g, '""')}"`).join(',')).join('\\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'infolettre-abonnes.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export { initAdmin, renderAdmin, openEditModal };