// Cart module — persisted in localStorage, tracks via edge function

const CART_KEY = 'lcs_cart';
const TOKEN_KEY = 'lcs_cart_token';
const FREE_SHIPPING_THRESHOLD = 200;

function getCartToken() {
  let token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(TOKEN_KEY, token);
  }
  return token;
}

export function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateBadge();
  scheduleTrack();
}

export function cartCount() {
  return getCart().reduce((sum, it) => sum + it.quantity, 0);
}

export function cartSubtotal() {
  return getCart().reduce((sum, it) => sum + it.price * it.quantity, 0);
}

export function addToCart(item) {
  const cart = getCart();
  const existing = cart.find(
    (it) => it.numref === item.numref && it.color === item.color && it.size === item.size
  );
  if (existing) {
    existing.quantity += item.quantity || 1;
  } else {
    cart.push({ ...item, quantity: item.quantity || 1 });
  }
  saveCart(cart);
}

export function updateQty(index, qty) {
  const cart = getCart();
  if (index < 0 || index >= cart.length) return;
  if (qty <= 0) {
    cart.splice(index, 1);
  } else {
    cart[index].quantity = qty;
  }
  saveCart(cart);
}

export function removeFromCart(index) {
  const cart = getCart();
  cart.splice(index, 1);
  saveCart(cart);
}

export function clearCart() {
  localStorage.removeItem(CART_KEY);
  updateBadge();
  scheduleTrack();
}

export function updateBadge() {
  const count = cartCount();
  const badges = document.querySelectorAll('.badge');
  badges.forEach((badge) => {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  });
}

// --- Track cart (debounced) ---
let trackTimer = null;

function scheduleTrack() {
  clearTimeout(trackTimer);
  trackTimer = setTimeout(trackCart, 1500);
}

async function trackCart() {
  const cart = getCart();
  const subtotal = cartSubtotal();
  try {
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-cart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cart_token: getCartToken(),
        items: cart,
        subtotal,
        items_count: cartCount(),
      }),
    });
  } catch (e) {
    console.error('track-cart failed:', e);
  }
}

export { getCartToken, FREE_SHIPPING_THRESHOLD };
