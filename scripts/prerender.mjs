import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

const SITE_URL = 'https://lechoixdesophie.com';
const SITE_NAME = 'Le Choix de Sophie';

const envPath = join(process.cwd(), '.env');
let supabaseUrl, supabaseAnonKey;
if (existsSync(envPath)) {
  const env = readFileSync(envPath, 'utf-8');
  supabaseUrl = env.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim().replace(/^["']|["']$/g, '');
  supabaseAnonKey = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim().replace(/^["']|["']$/g, '');
}
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const distDir = join(process.cwd(), 'dist');
const templateHtml = readFileSync(join(distDir, 'index.html'), 'utf-8');

function slugify(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
}

function productSlug(p) {
  return `${p.numref}-${slugify(p.description || p.numref)}`;
}

function imgUrl(filename) {
  if (!filename) return null;
  if (filename.startsWith('http')) return filename;
  const storageNew = `${supabaseUrl}/storage/v1/object/public/product-images/`;
  const storageOld = `${supabaseUrl}/storage/v1/object/public/product-photos/products/`;
  if (filename.includes('/')) return storageNew + filename;
  return storageOld + filename;
}

function ensureAbsoluteImg(filename) {
  const url = imgUrl(filename);
  if (!url) return `${SITE_URL}/assets/lockup-sombre.png`;
  return url.startsWith('http') ? url : `${SITE_URL}${url}`;
}

function buildMetaTags(opts) {
  const { title, desc, path, image, type = 'website', productPrice, productColors, productSizes, productNumref, productFournisseur, productCategory, productTotalQt } = opts;
  const url = `${SITE_URL}${path}`;
  const absImage = image ? (image.startsWith('http') ? image : `${SITE_URL}${image}`) : `${SITE_URL}/assets/lockup-sombre.png`;

  let tags = `  <title>${title}</title>\n`;
  tags += `  <meta name="description" content="${desc}">\n`;
  tags += `  <link rel="canonical" href="${url}">\n`;
  tags += `  <meta property="og:type" content="${type}">\n`;
  tags += `  <meta property="og:site_name" content="${SITE_NAME}">\n`;
  tags += `  <meta property="og:locale" content="fr_CA">\n`;
  tags += `  <meta property="og:title" content="${title}">\n`;
  tags += `  <meta property="og:description" content="${desc}">\n`;
  tags += `  <meta property="og:url" content="${url}">\n`;
  tags += `  <meta property="og:image" content="${absImage}">\n`;
  if (type === 'product') {
    tags += `  <meta property="og:image:width" content="1200">\n`;
    tags += `  <meta property="og:image:height" content="1200">\n`;
    if (productPrice) {
      tags += `  <meta property="product:price:amount" content="${parseFloat(productPrice) || 0}">\n`;
      tags += `  <meta property="product:price:currency" content="CAD">\n`;
    }
  }
  tags += `  <meta name="twitter:card" content="summary_large_image">\n`;
  tags += `  <meta name="twitter:title" content="${title}">\n`;
  tags += `  <meta name="twitter:description" content="${desc}">\n`;
  tags += `  <meta name="twitter:image" content="${absImage}">\n`;

  if (type === 'product') {
    const productJson = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: opts.productName || '',
      description: desc,
      sku: productNumref,
      brand: productFournisseur ? { '@type': 'Brand', name: productFournisseur } : undefined,
      category: productCategory || undefined,
      image: [absImage],
      offers: {
        '@type': 'Offer',
        price: parseFloat(productPrice) || 0,
        priceCurrency: 'CAD',
        availability: productTotalQt > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        url: url,
        itemCondition: 'https://schema.org/NewCondition',
      },
    };
    const crumbs = [
      { name: 'Accueil', url: SITE_URL + '/' },
      productCategory ? { name: productCategory, url: `${SITE_URL}/categorie/${slugify(productCategory)}` } : null,
      { name: opts.productName || productNumref, url: url },
    ].filter(Boolean);
    const breadcrumbJson = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })),
    };
    tags += `  <script type="application/ld+json">\n  ${JSON.stringify(productJson)}\n  </script>\n`;
    tags += `  <script type="application/ld+json">\n  ${JSON.stringify(breadcrumbJson)}\n  </script>\n`;
  }

  return tags;
}

