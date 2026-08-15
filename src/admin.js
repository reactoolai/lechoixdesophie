import { supabase } from './supabase.js';

let allProducts = [];
let supabaseClient = null;
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
  noir: '#1a1a1a', black: '#1a1a1a', blanc: '#f8f8f0', white: '#f8f8f0', beige: '#d9c9b0',
  gris: '#8a8a8a', grey: '#8a8a8a', brun: '#6b4e3a', marron: '#5a4030', bleu: '#3a6a9a',
  blue: '#3a6a9a', marine: '#1a2a4a', navy: '#1a2a4a', vert: '#4a7a4a', green: '#4a7a4a',
  rouge: '#b03030', red: '#b03030', rose: '#e8a8b0', pink: '#e8a8b0', jaune: '#e8c83a',
  yellow: '#e8c83a', orange: '#e87830', violet: '#6a3a7a', purple: '#6a3a7a',
  multi: 'multi', assorted: 'multi', varie: 'multi',
};

function colorToHex(name) {
  if (!name) return '#ccc';
  const key = name.toLowerCase().trim();
  if (COLOR_MAP[key]) return COLOR_MAP[key];
  for (const [k, v] of Object.entries(COLOR_MAP)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return '#ccc';
}

function formatPrice(price) {
  const num = typeof price === 'number' ? price : parseFloat(price);
  if (isNaN(num)) return '';
  return num.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $';
}

function initAdmin(products, sb) {
  allProducts = products;
  supabaseClient = sb;
}

function renderAdmin(products) {
  allProducts = products;
  const root = document.getElementById('adminRoot');
  if (!root) return;

  const session = supabaseClient.auth.getSession ? null : null;
  const user = supabaseClient?.auth?.currentUser ?? null;
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
          <div class="admin-nav-item" onclick="window.location.hash='#/'">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9l6-6 6 6M5 7v8h8V7" stroke="currentColor" stroke-width="1.2"/></svg>
            Retour au site
          </div>
        </div>
        <div class="admin-content" id="adminContent"></div>
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

async function openEditModal(product) {
  editingProduct = product;
  const { data: images } = await supabaseClient
    .from('product_images')
    .select('*')
    .eq('product_numref', product.numref)
    .order('sort_order', { ascending: true });
  editingImages = images || [];
  return new Promise((resolve) => { window._editModalResolve = resolve; });

  const colors = Array.isArray(product.colors) ? product.colors.filter(Boolean) : [];
  const sizes = Array.isArray(product.sizes) ? product.sizes.filter(Boolean) : [];

  const overlay = document.createElement('div');
  overlay.className = 'admin-modal-overlay';
  overlay.id = 'editModal';

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
          ${colors.map((c, i) => `
            <div class="admin-color-item" data-idx="${i}">
              <span class="admin-color-dot" style="background:${colorToHex(c) === 'multi' ? 'conic-gradient(#e87060 0deg 72deg, #4a7a4a 72deg 144deg, #3a6a9a 144deg 216deg, #e8c83a 216deg 288deg, #b03030 288deg 360deg)' : colorToHex(c)}"></span>
              <input type="text" class="color-name-input" value="${c}">
              <button class="admin-btn admin-btn-sm admin-btn-danger" data-action="remove-color" data-idx="${i}">&times;</button>
            </div>
          `).join('')}
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
            ${colors.map((c) => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
        <div class="admin-image-grid" id="imageGrid">
          ${editingImages.map((img) => `
            <div class="admin-image-card" data-id="${img.id}">
              <img src="${img.image_url.startsWith('http') ? img.image_url : adminImgUrl(img.image_url)}" onerror="this.src='${FALLBACK_IMG}'">
              <div class="admin-image-color">${img.color || 'Générique'}</div>
              <button class="admin-image-del" data-id="${img.id}" data-action="delete-img">&times;</button>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="admin-modal-footer">
        <button class="admin-btn admin-btn-outline" id="cancelEdit">Annuler</button>
        <button class="admin-btn" id="saveEdit">Enregistrer</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const closeModal = () => { overlay.remove(); if (window._editModalResolve) { window._editModalResolve(); window._editModalResolve = null; } };
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
      <button class="admin-btn admin-btn-sm admin-btn-danger" data-action="remove-color" data-idx="${idx}">&times;</button>
    `;
    colorsContainer.appendChild(div);
    div.querySelector('.color-name-input').addEventListener('input', (e) => {
      const hex = colorToHex(e.target.value);
      div.querySelector('.admin-color-dot').style.background = hex === 'multi' ? 'conic-gradient(#e87060 0deg 72deg, #4a7a4a 72deg 144deg, #3a6a9a 144deg 216deg, #e8c83a 216deg 288deg, #b03030 288deg 360deg)' : hex;
    });
    div.querySelector('[data-action=remove-color]').addEventListener('click', () => div.remove());
    const colorSelect = overlay.querySelector('#uploadColor');
    const newOption = document.createElement('option');
    newOption.value = '';
    newOption.textContent = '';
    colorSelect.appendChild(newOption);
  });

  overlay.querySelectorAll('[data-action=remove-color]').forEach((btn) => {
    btn.addEventListener('click', () => btn.closest('.admin-color-item').remove());
  });

  overlay.querySelectorAll('.color-name-input').forEach((input) => {
    input.addEventListener('input', (e) => {
      const hex = colorToHex(e.target.value);
      const dot = input.closest('.admin-color-item').querySelector('.admin-color-dot');
      dot.style.background = hex === 'multi' ? 'conic-gradient(#e87060 0deg 72deg, #4a7a4a 72deg 144deg, #3a6a9a 144deg 216deg, #e8c83a 216deg 288deg, #b03030 288deg 360deg)' : hex;
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
    chip.querySelector('[data-action=remove-size]').addEventListener('click', () => chip.remove());
    input.value = '';
  });

  overlay.querySelectorAll('[data-action=remove-size]').forEach((btn) => {
    btn.addEventListener('click', () => btn.closest('.admin-size-chip').remove());
  });

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
      const { error } = await supabaseClient.from('product_images').delete().eq('id', imgId);
      if (error) { alert('Erreur lors de la suppression de l\'image.'); return; }
      editingImages = editingImages.filter((img) => img.id !== imgId);
      btn.closest('.admin-image-card').remove();
    });
  });

  overlay.querySelector('#saveEdit').addEventListener('click', () => saveProductEdit(overlay, closeModal));
}

async function handleFileUpload(files, overlay) {
  if (!files || files.length === 0) return;
  const color = overlay.querySelector('#uploadColor').value || null;
  const grid = overlay.querySelector('#imageGrid');

  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const ext = file.name.split('.').pop();
    const fileName = `${editingProduct.numref}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = `products/${fileName}`;

    const { error: uploadError } = await supabaseClient.storage
      .from('product-images')
      .upload(filePath, file);

    if (uploadError) {
      alert('Erreur téléversement: ' + uploadError.message);
      continue;
    }

    const { data: insertData, error: insertError } = await supabaseClient
      .from('product_images')
      .insert({ product_numref: editingProduct.numref, image_url: fileName, color, sort_order: editingImages.length })
      .select();
    if (insertError) { alert('Erreur: ' + insertError.message); continue; }
    if (insertData && insertData[0]) {
      editingImages.push(insertData[0]);
      appendImageCard(grid, insertData[0]);
    }
  }
}

function appendImageCard(grid, imgData) {
  const card = document.createElement('div');
  card.className = 'admin-image-card';
  card.dataset.id = imgData.id;
  card.innerHTML = `
    <img src="${imgData.image_url.startsWith('http') ? imgData.image_url : adminImgUrl(imgData.image_url)}" onerror="this.src='${FALLBACK_IMG}'">
    <div class="admin-image-color">${imgData.color || 'Générique'}</div>
    <button class="admin-image-del" data-id="${imgData.id}" data-action="delete-img">&times;</button>
  `;
  card.querySelector('[data-action=delete-img]').addEventListener('click', async (btn) => {
    const imgId = imgData.id;
    const { error } = await supabaseClient.from('product_images').delete().eq('id', imgId);
    if (error) { alert('Erreur.'); return; }
    editingImages = editingImages.filter((img) => img.id !== imgId);
    card.remove();
  });
  grid.appendChild(card);
}

async function saveProductEdit(overlay, closeModal) {
  const colors = Array.from(overlay.querySelectorAll('#editColors .color-name-input'))
    .map((input) => input.value.trim())
    .filter(Boolean);
  const sizes = Array.from(overlay.querySelectorAll('#editSizes .admin-size-chip span'))
    .map((span) => span.textContent.trim())
    .filter(Boolean);

  const updates = {
    price: parseFloat(overlay.querySelector('#editPrice').value) || 0,
    total_qt: parseInt(overlay.querySelector('#editStock').value) || 0,
    category: overlay.querySelector('#editCategory').value.trim(),
    season: overlay.querySelector('#editSeason').value.trim(),
    description: overlay.querySelector('#editDescription').value.trim(),
    is_new: overlay.querySelector('#editIsNew').value === 'true',
    colors: colors,
    sizes: sizes,
  };

  const { error } = await supabaseClient
    .from('products')
    .update(updates)
    .eq('numref', editingProduct.numref);

  if (error) {
    alert('Erreur lors de l\'enregistrement: ' + error.message);
    return;
  }

  Object.assign(editingProduct, updates);
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

export { initAdmin, renderAdmin, openEditModal };