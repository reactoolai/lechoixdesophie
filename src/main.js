import './style.css';
import './auth.css';
import './admin.css';
import { supabase } from './supabase.js';
import { initAdmin, renderAdmin, openEditModal } from './admin.js';
import {
  getCart, addToCart, updateQty, removeFromCart, clearCart,
  cartCount, cartSubtotal, updateBadge, getCartToken, FREE_SHIPPING_THRESHOLD,
} from './cart.js';

/* ---------- État ---------- */
let currentUser = null;
let allProducts = [];
let currentRoute = { page: 'home', category: null };
let catalogState = {
  category: 'Nouveautés',
  filters: { inStock: false, colors: new Set(), sizes: new Set(), priceMin: null, priceMax: null },
  sort: 'recent',
  visibleCount: 24,
};
let pdpState = null;

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
const STORAGE_NEW = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/product-images/`;
const STORAGE_OLD = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/product-photos/products/`;
function imgUrl(filename) {
  if (!filename) return FALLBACK_IMG;
  if (filename.startsWith('http') || filename.startsWith('data:')) return filename;
  if (filename.includes('/')) return STORAGE_NEW + filename;
  return STORAGE_OLD + filename;
}

/* ---------- Couleurs ---------- */
const COLOR_MAP = {
  noir: '#1a1a1a', black: '#1a1a1a', nero: '#1a1a1a', charbon: '#2a2a2a',
  blanc: '#f8f8f0', white: '#f8f8f0', offwhite: '#f0ece0', ecru: '#e8e2d4', creme: '#f5f0e0', ivoire: '#f3ecdf',
  blanc_casse: '#f0ece0', cassé: '#f0ece0',
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
  multi: 'multi', assorted: 'multi', varie: 'multi', raye: 'multi', rayé: 'multi',
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
function colorKey(color) {
  return normalizeColorKey(colorName(color));
}

const SITE_URL = 'https://lechoixdesophie.com';
const SITE_NAME = 'Le Choix de Sophie';

function ensureMeta(attr, key, val) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', val);
}

function ensureMetaProperty(prop, val) { ensureMeta('property', prop, val); }
function ensureMetaName(name, val) { ensureMeta('name', name, val); }

function ensureJsonLd(id, json) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(json);
}

function removeJsonLd(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function ensureTrailingSlash(path) {
  return path.endsWith('/') ? path : path + '/';
}

function updateSEOForProduct(product) {
  const title = `${product.description || 'Produit'}${product.fournisseur ? ' — ' + product.fournisseur : ''} | ${SITE_NAME}`;
  const colors = (Array.isArray(product.colors) ? product.colors : []).map((c) => colorName(c)).filter(Boolean).join(', ');
  const sizes = (Array.isArray(product.sizes) ? product.sizes : []).join(', ');
  const desc = product.description
    ? `${product.description}${colors ? ', ' + colors : ''}${sizes ? ', ' + sizes : ''} — ${formatPrice(product.price)} chez ${SITE_NAME}, boutique de mode féminine à Alma. Réf. ${product.numref}.`
    : `Mode féminine à Alma — ${SITE_NAME}`;
  const slug = productSlug(product);
  const url = `${SITE_URL}/produit/${slug}/`;
  const coverImg = Array.isArray(product.images) && product.images.length > 0
    ? imgUrl(product.images[0])
    : `${SITE_URL}/assets/lockup-sombre.png`;
  const absImg = coverImg.startsWith('http') ? coverImg : `${SITE_URL}${coverImg}`;

  document.title = title;
  ensureMetaName('description', desc);
  document.querySelector('link[rel="canonical"]').href = url;
  ensureMetaProperty('og:type', 'product');
  ensureMetaProperty('og:site_name', SITE_NAME);
  ensureMetaProperty('og:locale', 'fr_CA');
  ensureMetaProperty('og:title', title);
  ensureMetaProperty('og:description', desc);
  ensureMetaProperty('og:url', url);
  ensureMetaProperty('og:image', absImg);
  ensureMetaProperty('og:image:width', '1200');
  ensureMetaProperty('og:image:height', '1200');
  ensureMetaProperty('product:price:amount', String(parseFloat(product.price) || 0));
  ensureMetaProperty('product:price:currency', 'CAD');
  ensureMetaName('twitter:card', 'summary_large_image');
  ensureMetaName('twitter:title', title);
  ensureMetaName('twitter:description', desc);
  ensureMetaName('twitter:image', absImg);

  ensureJsonLd('ld-product', {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.description || '',
    description: desc,
    sku: product.numref,
    brand: product.fournisseur ? { '@type': 'Brand', name: product.fournisseur } : undefined,
    category: product.category || undefined,
    image: [absImg],
    offers: {
      '@type': 'Offer',
      price: parseFloat(product.price) || 0,
      priceCurrency: 'CAD',
      availability: product.total_qt > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: url,
      itemCondition: 'https://schema.org/NewCondition',
    },
  });

  const crumbs = [
    { name: 'Accueil', url: SITE_URL + '/' },
    product.category ? { name: product.category, url: `${SITE_URL}${categoryUrl(product.category)}` } : null,
    { name: product.description || product.numref, url: url },
  ].filter(Boolean);
  ensureJsonLd('ld-breadcrumb', {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  });
}

function updateSEOForCatalog(category) {
  const title = `${category} — ${SITE_NAME}`;
  const desc = `Découvrez notre sélection de ${category.toLowerCase()} chez ${SITE_NAME}, boutique de mode féminine à Alma, Lac-Saint-Jean. Livraison 25 $, offerte dès 200 $.`;
  const url = `${SITE_URL}${ensureTrailingSlash(categoryUrl(category))}`;

  document.title = title;
  ensureMetaName('description', desc);
  document.querySelector('link[rel="canonical"]').href = url;
  ensureMetaProperty('og:type', 'website');
  ensureMetaProperty('og:site_name', SITE_NAME);
  ensureMetaProperty('og:locale', 'fr_CA');
  ensureMetaProperty('og:title', title);
  ensureMetaProperty('og:description', desc);
  ensureMetaProperty('og:url', url);
  ensureMetaProperty('og:image', `${SITE_URL}/assets/lockup-sombre.png`);
  ensureMetaName('twitter:card', 'summary_large_image');
  ensureMetaName('twitter:title', title);
  ensureMetaName('twitter:description', desc);
  ensureMetaName('twitter:image', `${SITE_URL}/assets/lockup-sombre.png`);
  removeJsonLd('ld-product');
  ensureJsonLd('ld-breadcrumb', {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_URL + '/' },
      { '@type': 'ListItem', position: 2, name: category, item: url },
    ],
  });
}

function updateSEOForPage(title, desc, path) {
  const url = `${SITE_URL}${ensureTrailingSlash(path)}`;
  document.title = title;
  ensureMetaName('description', desc);
  document.querySelector('link[rel="canonical"]').href = url;
  ensureMetaProperty('og:type', 'website');
  ensureMetaProperty('og:site_name', SITE_NAME);
  ensureMetaProperty('og:locale', 'fr_CA');
  ensureMetaProperty('og:title', title);
  ensureMetaProperty('og:description', desc);
  ensureMetaProperty('og:url', url);
  ensureMetaProperty('og:image', `${SITE_URL}/assets/lockup-sombre.png`);
  ensureMetaName('twitter:card', 'summary_large_image');
  ensureMetaName('twitter:title', title);
  ensureMetaName('twitter:description', desc);
  ensureMetaName('twitter:image', `${SITE_URL}/assets/lockup-sombre.png`);
  removeJsonLd('ld-product');
  removeJsonLd('ld-breadcrumb');
}

function updateSEOForHome() {
  const title = `${SITE_NAME} — Boutique de mode féminine à Alma, Lac-Saint-Jean`;
  const desc = "Boutique de mode féminine à Alma, au Lac-Saint-Jean. Vêtements choisis une à une par Sophie : du chic décontracté au glamour urbain. Livraison 25 $, offerte dès 200 $.";
  const url = SITE_URL + '/';
  document.title = title;
  ensureMetaName('description', desc);
  document.querySelector('link[rel="canonical"]').href = url;
  ensureMetaProperty('og:type', 'website');
  ensureMetaProperty('og:site_name', SITE_NAME);
  ensureMetaProperty('og:locale', 'fr_CA');
  ensureMetaProperty('og:title', `${SITE_NAME} — Boutique de mode féminine à Alma`);
  ensureMetaProperty('og:description', "Boutique de mode féminine à Alma, au Lac-Saint-Jean. Du chic décontracté au glamour urbain.");
  ensureMetaProperty('og:url', url);
  ensureMetaProperty('og:image', `${SITE_URL}/assets/lockup-sombre.png`);
  ensureMetaName('twitter:card', 'summary_large_image');
  ensureMetaName('twitter:title', `${SITE_NAME} — Boutique de mode féminine à Alma`);
  ensureMetaName('twitter:description', "Boutique de mode féminine à Alma, au Lac-Saint-Jean.");
  ensureMetaName('twitter:image', `${SITE_URL}/assets/lockup-sombre.png`);
  removeJsonLd('ld-product');
  removeJsonLd('ld-breadcrumb');
}

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

  const { data: imgData } = await supabase
    .from('product_images')
    .select('product_numref, image_url, sort_order, color')
    .order('sort_order', { ascending: true });

  if (imgData) {
    const imgMap = {};
    const imgColorMap = {};
    imgData.forEach((row) => {
      if (!imgMap[row.product_numref]) imgMap[row.product_numref] = [];
      imgMap[row.product_numref].push(row.image_url);
      if (row.color) {
        if (!imgColorMap[row.product_numref]) imgColorMap[row.product_numref] = new Set();
        imgColorMap[row.product_numref].add(row.color);
      }
    });
    allProducts.forEach((p) => {
      const hasImages = Array.isArray(p.images) && p.images.length > 0;
      const linkedImages = imgMap[p.numref];
      if (!hasImages && linkedImages && linkedImages.length > 0) {
        p.images = linkedImages;
      }
      const colorMap = new Map();
      (Array.isArray(p.colors) ? p.colors : []).filter(Boolean).forEach((c) => {
        const k = colorKey(c);
        if (!colorMap.has(k)) colorMap.set(k, c);
      });
      const imgColors = imgColorMap[p.numref];
      if (imgColors) {
        imgColors.forEach((c) => {
          const k = colorKey(c);
          if (!colorMap.has(k)) colorMap.set(k, c);
        });
      }
      if (colorMap.size > 0) p.colors = [...colorMap.values()];
    });
  }

  await loadCategoryMedia();
  await renderCurrentPage();
}