function writePage(relPath, metaTags) {
  const fullPath = join(distDir, relPath, 'index.html');
  mkdirSync(dirname(fullPath), { recursive: true });
  const html = templateHtml.replace('<!--SEO-->', metaTags);
  writeFileSync(fullPath, html);
  console.log(`  ${relPath}`);
}

async function main() {
  console.log('Prerendering pages...');

  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .order('date_created', { ascending: false });

  if (error) { console.error('Error fetching products:', error); process.exit(1); }

  const { data: imgData } = await supabase
    .from('product_images')
    .select('product_numref, image_url, sort_order, color')
    .order('sort_order', { ascending: true });

  const imgMap = {};
  (imgData || []).forEach((row) => {
    if (!imgMap[row.product_numref]) imgMap[row.product_numref] = [];
    imgMap[row.product_numref].push(row.image_url);
  });

  (products || []).forEach((p) => {
    if (!Array.isArray(p.images) || p.images.length === 0) {
      const linked = imgMap[p.numref];
      if (linked && linked.length > 0) p.images = linked;
    }
  });

  const allProducts = products || [];
  const sitemapUrls = [`${SITE_URL}/`, `${SITE_URL}/a-propos`, `${SITE_URL}/nous-joindre`];

  const categories = [...new Set(allProducts.map((p) => p.category).filter(Boolean))];
  categories.forEach((cat) => {
    const slug = slugify(cat);
    const path = `/categorie/${slug}`;
    const title = `${cat} — ${SITE_NAME}`;
    const desc = `Découvrez notre sélection de ${cat.toLowerCase()} chez ${SITE_NAME}, boutique de mode féminine à Alma, Lac-Saint-Jean. Livraison 25 $, offerte dès 200 $.`;
    writePage(path, buildMetaTags({ title, desc, path, type: 'website' }));
    sitemapUrls.push(`${SITE_URL}${path}`);
  });

  allProducts.forEach((p) => {
    const slug = productSlug(p);
    const path = `/produit/${slug}`;
    const colors = (Array.isArray(p.colors) ? p.colors : []).map((c) => typeof c === 'string' ? c : c.name).filter(Boolean).join(', ');
    const sizes = (Array.isArray(p.sizes) ? p.sizes : []).join(', ');
    const title = `${p.description || 'Produit'}${p.fournisseur ? ' — ' + p.fournisseur : ''} | ${SITE_NAME}`;
    const desc = `${p.description || ''}${colors ? ', ' + colors : ''}${sizes ? ', ' + sizes : ''} — ${(typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0).toLocaleString('fr-CA', { minimumFractionDigits: 2 }) + ' $'} chez ${SITE_NAME}, boutique de mode féminine à Alma. Réf. ${p.numref}.`;
    const image = Array.isArray(p.images) && p.images.length > 0 ? ensureAbsoluteImg(p.images[0]) : null;
    writePage(path, buildMetaTags({
      title, desc, path, image, type: 'product',
      productPrice: p.price, productNumref: p.numref, productFournisseur: p.fournisseur,
      productCategory: p.category, productTotalQt: p.total_qt, productName: p.description,
    }));
    sitemapUrls.push(`${SITE_URL}${path}`);
  });

  writePage('/a-propos', buildMetaTags({
    title: `À propos — ${SITE_NAME}`,
    desc: 'Boutique de mode féminine à Alma, au Lac-Saint-Jean. Du chic décontracté au glamour urbain.',
    path: '/a-propos',
  }));
  writePage('/nous-joindre', buildMetaTags({
    title: `Nous joindre — ${SITE_NAME}`,
    desc: `Contactez Le Choix de Sophie à Alma. Téléphone, courriel, heures d'ouverture et formulaire de contact.`,
    path: '/nous-joindre',
  }));

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`;
  writeFileSync(join(distDir, 'sitemap.xml'), sitemap);
  console.log('  sitemap.xml');

  const robots = `User-agent: *\nDisallow: /admin\nDisallow: /commande\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
  writeFileSync(join(distDir, 'robots.txt'), robots);
  console.log('  robots.txt');

  console.log(`Done! Generated ${sitemapUrls.length} URLs.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