/* ---------- Médias page d'accueil (vidéos catégories) ---------- */
const CATEGORY_SLOTS_MEDIA = [
  { key: 'cat-robes', catHref: '/categorie/robes', imgSrc: 'https://iwihwtpzrwyybumottcd.supabase.co/storage/v1/object/public/product-photos/products/10614298-1----0-62c259edc6754d50a60a48755aeea829.jpg', label: 'Robes' },
  { key: 'cat-shorts', catHref: '/categorie/jupes', imgSrc: '', label: 'Shorts' },
  { key: 'cat-jupes', catHref: '/categorie/jupes', imgSrc: '', label: 'Jupes' },
  { key: 'cat-tops', catHref: '/categorie/pantalons', imgSrc: '', label: 'Tops' },
  { key: 'cat-blouses', catHref: '/categorie/blouses', imgSrc: 'https://iwihwtpzrwyybumottcd.supabase.co/storage/v1/object/public/product-photos/products/10613845-1----0-b156cfe09d324d459c1eb1ba49742c7a.jpg', label: 'Blouses' },
];
const VIDEO_STORAGE_PUBLIC = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/category-videos/`;

async function loadCategoryMedia() {
  const { data } = await supabase
    .from('site_media')
    .select('*')
    .in('media_key', CATEGORY_SLOTS_MEDIA.map((s) => s.key));
  const mediaMap = {};
  (data || []).forEach((row) => { mediaMap[row.media_key] = row; });

  const grid = document.getElementById('catGrid');
  if (!grid) return;
  grid.innerHTML = '';
  for (const slot of CATEGORY_SLOTS_MEDIA) {
    const media = mediaMap[slot.key];
    const href = slot.catHref.replace(' & ', '%20&%20');
    const a = ce('a', { href: href, class: 'cat' });
    const ph = ce('div', { class: 'ph' });
    if (media) {
      const videoUrl = media.url.startsWith('http') ? media.url : VIDEO_STORAGE_PUBLIC + media.url;
      ph.innerHTML = `<video src="${videoUrl}" autoplay muted loop playsinline></video>`;
    } else {
      ph.innerHTML = `<img src="${slot.imgSrc}" alt="${slot.label}">`;
    }
    a.appendChild(ph);
    const labelDiv = ce('div', { class: 'cat-label' });
    labelDiv.innerHTML = `<span>${slot.label}</span>`;
    a.appendChild(labelDiv);
    grid.appendChild(a);
  }
}
/* ---------- Slug & category mapping ---------- */
const CATEGORY_SLUGS = {
  'nouveautes': 'Nouveautés',
  'robes': 'Robes',
  'jupes': 'Jupes',
  'blouses': 'Blouses',
  'pantalons': 'Pantalons',
  'denim': 'Denim',
  'vestes-manteaux': 'Vestes & Manteaux',
  'combinaisons': 'Combinaisons',
  'accessoires': 'Accessoires',
};

const CATEGORY_TO_SLUG = Object.fromEntries(
  Object.entries(CATEGORY_SLUGS).map(([slug, cat]) => [cat.toLowerCase(), slug])
);

function slugify(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function productSlug(product) {
  const desc = slugify(product.description || product.numref);
  return `${product.numref}-${desc}`;
}

function productUrl(product) {
  return `/produit/${productSlug(product)}`;
}

function categoryUrl(category) {
  const slug = CATEGORY_TO_SLUG[category.toLowerCase()] || slugify(category);
  return `/categorie/${slug}`;
}

function categoryFromSlug(slug) {
  return CATEGORY_SLUGS[slug] || CATEGORY_SLUGS[slug.toLowerCase()] || slug;
}

function parseRoute() {
  const path = window.location.pathname;
  const query = new URLSearchParams(window.location.search).get('q') || '';

  if (path === '/admin' || path.startsWith('/admin')) return { page: 'admin' };
  if (path === '/commande') return { page: 'checkout' };
  if (path.startsWith('/commande/confirmation/')) {
    const orderNumber = decodeURIComponent(path.slice('/commande/confirmation/'.length));
    return { page: 'confirmation', orderNumber };
  }
  if (path === '/recherche' || path.startsWith('/recherche')) return { page: 'search', query };
  if (path.startsWith('/produit/')) {
    const slug = decodeURIComponent(path.slice('/produit/'.length));
    const numref = slug.split('-')[0];
    return { page: 'product', numref, slug };
  }
  if (path.startsWith('/categorie/')) {
    const slug = decodeURIComponent(path.slice('/categorie/'.length));
    const category = categoryFromSlug(slug);
    return { page: 'catalog', category, slug };
  }
  if (path === '/a-propos') return { page: 'about' };
  if (path === '/nous-joindre') return { page: 'contact' };
  if (path === '/' || path === '') return { page: 'home' };
  return { page: 'home' };
}

function navigateTo(path) {
  history.pushState({}, '', path);
  navigate();
}

function handleLinkClick(e) {
  const a = e.target.closest('a');
  if (!a) return;
  const href = a.getAttribute('href');
  if (!href) return;
  if (href.startsWith('#') || href.startsWith('http') || href.startsWith('tel:') || href.startsWith('mailto:')) return;
  if (a.target === '_blank') return;
  if (e.ctrlKey || e.metaKey || e.shiftKey) return;
  e.preventDefault();
  navigateTo(href);
}

async function navigate() {
  // Redirect old hash URLs to new path-based URLs
  const hash = window.location.hash;
  if (hash && hash.startsWith('#/')) {
    const oldPath = hash.slice(1);
    let newPath = '/';
    if (oldPath.startsWith('/prod/')) {
      const numref = decodeURIComponent(oldPath.slice(6));
      const product = allProducts.find((p) => p.numref === numref);
      newPath = product ? productUrl(product) : `/produit/${numref}`;
    } else if (oldPath.startsWith('/cat/')) {
      const cat = decodeURIComponent(oldPath.slice(5));
      newPath = categoryUrl(cat);
    } else if (oldPath.startsWith('/recherche')) {
      const q = new URLSearchParams(oldPath.split('?')[1] || '').get('q') || '';
      newPath = `/recherche?q=${encodeURIComponent(q)}`;
    } else if (oldPath.startsWith('/commande/confirmation/')) {
      newPath = `/commande/confirmation/${decodeURIComponent(oldPath.slice('/commande/confirmation/'.length))}`;
    } else if (oldPath.startsWith('/commande')) {
      newPath = '/commande';
    } else if (oldPath.startsWith('/admin')) {
      newPath = '/admin';
    }
    history.replaceState({}, '', newPath);
  }

  currentRoute = parseRoute();
  if (currentRoute.page === 'catalog') {
    catalogState.category = currentRoute.category;
    catalogState.visibleCount = 24;
    catalogState.filters = { inStock: false, colors: new Set(), sizes: new Set(), priceMin: null, priceMax: null };
    catalogState.sort = 'recent';
    $('#sortSelect').value = 'recent';
    $('#filterInStock').checked = false;
    $('#priceMin').value = '';
    $('#priceMax').value = '';
  }
  await renderCurrentPage();
  closeCartDrawer();
}

async function renderCurrentPage() {
  const homeEl = $('#page-home');
  const catEl = $('#page-catalog');
  const prodEl = $('#page-product');
  const adminEl = $('#page-admin');
  const checkoutEl = $('#page-checkout');
  const confirmEl = $('#page-confirmation');
  const searchEl = $('#page-search');
  const aboutEl = $('#page-about');
  const contactEl = $('#page-contact');
  const isAdmin = currentRoute.page === 'admin';
  const siteChrome = document.querySelectorAll('.bandeau, .utility, header, .news, footer, .boutiques-section');
  siteChrome.forEach((el) => { el.style.display = isAdmin ? 'none' : ''; });
  homeEl.style.display = 'none';
  catEl.style.display = 'none';
  prodEl.style.display = 'none';
  if (adminEl) adminEl.style.display = 'none';
  if (checkoutEl) checkoutEl.style.display = 'none';
  if (confirmEl) confirmEl.style.display = 'none';
  if (searchEl) searchEl.style.display = 'none';
  if (aboutEl) aboutEl.style.display = 'none';
  if (contactEl) contactEl.style.display = 'none';

  if (currentRoute.page === 'home') {
    homeEl.style.display = '';
    renderHomePreview();
    loadCategoryMedia();
    updateSEOForHome();
  } else if (currentRoute.page === 'catalog') {
    catEl.style.display = '';
    renderCatalog();
    updateSEOForCatalog(catalogState.category);
  } else if (currentRoute.page === 'product') {
    prodEl.style.display = '';
    renderProductDetail();
    const product = allProducts.find((p) => p.numref === currentRoute.numref);
    if (product) updateSEOForProduct(product);
  } else if (currentRoute.page === 'search') {
    if (searchEl) {
      searchEl.style.display = '';
      const searchInput = $('#searchInput');
      if (searchInput && currentRoute.query) searchInput.value = currentRoute.query;
      renderSearchResults(currentRoute.query);
    }
  } else if (currentRoute.page === 'about') {
    if (aboutEl) aboutEl.style.display = '';
    updateSEOForPage('À propos — Le Choix de Sophie', 'Boutique de mode féminine à Alma, au Lac-Saint-Jean. Du chic décontracté au glamour urbain.', '/a-propos');
  } else if (currentRoute.page === 'contact') {
    if (contactEl) contactEl.style.display = '';
    updateSEOForPage('Nous joindre — Le Choix de Sophie', 'Contactez Le Choix de Sophie à Alma. Téléphone, courriel, heures d\'ouverture et formulaire de contact.', '/nous-joindre');
  } else if (currentRoute.page === 'checkout') {
    if (checkoutEl) {
      checkoutEl.style.display = '';
      renderCheckout();
    }
  } else if (currentRoute.page === 'confirmation') {
    if (confirmEl) {
      confirmEl.style.display = '';
      renderConfirmation(currentRoute.orderNumber);
    }
  } else if (currentRoute.page === 'admin') {
    if (adminEl) {
      adminEl.style.display = '';
      await renderAdmin(allProducts);
    }
  }
  window.scrollTo(0, 0);
  renderBoutiquesSection();
}



/* ---------- Section « Nos 3 boutiques » ---------- */
const BOUTIQUES = [
  { name: 'Le Mercier Alma', desc: 'Mercerie pour homme à Alma — chemises, costumes, polos et accessoires de marques sélectionnées, avec ajustements sur mesure en boutique.', link: 'https://lemercieralma.com', internal: false, logo: '/assets/lemercier-logo.jpg' },
  { name: 'Attitude Sports', desc: 'Vêtements et chaussures de sport pour toute la famille — performance, confort et style au quotidien.', link: 'https://attitudesports.ca', internal: false, logo: '/assets/attitudesport-logo.png' },
];

function renderBoutiquesSection() {
  const container = $('#boutiquesSection');
  if (!container) return;
  const currentPath = window.location.pathname;
  container.innerHTML = `
    <div class="wrap boutiques-wrap">
      <div class="boutiques-head">
        <div class="surtitre">Nos deux adresses</div>
        <h2>Découvrez nos deux autres boutiques</h2>
        <p>Deux autres adresses, une même passion du vêtement bien choisi.</p>
      </div>
      <div class="boutiques-grid boutiques-grid-two">
        ${BOUTIQUES.map((b) => {
          const logoSrc = b.logo || '/assets/monogramme.png';
          return `
          <div class="boutique-card">
            <div class="boutique-img"><img src="${logoSrc}" alt="${b.name}" style="object-fit:contain;padding:40px;background:var(--ivoire)"></div>
            <div class="boutique-body">
              <img src="${logoSrc}" alt="" width="40" style="margin-bottom:12px;opacity:.8">
              <h3>${b.name}</h3>
              <p>${b.desc}</p>
              <a href="${b.link}" target="_blank" rel="noopener noreferrer" class="btn-outline boutique-btn">Visiter</a>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
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
      return colors.some((c) => f.colors.has(colorKey(c)));
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

  const colorMap = new Map();
  const sizeSet = new Set();
  products.forEach((p) => {
    (Array.isArray(p.colors) ? p.colors : []).forEach((c) => {
      if (c) {
        const key = colorKey(c);
        if (!colorMap.has(key)) colorMap.set(key, c);
      }
    });
    (Array.isArray(p.sizes) ? p.sizes : []).forEach((s) => { if (s) sizeSet.add(s); });
  });

  const colorsContainer = $('#filterColors');
  colorsContainer.innerHTML = '';
  colorsContainer.className = 'color-swatches';
  [...colorMap.keys()].sort().forEach((key) => {
    const color = colorMap.get(key);
    const hex = colorToHex(color);
    const name = colorName(color);
    const swatch = ce('button', { class: 'color-swatch', title: name, 'aria-label': name });
    if (hex === 'multi') {
      swatch.classList.add('swatch-multi');
    } else {
      swatch.style.setProperty('--swatch-color', hex);
    }
    if (catalogState.filters.colors.has(key)) swatch.classList.add('active');
    swatch.addEventListener('click', () => {
      if (catalogState.filters.colors.has(key)) {
        catalogState.filters.colors.delete(key);
        swatch.classList.remove('active');
      } else {
        catalogState.filters.colors.add(key);
        swatch.classList.add('active');
      }
      catalogState.visibleCount = 24;
      renderCatalog();
    });
    colorsContainer.append(swatch);
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
      catalogState.visibleCount = 24;
      renderCatalog();
    });
    sizesContainer.append(chip);
  });
}

/* ---------- Carte produit ---------- */
function buildProductCard(p) {
  const imgSrc = Array.isArray(p.images) && p.images.length > 0
    ? imgUrl(p.images[0])
    : FALLBACK_IMG;

  const card = ce('div', { class: 'prod' });
  const tags = [];
  if (p.is_new) tags.push('<span class="tag">Nouveau</span>');
  if (p.total_qt === 0) tags.push('<span class="tag tag-soldout">Épuisé</span>');

  const colors = Array.isArray(p.colors) ? p.colors.filter((c) => c) : [];
  const dedupedColors = [];
  const seenKeys = new Set();
  colors.forEach((c) => {
    const k = colorKey(c);
    if (!seenKeys.has(k)) { seenKeys.add(k); dedupedColors.push(c); }
  });
  const colorDots = dedupedColors.slice(0, 5).map((c) => {
    const hex = colorToHex(c);
    const name = colorName(c);
    if (hex === 'multi') return '<button class="prod-color-dot dot-multi" data-color="' + name + '" title="' + name + '"></button>';
    return '<button class="prod-color-dot" style="--swatch-color:' + hex + '" data-color="' + name + '" title="' + name + '"></button>';
  }).join('');
  const moreColors = dedupedColors.length > 5 ? '<span class="prod-color-more">+' + (dedupedColors.length - 5) + '</span>' : '';

  const soldOut = p.total_qt === 0;

  card.innerHTML = `
    <div class="ph">
      <a href="${productUrl(p)}" class="prod-link">
        <img src="${imgSrc}" alt="${p.description || ''}" loading="lazy" onerror="this.src='${FALLBACK_IMG}'">
      </a>
      ${tags.join('')}
      <button class="prod-cart-btn" aria-label="Ajouter au panier">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 5h2l2.5 12h11l2.5-9H6.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="20" r="1.3" fill="currentColor"/><circle cx="17" cy="20" r="1.3" fill="currentColor"/></svg>
        <span>Ajouter</span>
      </button>
    </div>
    <div class="prod-info">
      <a href="${productUrl(p)}" class="prod-link">
        <div class="prod-nom">${p.description || ''}</div>
        <div class="prod-bottom">
          <div class="prod-prix">${formatPrice(p.price)}</div>
          ${dedupedColors.length > 0 ? '<div class="prod-colors">' + colorDots + moreColors + '</div>' : ''}
        </div>
      </a>
    </div>
  `;

  card.querySelectorAll('.prod-color-dot[data-color]').forEach((dot) => {
    dot.addEventListener('click', (e) => {
      e.preventDefault();
 e.stopPropagation();
      const key = normalizeColorKey(dot.dataset.color);
      if (catalogState.filters.colors.has(key)) {
        catalogState.filters.colors.delete(key);
      } else {
        catalogState.filters.colors.add(key);
      }
      catalogState.visibleCount = 24;
      renderCatalog();
    });
  });

  const cartBtn = card.querySelector('.prod-cart-btn');
  if (cartBtn) {
    if (soldOut) {
      cartBtn.disabled = true;
      cartBtn.style.opacity = '0.5';
      cartBtn.style.cursor = 'not-allowed';
      cartBtn.innerHTML = '<span>Épuisé</span>';
    } else {
      const hasVariants = (colors.length > 0 || sizes.length > 0);
      cartBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (hasVariants) {
          navigateTo(productUrl(p));
        } else {
          addToCart({
            numref: p.numref,
            name: p.description || '',
            image: imgSrc,
            color: null,
            size: null,
            price: parseFloat(p.price) || 0,
            quantity: 1,
          });
          showCartAddedFeedback(cartBtn);
          openCartDrawer();
        }
      });
    }
  }

  return card;
}

/* ---------- Page detail produit ---------- */
let productImagesCache = {};
async function loadProductImages(numref) {
  if (productImagesCache[numref]) return productImagesCache[numref];
  const { data, error } = await supabase
    .from('product_images')
    .select('*')
    .eq('product_numref', numref)
    .order('sort_order', { ascending: true });
  if (error) { console.error('Erreur chargement images:', error); return []; }
  productImagesCache[numref] = data || [];
  return productImagesCache[numref];
}

async function renderProductDetail() {
  const product = allProducts.find((p) => p.numref === currentRoute.numref);
  const container = $('#productDetail');
  const breadcrumb = $('#productBreadcrumb');

  if (!product) {
    container.innerHTML = '<div class="pdp-not-found"><div class="loading-msg">Produit introuvable.</div><a href="/categorie/nouveautes" class="btn-outline" style="display:inline-block;margin-top:16px;padding:10px 24px;border-radius:999px;text-decoration:none">Voir les nouveautés</a></div>';
    breadcrumb.innerHTML = '<a href="/">Accueil</a> <span>/</span> <span>Produit introuvable</span>';
    return;
  }

  breadcrumb.innerHTML = `<a href="/">Accueil</a> <span>/</span> <a href="${categoryUrl(product.category)}">${product.category}</a> <span>/</span> <span>${product.description || ''}</span>`;

  const rawColors = Array.isArray(product.colors) ? product.colors.filter(Boolean) : [];
  const colors = [];
  const seenKeys = new Set();
  rawColors.forEach((c) => {
    const k = colorKey(c);
    if (!seenKeys.has(k)) { seenKeys.add(k); colors.push(c); }
  });
  const sizes = Array.isArray(product.sizes) ? product.sizes.filter(Boolean) : [];
  const soldOut = product.total_qt <= 0;
  const inStock = product.total_qt > 0;

  const tags = [];
  if (product.is_new) tags.push('<span class="tag">Nouveau</span>');
  if (soldOut) tags.push('<span class="tag tag-soldout">Épuisé</span>');

  container.innerHTML = '<div class="loading-msg">Chargement…</div>';

  const colorImages = await loadProductImages(product.numref);

  let galleryImages;
  if (colorImages.length > 0) {
    galleryImages = colorImages.map((ci) => ci.image_url);
  } else {
    galleryImages = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  }

  // imgUrl is now defined globally at the top of the file

  let galleryHtml;
  if (galleryImages.length > 0) {
    galleryHtml = `<div class="pdp-gallery">
      <div class="pdp-main-img" id="pdpMainImgWrap">
        <img id="pdpMainImg" src="${imgUrl(galleryImages[0])}" alt="${product.description || ''}" onerror="this.src='${FALLBACK_IMG}'">
        ${tags.join('')}
        ${galleryImages.length > 1 ? `<button class="pdp-nav-arrow prev" id="pdpPrev" aria-label="Photo précédente"><svg viewBox="0 0 24 24" fill="none"><path d="M15 6 L9 12 L15 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <button class="pdp-nav-arrow next" id="pdpNext" aria-label="Photo suivante"><svg viewBox="0 0 24 24" fill="none"><path d="M9 6 L15 12 L9 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <span class="pdp-img-counter" id="pdpCounter">1 / ${galleryImages.length}</span>` : ''}
        <span class="pdp-zoom-hint">Cliquez pour zoomer</span>
      </div>
      ${galleryImages.length > 1 ? `<div class="pdp-thumbs" id="pdpThumbs">${galleryImages.map((img, i) => `<button class="pdp-thumb${i === 0 ? ' active' : ''}" data-img="${imgUrl(img)}"><img src="${imgUrl(img)}" alt="" loading="lazy" onerror="this.src='${FALLBACK_IMG}'"></button>`).join('')}</div>` : ''}
    </div>`;
  } else {
    galleryHtml = `<div class="pdp-gallery">
      <div class="pdp-main-img">
        <img src="${FALLBACK_IMG}" alt="${product.description || ''}">
        ${tags.join('')}
      </div>
    </div>`;
  }

  const colorDots = colors.map((c) => {
    const hex = colorToHex(c);
    const name = colorName(c);
    const key = colorKey(c);
    const ci = colorImages.find((ci) => colorKey(ci.color) === key);
    const firstImg = ci ? ci.image_url : null;
    if (hex === 'multi') return `<button class="pdp-color-btn" data-color="${name}" data-img="${firstImg || ''}"><span class="prod-color-dot dot-multi" title="${name}"></span></button>`;
    return `<button class="pdp-color-btn" data-color="${name}" data-img="${firstImg || ''}"><span class="prod-color-dot" style="--swatch-color:${hex}" title="${name}"></span></button>`;
  }).join('');

  const sizeChips = sizes.map((s) => `<button class="chip" data-size="${s}">${s}</button>`).join('');

  function getSizesForColor(colorName) {
    if (!colorName) return sizes;
    const matrix = product.color_size_matrix;
    if (!matrix || Object.keys(matrix).length === 0) return sizes;
    const key = normalizeColorKey(colorName);
    const colorSizes = matrix[key];
    if (!colorSizes || colorSizes.length === 0) return sizes;
    return sizes.filter((s) => colorSizes.includes(s));
  }

  function renderSizeChips(colorName) {
    const available = getSizesForColor(colorName);
    return available.map((s) => `<button class="chip" data-size="${s}">${s}</button>`).join('');
  }

  const shareUrl = `${SITE_URL}/produit/${productSlug(product)}`;
  const shareImg = (Array.isArray(product.images) && product.images.length > 0 ? imgUrl(product.images[0]) : `${SITE_URL}/assets/lockup-sombre.png`).startsWith('http') ? (Array.isArray(product.images) && product.images.length > 0 ? imgUrl(product.images[0]) : `${SITE_URL}/assets/lockup-sombre.png`) : `${SITE_URL}${Array.isArray(product.images) && product.images.length > 0 ? imgUrl(product.images[0]) : '/assets/lockup-sombre.png'}`;

  container.innerHTML = `
    ${galleryHtml}
    <div class="pdp-info">
      ${product.season ? `<div class="surtitre">${product.season}</div>` : ''}
      <h1 class="pdp-title">${product.description || ''}</h1>
      <div class="pdp-price">${formatPrice(product.price)}</div>
      <div class="pdp-stock ${inStock ? 'in' : 'out'}">${inStock ? 'En stock' : 'Épuisé'}</div>
      ${colors.length > 0 ? `<div class="pdp-section"><div class="pdp-label">Couleurs</div><div class="pdp-colors" id="pdpColors">${colorDots}</div></div>` : ''}
      ${sizes.length > 0 ? `<div class="pdp-section"><div class="pdp-label">Tailles</div><div class="pdp-sizes" id="pdpSizes">${sizeChips}</div></div>` : ''}
      <div class="pdp-section">
        <button class="btn pdp-add-cart">Ajouter au panier</button>
      </div>
      <div class="pdp-meta">
        <div><span>Numéro:</span> <span class="pdp-numref">${product.numref}</span> <button class="pdp-copy-ref" id="copyRefBtn" title="Copier la référence">Copier</button></div>
        ${product.fournisseur ? `<div><span>Marque:</span> ${product.fournisseur}</div>` : ''}
        ${product.subdept ? `<div><span>Type:</span> ${product.subdept}</div>` : ''}
      </div>
      <div class="pdp-share">
        <div class="pdp-label">Partager</div>
        <div class="pdp-share-btns">
          <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}" target="_blank" rel="noopener noreferrer" class="pdp-share-btn" aria-label="Partager sur Facebook" title="Facebook">FB</a>
          <a href="https://www.facebook.com/dialog/send?app_id=&link=${encodeURIComponent(shareUrl)}&redirect_uri=${encodeURIComponent(shareUrl)}" target="_blank" rel="noopener noreferrer" class="pdp-share-btn" aria-label="Partager sur Messenger" title="Messenger">M</a>
          <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(product.description || '')}" target="_blank" rel="noopener noreferrer" class="pdp-share-btn" aria-label="Partager sur X" title="X">X</a>
          <a href="https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareUrl)}&media=${encodeURIComponent(shareImg)}&description=${encodeURIComponent(product.description || '')}" target="_blank" rel="noopener noreferrer" class="pdp-share-btn" aria-label="Partager sur Pinterest" title="Pinterest">P</a>
          <a href="https://wa.me/?text=${encodeURIComponent((product.description || '') + ' ' + shareUrl)}" target="_blank" rel="noopener noreferrer" class="pdp-share-btn" aria-label="Partager sur WhatsApp" title="WhatsApp">W</a>
          <a href="mailto:?subject=${encodeURIComponent(product.description || '')}&body=${encodeURIComponent(shareUrl)}" class="pdp-share-btn" aria-label="Partager par courriel" title="Courriel">@</a>
          <button class="pdp-share-btn pdp-copy-link" id="copyLinkBtn" aria-label="Copier le lien" title="Copier le lien">Lien</button>
        </div>
      </div>
      ${currentUser ? `<div class="pdp-admin-bar"><button class="admin-btn" id="pdpEditBtn">Modifier ce produit</button></div>` : ''}
    </div>
  `;

  const editBtn = $('#pdpEditBtn');
  if (editBtn) {
    editBtn.addEventListener('click', async () => {
      await openEditModal(product);
      productImagesCache[product.numref] = null;
      renderProductDetail();
    });
  }

  const copyBtn = $('#copyRefBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(product.numref).then(() => {
        copyBtn.textContent = 'Copié !';
        copyBtn.classList.add('copied');
        setTimeout(() => { copyBtn.textContent = 'Copier'; copyBtn.classList.remove('copied'); }, 1500);
      }).catch(() => {});
    });
  }

  const copyLinkBtn = $('#copyLinkBtn');
  if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(shareUrl).then(() => {
        copyLinkBtn.textContent = 'Copié !';
        copyLinkBtn.classList.add('copied');
        setTimeout(() => { copyLinkBtn.textContent = 'Lien'; copyLinkBtn.classList.remove('copied'); }, 1500);
      }).catch(() => {});
    });
  }

  let currentGallery = galleryImages;
  let currentIdx = 0;

  function showImage(idx) {
    if (!currentGallery.length) return;
    currentIdx = ((idx % currentGallery.length) + currentGallery.length) % currentGallery.length;
    const mainImg = $('#pdpMainImg');
    if (mainImg) {
      mainImg.src = imgUrl(currentGallery[currentIdx]);
      const wrap = $('#pdpMainImgWrap');
      if (wrap) wrap.classList.remove('zoomed');
    }
    const counter = $('#pdpCounter');
    if (counter) counter.textContent = `${currentIdx + 1} / ${currentGallery.length}`;
    container.querySelectorAll('.pdp-thumb').forEach((t, i) => {
      t.classList.toggle('active', i === currentIdx);
    });
  }

  if (galleryImages.length > 1) {
    const mainImg = $('#pdpMainImg');
    container.querySelectorAll('.pdp-thumb').forEach((thumb, i) => {
      thumb.addEventListener('click', () => showImage(i));
    });
    const prevBtn = $('#pdpPrev');
    const nextBtn = $('#pdpNext');
    if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); showImage(currentIdx - 1); });
    if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); showImage(currentIdx + 1); });
  }

  const mainImgWrap = $('#pdpMainImgWrap');
  const mainImgEl = $('#pdpMainImg');
  if (mainImgWrap && mainImgEl) {
    mainImgEl.addEventListener('click', (e) => {
      e.stopPropagation();
      mainImgWrap.classList.toggle('zoomed');
      if (mainImgWrap.classList.contains('zoomed')) {
        const rect = mainImgWrap.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        mainImgEl.style.transformOrigin = `${x}% ${y}%`;
      } else {
        mainImgEl.style.transformOrigin = 'center center';
      }
    });
    mainImgWrap.addEventListener('mousemove', (e) => {
      if (!mainImgWrap.classList.contains('zoomed')) return;
      const rect = mainImgWrap.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      mainImgEl.style.transformOrigin = `${x}% ${y}%`;
    });
  }

  if (colors.length > 0 && colorImages.length > 0) {
    const thumbsEl = $('#pdpThumbs');
    const sizesEl = $('#pdpSizes');
    container.querySelectorAll('.pdp-color-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = normalizeColorKey(btn.dataset.color);
        const colorImgs = colorImages.filter((ci) => colorKey(ci.color) === key);
        if (colorImgs.length > 0) {
          currentGallery = colorImgs.map((ci) => ci.image_url);
          if (thumbsEl) {
            thumbsEl.innerHTML = currentGallery.map((img, i) => `<button class="pdp-thumb${i === 0 ? ' active' : ''}" data-img="${imgUrl(img)}"><img src="${imgUrl(img)}" alt="" loading="lazy" onerror="this.src='${FALLBACK_IMG}'"></button>`).join('');
            thumbsEl.querySelectorAll('.pdp-thumb').forEach((thumb, i) => {
              thumb.addEventListener('click', () => showImage(i));
            });
          }
          const counter = $('#pdpCounter');
          if (counter) counter.textContent = `1 / ${currentGallery.length}`;
          container.querySelectorAll('.pdp-color-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          showImage(0);
        }
        if (sizesEl) {
          sizesEl.innerHTML = renderSizeChips(btn.dataset.color);
          attachSizeChipHandlers(sizesEl);
        }
      });
    });
  }

  function attachSizeChipHandlers(sizesEl) {
    sizesEl.querySelectorAll('.chip[data-size]').forEach((chip) => {
      chip.addEventListener('click', () => {
        sizesEl.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
      });
    });
  }

  const sizesElInit = $('#pdpSizes');
  if (sizesElInit) attachSizeChipHandlers(sizesElInit);

  const addBtn = container.querySelector('.pdp-add-cart');
  if (addBtn && soldOut) {
    addBtn.disabled = true;
    addBtn.textContent = 'Épuisé';
  }

  pdpState = { product, colors, sizes, galleryImages, soldOut };
}

/* ---------- Helpers panier ---------- */
function showCartAddedFeedback(btn) {
  const origHTML = btn.innerHTML;
  btn.classList.add('added');
  btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Ajouté</span>';
  setTimeout(() => {
    btn.classList.remove('added');
    btn.innerHTML = origHTML;
  }, 1200);
}

function showPdpError(btn, msg) {
  let err = btn.parentElement.querySelector('.pdp-error');
  if (!err) {
    err = ce('div', { class: 'pdp-error', style: 'color:#b03030;font-size:13px;margin-top:8px;' });
    btn.parentElement.appendChild(err);
  }
  err.textContent = msg;
  err.style.display = 'block';
  clearTimeout(err._timer);
  err._timer = setTimeout(() => { err.style.display = 'none'; }, 3000);
}

/* ---------- Tiroir panier ---------- */
function openCartDrawer() {
  renderCartDrawer();
  $('#cartOverlay')?.classList.add('open');
  $('#cartDrawer')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCartDrawer() {
  $('#cartOverlay')?.classList.remove('open');
  $('#cartDrawer')?.classList.remove('open');
  document.body.style.overflow = '';
}

function renderCartDrawer() {
  const body = $('#cartDrawerBody');
  const footer = $('#cartDrawerFooter');
  if (!body || !footer) return;

  const cart = getCart();

  if (cart.length === 0) {
    body.innerHTML = '<div class="cart-empty">Votre panier est vide.<br><br><a href="/categorie/nouveautes">Découvrir les nouveautés</a></div>';
    footer.innerHTML = '';
    return;
  }

  body.innerHTML = '';
  cart.forEach((item, i) => {
    const el = ce('div', { class: 'cart-item' });
    el.innerHTML = `
      <img class="cart-item-img" src="${item.image || FALLBACK_IMG}" alt="" onerror="this.src='${FALLBACK_IMG}'">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name || ''}</div>
        ${item.color || item.size ? `<div class="cart-item-variant">${[item.color, item.size].filter(Boolean).join(' / ')}</div>` : ''}
        <div class="cart-item-price">${formatPrice(item.price)}</div>
        <div class="cart-item-controls">
          <button class="cart-qty-btn" data-act="dec">−</button>
          <span class="cart-qty-val">${item.quantity}</span>
          <button class="cart-qty-btn" data-act="inc">+</button>
          <button class="cart-item-remove" data-act="remove">Retirer</button>
        </div>
      </div>`;
    el.querySelector('[data-act="inc"]').addEventListener('click', () => { updateQty(i, item.quantity + 1); renderCartDrawer(); });
    el.querySelector('[data-act="dec"]').addEventListener('click', () => { updateQty(i, item.quantity - 1); renderCartDrawer(); });
    el.querySelector('[data-act="remove"]').addEventListener('click', () => { removeFromCart(i); renderCartDrawer(); });
    body.appendChild(el);
  });

  const subtotal = cartSubtotal();
  const remaining = FREE_SHIPPING_THRESHOLD - subtotal;
  const freeShipMsg = remaining > 0
    ? `Plus que ${formatPrice(remaining)} pour la livraison gratuite`
    : 'Livraison gratuite débloquée';

  footer.innerHTML = `
    <div class="cart-subtotal-row">
      <span class="cart-subtotal-label">Sous-total</span>
      <span class="cart-subtotal-val">${formatPrice(subtotal)}</span>
    </div>
    <div class="cart-free-ship ${remaining > 0 ? '' : 'qualified'}">${freeShipMsg}</div>
    <button class="btn cart-checkout-btn" id="cartCheckoutBtn">Passer à la caisse</button>
    <a class="cart-continue" id="cartContinue">Continuer mes achats</a>`;

  $('#cartCheckoutBtn').addEventListener('click', () => {
    closeCartDrawer();
    navigateTo('/commande');
  });
  $('#cartContinue').addEventListener('click', closeCartDrawer);
}

/* ---------- Recherche ---------- */
function normalizeSearch(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s\-_]+/g, ' ').trim();
}

function normalizeSku(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s\-_]/g, '');
}

function searchProducts(term) {
  const normTerm = normalizeSearch(term);
  if (!normTerm) return [];
  const words = normTerm.split(/\s+/).filter(Boolean);
  const skuTerm = normalizeSku(term);

  const results = [];
  for (const p of allProducts) {
    const numref = normalizeSku(p.numref);
    const desc = normalizeSearch(p.description);
    const cat = normalizeSearch(p.category);
    const dept = normalizeSearch(p.dept);
    const subdept = normalizeSearch(p.subdept);
    const fournisseur = normalizeSearch(p.fournisseur);
    const season = normalizeSearch(p.season);
    const colors = (Array.isArray(p.colors) ? p.colors : []).map((c) => normalizeSearch(colorName(c))).join(' ');
    const sizes = (Array.isArray(p.sizes) ? p.sizes : []).map((s) => normalizeSearch(s)).join(' ');

    const haystack = [numref, desc, cat, dept, subdept, fournisseur, season, colors, sizes].join(' ');
    const allWordsMatch = words.every((w) => haystack.includes(w));
    if (!allWordsMatch) continue;

    let score = 0;
    if (numref === skuTerm) score = 1000;
    else if (numref.startsWith(skuTerm)) score = 900;
    else if (desc.startsWith(normTerm)) score = 800;
    else if (desc.includes(normTerm)) score = 700;
    else if (fournisseur.includes(normTerm)) score = 600;
    else if (cat.includes(normTerm)) score = 500;
    else if (colors.includes(normTerm) || sizes.includes(normTerm)) score = 400;
    else score = 300;

    results.push({ product: p, score });
  }

  results.sort((a, b) => b.score - a.score);
  return results.map((r) => r.product);
}

let searchState = { query: '', results: [], visibleCount: 24, filters: { inStock: false, colors: new Set(), sizes: new Set(), priceMin: null, priceMax: null }, sort: 'relevance' };

function renderSearchResults(query) {
  searchState.query = query || '';
  searchState.visibleCount = 24;
  searchState.filters = { inStock: false, colors: new Set(), sizes: new Set(), priceMin: null, priceMax: null };
  searchState.sort = 'relevance';

  const titleEl = $('#searchTitle');
  const countEl = $('#searchCount');
  const grid = $('#searchGrid');

  if (searchState.query.trim() === '') {
    titleEl.textContent = 'Recherche';
    countEl.textContent = '';
    grid.innerHTML = '<div class="loading-msg">Entrez un terme de recherche.</div>';
    $('#searchLoadMoreWrap').style.display = 'none';
    return;
  }

  searchState.results = searchProducts(searchState.query);
  titleEl.textContent = `${searchState.results.length} résultat${searchState.results.length > 1 ? 's' : ''} pour « ${searchState.query} »`;

  buildSearchFilterChips();
  renderSearchGrid();

  if (searchState.results.length === 0) {
    countEl.textContent = '';
    grid.innerHTML = `<div class="loading-msg">Aucun produit ne correspond à « ${searchState.query} ». Essayez une autre recherche ou parcourez nos catégories :</div>`;
    const catLinks = document.createElement('div');
    catLinks.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;margin-top:16px;justify-content:center';
    ['Nouveautés', 'Robes', 'Jupes', 'Blouses', 'Pantalons', 'Vestes & Manteaux'].forEach((cat) => {
      const a = ce('a', { href: categoryUrl(cat), class: 'btn-outline' });
      a.textContent = cat;
      a.style.cssText = 'display:inline-block;padding:10px 24px;border-radius:999px;font-size:13px;text-decoration:none';
      catLinks.appendChild(a);
    });
    grid.appendChild(catLinks);
    $('#searchLoadMoreWrap').style.display = 'none';
  }
}

function buildSearchFilterChips() {
  const products = searchState.results;
  const colorMap = new Map();
  const sizeSet = new Set();
  products.forEach((p) => {
    (Array.isArray(p.colors) ? p.colors : []).forEach((c) => {
      if (c) {
        const key = colorKey(c);
        if (!colorMap.has(key)) colorMap.set(key, c);
      }
    });
    (Array.isArray(p.sizes) ? p.sizes : []).forEach((s) => { if (s) sizeSet.add(s); });
  });

  const colorsContainer = $('#searchFilterColors');
  colorsContainer.innerHTML = '';
  colorsContainer.className = 'color-swatches';
  [...colorMap.keys()].sort().forEach((key) => {
    const color = colorMap.get(key);
    const hex = colorToHex(color);
    const name = colorName(color);
    const swatch = ce('button', { class: 'color-swatch', title: name, 'aria-label': name });
    if (hex === 'multi') swatch.classList.add('swatch-multi');
    else swatch.style.setProperty('--swatch-color', hex);
    swatch.addEventListener('click', () => {
      if (searchState.filters.colors.has(key)) { searchState.filters.colors.delete(key); swatch.classList.remove('active'); }
      else { searchState.filters.colors.add(key); swatch.classList.add('active'); }
      searchState.visibleCount = 24;
      renderSearchGrid();
    });
    colorsContainer.append(swatch);
  });

  const sizesContainer = $('#searchFilterSizes');
  sizesContainer.innerHTML = '';
  const sizeOrder = ['TP/XS','P/S','M/M','G/L','TG/XL','XXL','24','25','26','27','28','29','30','31','32','33','34','36','38','40','42','44','46','1/2','3/4','5/6','7/8','9/10','11/12','13/14'];
  const sortedSizes = [...sizeSet].sort((a, b) => {
    const ia = sizeOrder.indexOf(a), ib = sizeOrder.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
  sortedSizes.forEach((size) => {
    const chip = ce('button', { class: 'chip' });
    chip.textContent = size;
    chip.addEventListener('click', () => {
      if (searchState.filters.sizes.has(size)) { searchState.filters.sizes.delete(size); chip.classList.remove('active'); }
      else { searchState.filters.sizes.add(size); chip.classList.add('active'); }
      searchState.visibleCount = 24;
      renderSearchGrid();
    });
    sizesContainer.append(chip);
  });
}

function getFilteredSearchResults() {
  let products = [...searchState.results];
  const f = searchState.filters;
  if (f.inStock) products = products.filter((p) => p.total_qt > 0);
  if (f.colors.size > 0) {
    products = products.filter((p) => {
      const colors = Array.isArray(p.colors) ? p.colors : [];
      return colors.some((c) => f.colors.has(colorKey(c)));
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

  const sort = searchState.sort;
  if (sort === 'price-asc') products.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
  else if (sort === 'price-desc') products.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
  else if (sort === 'name') products.sort((a, b) => (a.description || '').localeCompare(b.description || '', 'fr'));
  else if (sort === 'recent') products.sort((a, b) => (b.is_new ? 1 : 0) - (a.is_new ? 1 : 0));

  return products;
}

function renderSearchGrid() {
  const products = getFilteredSearchResults();
  const countEl = $('#searchCount');
  const grid = $('#searchGrid');

  countEl.textContent = `${products.length} produit${products.length > 1 ? 's' : ''}`;

  if (products.length === 0) {
    grid.innerHTML = '<div class="loading-msg">Aucun produit ne correspond à vos filtres.</div>';
    $('#searchLoadMoreWrap').style.display = 'none';
    return;
  }

  const visible = products.slice(0, searchState.visibleCount);
  grid.innerHTML = '';
  visible.forEach((p) => grid.append(buildProductCard(p)));

  const hasMore = products.length > searchState.visibleCount;
  $('#searchLoadMoreWrap').style.display = hasMore ? 'block' : 'none';
}

function setupSearch() {
  const input = $('#searchInput');
  const suggestionsEl = $('#searchSuggestions');
  if (!input || !suggestionsEl) return;

  let debounceTimer = null;
  let currentResults = [];
  let selectedIdx = -1;

  function showSuggestions() {
    if (currentResults.length === 0) { suggestionsEl.style.display = 'none'; return; }
    const max = Math.min(8, currentResults.length);
    let html = currentResults.slice(0, max).map((p, i) => {
      const imgSrc = Array.isArray(p.images) && p.images.length > 0 ? imgUrl(p.images[0]) : FALLBACK_IMG;
      return `<div class="search-suggestion ${i === selectedIdx ? 'active' : ''}" data-idx="${i}" data-numref="${p.numref}">
        <img src="${imgSrc}" alt="" onerror="this.src='${FALLBACK_IMG}'">
        <div class="search-suggestion-info">
          <div class="search-suggestion-name">${p.description || ''}</div>
          <div class="search-suggestion-sku">${p.numref}</div>
        </div>
        <div class="search-suggestion-price">${formatPrice(p.price)}</div>
      </div>`;
    }).join('');
    html += `<div class="search-suggestion-all" data-count="${currentResults.length}">Voir les ${currentResults.length} résultats</div>`;
    suggestionsEl.innerHTML = html;
    suggestionsEl.style.display = 'block';

    suggestionsEl.querySelectorAll('.search-suggestion').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx);
        const product = currentResults[idx];
        if (product) {
          const term = input.value.trim();
          const skuTerm = normalizeSku(term);
          if (normalizeSku(product.numref) === skuTerm) {
            navigateTo(productUrl(product));
          } else {
            navigateTo(productUrl(product));
          }
          hideSuggestions();
        }
      });
      el.addEventListener('mouseenter', () => {
        selectedIdx = parseInt(el.dataset.idx);
        updateActiveSuggestion();
      });
    });

    const allBtn = suggestionsEl.querySelector('.search-suggestion-all');
    if (allBtn) {
      allBtn.addEventListener('click', () => {
        navigateTo(`/recherche?q=${encodeURIComponent(input.value.trim())}`);
        hideSuggestions();
      });
    }
  }

  function updateActiveSuggestion() {
    suggestionsEl.querySelectorAll('.search-suggestion').forEach((el, i) => {
      el.classList.toggle('active', i === selectedIdx);
    });
  }

  function hideSuggestions() {
    suggestionsEl.style.display = 'none';
    selectedIdx = -1;
  }

  input.addEventListener('input', () => {
    const term = input.value.trim();
    if (!term) { hideSuggestions(); return; }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const skuTerm = normalizeSku(term);
      const exactSku = allProducts.find((p) => normalizeSku(p.numref) === skuTerm);
      if (exactSku) {
        navigateTo(productUrl(exactSku));
        input.value = '';
        hideSuggestions();
        return;
      }
      currentResults = searchProducts(term);
      selectedIdx = -1;
      showSuggestions();
    }, 200);
  });

  input.addEventListener('keydown', (e) => {
    if (suggestionsEl.style.display === 'none') {
      if (e.key === 'Enter') {
        const term = input.value.trim();
        if (term) {
          const skuTerm = normalizeSku(term);
          const exactSku = allProducts.find((p) => normalizeSku(p.numref) === skuTerm);
          if (exactSku) {
            e.preventDefault();
            navigateTo(productUrl(exactSku));
            input.value = '';
          } else {
            e.preventDefault();
            navigateTo(`/recherche?q=${encodeURIComponent(term)}`);
            hideSuggestions();
          }
        }
      }
      return;
    }
    const max = Math.min(8, currentResults.length);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIdx = Math.min(selectedIdx + 1, max - 1);
      updateActiveSuggestion();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIdx = Math.max(selectedIdx - 1, -1);
      updateActiveSuggestion();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIdx >= 0 && currentResults[selectedIdx]) {
        navigateTo(productUrl(currentResults[selectedIdx]));
        input.value = '';
        hideSuggestions();
      } else {
        navigateTo(`/recherche?q=${encodeURIComponent(input.value.trim())}`);
        hideSuggestions();
      }
    } else if (e.key === 'Escape') {
      hideSuggestions();
      input.blur();
    }
  });

  input.addEventListener('focus', () => {
    if (currentResults.length > 0) showSuggestions();
  });

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !suggestionsEl.contains(e.target)) hideSuggestions();
  });

  // Wire up search page filter controls
  $('#searchFilterInStock')?.addEventListener('change', (e) => { searchState.filters.inStock = e.target.checked; searchState.visibleCount = 24; renderSearchGrid(); });
  $('#searchPriceMin')?.addEventListener('input', () => { searchState.filters.priceMin = parseFloat($('#searchPriceMin').value) || null; searchState.visibleCount = 24; renderSearchGrid(); });
  $('#searchPriceMax')?.addEventListener('input', () => { searchState.filters.priceMax = parseFloat($('#searchPriceMax').value) || null; searchState.visibleCount = 24; renderSearchGrid(); });
  $('#searchSortSelect')?.addEventListener('change', (e) => { searchState.sort = e.target.value; searchState.visibleCount = 24; renderSearchGrid(); });
  $('#searchResetFilters')?.addEventListener('click', () => {
    searchState.filters = { inStock: false, colors: new Set(), sizes: new Set(), priceMin: null, priceMax: null };
    $('#searchFilterInStock').checked = false;
    $('#searchPriceMin').value = '';
    $('#searchPriceMax').value = '';
    searchState.visibleCount = 24;
    buildSearchFilterChips();
    renderSearchGrid();
  });
  $('#searchFilterToggle')?.addEventListener('click', () => {
    $('#searchFilterSidebar').classList.add('open');
    $('#searchFilterOverlay').classList.add('show');
  });
  $('#searchFilterOverlay')?.addEventListener('click', () => {
    $('#searchFilterSidebar').classList.remove('open');
    $('#searchFilterOverlay').classList.remove('show');
  });
  $('#searchLoadMoreBtn')?.addEventListener('click', () => { searchState.visibleCount += 24; renderSearchGrid(); });
  document.querySelectorAll('#searchFilterSidebar .filter-title').forEach((title) => {
    title.addEventListener('click', () => { title.closest('.filter-group').classList.toggle('collapsed'); });
  });
}

/* ---------- Page caisse ---------- */
let squareCard = null;

function renderCheckout() {
  const cart = getCart();
  if (cart.length === 0) {
    navigateTo('/');
    return;
  }

  const form = $('#checkoutForm');
  form.innerHTML = `
    <div class="checkout-error" id="checkoutError"></div>

    <div class="checkout-step">
      <h2 class="checkout-step-title"><span class="checkout-step-num">1</span> Coordonnées</h2>
      <div class="checkout-fields">
        <div class="checkout-field"><label>Prénom <span class="req">*</span></label><input type="text" id="co-firstname" required></div>
        <div class="checkout-field"><label>Nom <span class="req">*</span></label><input type="text" id="co-lastname" required></div>
        <div class="checkout-field full"><label>Courriel <span class="req">*</span></label><input type="email" id="co-email" required></div>
        <div class="checkout-field"><label>Téléphone</label><input type="tel" id="co-phone"></div>
      </div>
    </div>

    <div class="checkout-step">
      <h2 class="checkout-step-title"><span class="checkout-step-num">2</span> Mode de réception</h2>
      <div class="checkout-fulfillment">
        <label class="fulfillment-option selected" data-type="pickup">
          <input type="radio" name="fulfillment" value="pickup" checked>
          <div class="fulfillment-option-title">Ramassage en boutique</div>
          <div class="fulfillment-option-desc">630 Rue Sacré-Coeur O, Alma (Québec)</div>
          <div class="fulfillment-option-price">Gratuit</div>
          <div class="fulfillment-option-desc" style="margin-top:6px">Lun–mer 9h30–17h · Jeu–ven 9h30–21h · Sam–dim 10h–17h</div>
        </label>
        <label class="fulfillment-option" data-type="delivery">
          <input type="radio" name="fulfillment" value="delivery">
          <div class="fulfillment-option-title">Livraison</div>
          <div class="fulfillment-option-desc">Partout au Québec</div>
          <div class="fulfillment-option-price">25 $ · gratuite dès 200 $</div>
        </label>
      </div>
      <div class="fulfillment-detail" id="deliveryFields">
        <div class="checkout-fields" style="margin-top:16px">
          <div class="checkout-field full"><label>Adresse <span class="req">*</span></label><input type="text" id="co-address1"></div>
          <div class="checkout-field full"><label>Appartement, suite (optionnel)</label><input type="text" id="co-address2"></div>
          <div class="checkout-field"><label>Ville <span class="req">*</span></label><input type="text" id="co-city"></div>
          <div class="checkout-field"><label>Province</label><select id="co-province"><option>Québec</option><option>Ontario</option><option>Nouveau-Brunswick</option><option>Colombie-Britannique</option><option>Alberta</option><option>Manitoba</option><option>Saskatchewan</option><option>Nouvelle-Écosse</option><option>Île-du-Prince-Édouard</option><option>Terre-Neuve-et-Labrador</option></select></div>
          <div class="checkout-field"><label>Code postal <span class="req">*</span></label><input type="text" id="co-postal"></div>
        </div>
      </div>
    </div>

    <div class="checkout-step">
      <h2 class="checkout-step-title"><span class="checkout-step-num">3</span> Paiement</h2>
      <div id="card-container"></div>
      <button class="btn checkout-submit" id="checkoutSubmit">Payer maintenant</button>
    </div>`;

  // Fulfillment toggle
  form.querySelectorAll('.fulfillment-option').forEach((opt) => {
    opt.addEventListener('click', () => {
      form.querySelectorAll('.fulfillment-option').forEach((o) => o.classList.remove('selected'));
      opt.classList.add('selected');
      opt.querySelector('input').checked = true;
      const isDelivery = opt.dataset.type === 'delivery';
      $('#deliveryFields').classList.toggle('show', isDelivery);
      renderCheckoutSummary();
    });
  });

  renderCheckoutSummary();

  // Square card
  initSquareCard();

  // Submit
  $('#checkoutSubmit').addEventListener('click', handleCheckoutSubmit);
}

async function initSquareCard() {
  const appId = import.meta.env.VITE_SQUARE_APP_ID;
  const locationId = import.meta.env.VITE_SQUARE_LOCATION_ID;
  if (!window.Square || !appId || !locationId) {
    $('#card-container').innerHTML = '<p style="color:#b03030;font-size:14px;">Module de paiement indisponible. Veuillez réessayer ou nous contacter.</p>';
    return;
  }
  try {
    const payments = window.Square.payments(appId, locationId);
    squareCard = await payments.card();
    await squareCard.attach('#card-container');
  } catch (err) {
    console.error('Square init error:', err);
    $('#card-container').innerHTML = '<p style="color:#b03030;font-size:14px;">Impossible de charger le module de paiement. Veuillez rafraîchir la page.</p>';
  }
}

function renderCheckoutSummary() {
  const summary = $('#checkoutSummary');
  if (!summary) return;
  const cart = getCart();
  const subtotal = cartSubtotal();
  const isDelivery = document.querySelector('.fulfillment-option[data-type="delivery"]')?.classList.contains('selected');
  const ftype = isDelivery ? 'delivery' : 'pickup';
  const shipping = ftype === 'pickup' ? 0 : subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 25;
  const tps = Math.round((subtotal + shipping) * 0.05 * 100) / 100;
  const tvq = Math.round((subtotal + shipping) * 0.09975 * 100) / 100;
  const total = subtotal + shipping + tps + tvq;

  let itemsHtml = cart.map((it) => `
    <div class="summary-item">
      <img class="summary-item-img" src="${it.image || FALLBACK_IMG}" alt="" onerror="this.src='${FALLBACK_IMG}'">
      <div class="summary-item-info">
        <div class="summary-item-name">${it.name || ''}</div>
        ${it.color || it.size ? `<div class="summary-item-variant">${[it.color, it.size].filter(Boolean).join(' / ')}</div>` : ''}
        <div class="summary-item-qty">Qté: ${it.quantity}</div>
      </div>
      <div class="summary-item-price">${formatPrice(it.price * it.quantity)}</div>
    </div>`).join('');

  summary.innerHTML = `
    <h3>Récapitulatif</h3>
    ${itemsHtml}
    <div class="summary-totals">
      <div class="row"><span>Sous-total</span><span>${formatPrice(subtotal)}</span></div>
      <div class="row"><span>Livraison</span><span>${shipping === 0 ? 'Gratuite' : formatPrice(shipping)}</span></div>
      <div class="row"><span>TPS (5%)</span><span>${formatPrice(tps)}</span></div>
      <div class="row"><span>TVQ (9,975%)</span><span>${formatPrice(tvq)}</span></div>
      <div class="row total"><span>Total</span><span>${formatPrice(total)}</span></div>
    </div>
    <p style="font-size:11px;color:var(--gris-clair);margin-top:12px;font-style:italic;">Les montants sont indicatifs et recalculés au paiement.</p>`;
}

async function handleCheckoutSubmit() {
  const errBox = $('#checkoutError');
  errBox.classList.remove('show');
  const btn = $('#checkoutSubmit');

  const firstName = $('#co-firstname').value.trim();
  const lastName = $('#co-lastname').value.trim();
  const email = $('#co-email').value.trim();
  const phone = $('#co-phone').value.trim();
  const fulfillmentType = document.querySelector('input[name="fulfillment"]:checked')?.value || 'pickup';

  if (!firstName || !lastName) { showCheckoutError('Le prénom et le nom sont obligatoires.'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showCheckoutError('Adresse courriel invalide.'); return; }
  if (!squareCard) { showCheckoutError('Module de paiement non chargé. Veuillez rafraîchir la page.'); return; }

  let shipping = {};
  if (fulfillmentType === 'delivery') {
    shipping = {
      address1: $('#co-address1').value.trim(),
      address2: $('#co-address2').value.trim(),
      city: $('#co-city').value.trim(),
      province: $('#co-province').value,
      postal_code: $('#co-postal').value.trim(),
    };
    if (!shipping.address1 || !shipping.city || !shipping.postal_code) {
      showCheckoutError('Adresse, ville et code postal obligatoires pour la livraison.');
      return;
    }
  }

  btn.disabled = true;
  btn.textContent = 'Traitement du paiement…';

  let tokenResult;
  try {
    tokenResult = await squareCard.tokenize();
  } catch (tokenizeErr) {
    showCheckoutError('Erreur lors de la lecture de la carte. Vérifiez les informations saisies.');
    btn.disabled = false;
    btn.textContent = 'Payer maintenant';
    return;
  }

  if (tokenResult.status !== 'OK') {
    showCheckoutError('Carte refusée. Vérifiez le numéro ou essayez une autre carte.');
    btn.disabled = false;
    btn.textContent = 'Payer maintenant';
    return;
  }

  const cart = getCart();
  const items = cart.map((it) => ({
    numref: it.numref,
    quantity: it.quantity,
    color: it.color,
    size: it.size,
  }));

  try {
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cart_token: getCartToken(),
        customer: { first_name: firstName, last_name: lastName, email, phone },
        fulfillment_type: fulfillmentType,
        shipping,
        items,
        payment_token: tokenResult.token,
      }),
    });

    const data = await resp.json();

    if (!resp.ok || data.error) {
      showCheckoutError(data.error || 'Le paiement a échoué. Veuillez réessayer.');
      btn.disabled = false;
      btn.textContent = 'Payer maintenant';
      return;
    }

    clearCart();
    navigateTo(`/commande/confirmation/${data.order_number}`);
  } catch (fetchErr) {
    console.error('create-order fetch error:', fetchErr);
    showCheckoutError('Erreur de communication avec le serveur. Veuillez réessayer.');
    btn.disabled = false;
    btn.textContent = 'Payer maintenant';
  }
}

function showCheckoutError(msg) {
  const errBox = $('#checkoutError');
  errBox.textContent = msg;
  errBox.classList.add('show');
  errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ---------- Page confirmation ---------- */
function renderConfirmation(orderNumber) {
  const el = $('#confirmationContent');
  if (!el) return;
  el.innerHTML = `
    <div class="confirmation-box">
      <div class="surtitre">Merci !</div>
      <h1 class="page-title">Votre commande a été reçue</h1>
      <p>Nous vous remercions de votre confiance. Voici votre numéro de commande :</p>
      <div class="confirmation-order-num">${orderNumber}</div>
      <p class="confirmation-email-note">Un courriel de confirmation vient d'être envoyé à votre adresse.</p>
      <div class="confirmation-continue">
        <a href="/" class="btn">Retour à la boutique</a>
      </div>
    </div>`;
}

/* ---------- Navigation & events ---------- */
function setupEvents() {
  $('#cartClose')?.addEventListener('click', closeCartDrawer);
  $('#cartOverlay')?.addEventListener('click', closeCartDrawer);

  $('#productDetail')?.addEventListener('click', (e) => {
    const addBtn = e.target.closest('.pdp-add-cart');
    if (!addBtn || addBtn.disabled || !pdpState || pdpState.soldOut) return;
    const container = $('#productDetail');
    const selectedColorBtn = container.querySelector('.pdp-color-btn.active');
    const selectedSizeBtn = container.querySelector('.pdp-sizes .chip.active');
    const selectedColor = selectedColorBtn ? selectedColorBtn.dataset.color : null;
    const selectedSize = selectedSizeBtn ? selectedSizeBtn.textContent : null;
    if (pdpState.colors.length > 0 && !selectedColor) {
      showPdpError(addBtn, 'Veuillez choisir une couleur.');
      return;
    }
    if (pdpState.sizes.length > 0 && !selectedSize) {
      showPdpError(addBtn, 'Veuillez choisir une taille.');
      return;
    }
    const imgSrc = pdpState.galleryImages.length > 0 ? imgUrl(pdpState.galleryImages[0]) : FALLBACK_IMG;
    addToCart({
      numref: pdpState.product.numref,
      name: pdpState.product.description || '',
      image: imgSrc,
      color: selectedColor,
      size: selectedSize,
      price: parseFloat(pdpState.product.price) || 0,
      quantity: 1,
    });
    addBtn.textContent = 'Ajouté au panier !';
    addBtn.classList.add('added');
    setTimeout(() => {
      addBtn.textContent = 'Ajouter au panier';
      addBtn.classList.remove('added');
    }, 1500);
    openCartDrawer();
  });
  document.querySelectorAll('[data-cart-link]').forEach((a) => {
    a.addEventListener('click', (e) => { e.preventDefault(); openCartDrawer(); });
  });

  $('#loadMoreBtn')?.addEventListener('click', () => {
    catalogState.visibleCount += 24;
    renderCatalog();
  });

  $('#sortSelect')?.addEventListener('change', (e) => {
    catalogState.sort = e.target.value;
    catalogState.visibleCount = 24;
    renderCatalog();
  });

  $('#filterInStock')?.addEventListener('change', (e) => {
    catalogState.filters.inStock = e.target.checked;
    catalogState.visibleCount = 24;
    renderCatalog();
  });

  $('#priceMin')?.addEventListener('input', (e) => {
    catalogState.filters.priceMin = e.target.value ? parseFloat(e.target.value) : null;
    catalogState.visibleCount = 24;
    renderCatalog();
  });

  $('#priceMax')?.addEventListener('input', (e) => {
    catalogState.filters.priceMax = e.target.value ? parseFloat(e.target.value) : null;
    catalogState.visibleCount = 24;
    renderCatalog();
  });

  $('#resetFilters')?.addEventListener('click', () => {
    catalogState.filters = { inStock: false, colors: new Set(), sizes: new Set(), priceMin: null, priceMax: null };
    catalogState.visibleCount = 24;
    $('#filterInStock').checked = false;
    $('#priceMin').value = '';
    $('#priceMax').value = '';
    document.querySelectorAll('.chip.active').forEach((c) => c.classList.remove('active'));
    document.querySelectorAll('.color-swatch.active').forEach((c) => c.classList.remove('active'));
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

  // --- Recherche ---
  setupSearch();

  document.querySelector('#newsletterForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#newsletterEmail').value.trim();
    const btn = $('#newsletterBtn');
    const msg = $('#newsletterMsg');
    btn.disabled = true;
    btn.textContent = 'Inscription…';
    try {
      const { error } = await supabase
        .from('newsletter_subscribers')
        .upsert({ email, source: 'footer' }, { onConflict: 'email', ignoreDuplicates: true });
      if (error) throw error;
      msg.textContent = 'Merci ! Vous êtes maintenant abonnée à l\'infolettre.';
      msg.style.color = '#4a7a4a';
      msg.style.display = 'block';
      e.target.reset();
    } catch (err) {
      msg.textContent = 'Une erreur est survenue. Veuillez réessayer.';
      msg.style.color = '#b03030';
      msg.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'S\'abonner';
    }
  });

  window.addEventListener('popstate', navigate);
  document.addEventListener('click', handleLinkClick);

  // Contact form
  $('#contactForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const msg = $('#contactFormMsg');
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Envoi…';
    msg.style.display = 'none';
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contact-form`;
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          name: form.name.value.trim(),
          email: form.email.value.trim(),
          subject: form.subject?.value?.trim() || '',
          message: form.message.value.trim(),
        }),
      });
      if (!resp.ok) throw new Error('Erreur');
      msg.textContent = 'Merci ! Votre message a été envoyé. Nous vous répondrons sous peu.';
      msg.style.color = '#4a7a4a';
      msg.style.display = 'block';
      form.reset();
    } catch (err) {
      msg.textContent = 'Une erreur est survenue. Veuillez nous écrire à info@lechoixdesophie.com.';
      msg.style.color = '#b03030';
      msg.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Envoyer';
    }
  });

  renderBoutiquesSection();
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
  const iconsEl = document.querySelector('.icons');
  if (!iconsEl) return;
  const existing = $('#authUserMenu');
  if (existing) existing.remove();
  let slot = iconsEl.querySelector('a');
  if (!slot) return;
  if (currentUser) {
    const isAdmin = ['info@lechoixdesophie.com', 'ohmohamed116@gmail.com'].includes(currentUser.email);
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
    if (isAdmin) {
      const adminItem = ce('button', { class: 'auth-dropdown-item' });
      adminItem.textContent = 'Tableau de bord admin';
      adminItem.addEventListener('click', () => { navigateTo('/admin'); });
      dropdown.append(emailLine, divider, adminItem, ce('div', { class: 'auth-dropdown-divider' }), logoutItem);
    } else {
      dropdown.append(emailLine, divider, logoutItem);
    }
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains('show');
      document.querySelectorAll('.auth-dropdown.show').forEach((d) => d.classList.remove('show'));
      if (!isOpen) dropdown.classList.add('show');
    });
    document.addEventListener('click', () => dropdown.classList.remove('show'));
    dropdown.addEventListener('click', (e) => e.stopPropagation());
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
    (async () => {
      currentUser = session?.user ?? null;
      renderAuthState();
      if (currentRoute.page === 'admin') await renderAdmin(allProducts);
    })();
  });

  const connexionLink = document.querySelector('.icons a');
  if (connexionLink && connexionLink.textContent.includes('Connexion')) {
    connexionLink.addEventListener('click', (e) => { e.preventDefault(); openAuth(); });
  }

  updateBadge();
  navigate();
  await loadProducts();
  initAdmin(allProducts);
}

init();
