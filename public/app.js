const tabButtons = Array.from(document.querySelectorAll('.top-tab'));
const sections = {
  products: document.getElementById('products-section'),
  cart: document.getElementById('cart-section'),
  orders: document.getElementById('orders-section'),
  login: document.getElementById('login-section'),
  register: document.getElementById('register-section')
};
const authMessage = document.getElementById('authMessage');
const registerMessage = document.getElementById('registerMessage');
const cartMessage = document.getElementById('cartMessage');
const ordersMessage = document.getElementById('ordersMessage');
const userArea = document.getElementById('user-area');
const productList = document.getElementById('product-list');
const cartList = document.getElementById('cart-list');
const cartTotal = document.getElementById('cartTotal');
const ordersList = document.getElementById('orders-list');
const adminProducts = document.getElementById('adminProducts');
const loginButton = document.getElementById('loginButton');
const registerButton = document.getElementById('registerButton');
const gotoRegister = document.getElementById('gotoRegister');
const gotoLogin = document.getElementById('gotoLogin');
const checkoutButton = document.getElementById('checkoutButton');
const openSidebar = document.getElementById('openSidebar');
const closeSidebar = document.getElementById('closeSidebar');
const sidebar = document.getElementById('sidebar');
const sidebarTabs = Array.from(document.querySelectorAll('.sidebar-tab'));
const sidebarCart = document.getElementById('sidebarCart');
const sidebarOrders = document.getElementById('sidebarOrders');
const openCartBar = document.getElementById('openCartBar');
const checkoutBarButton = document.getElementById('checkoutBarButton');
const cartBar = document.getElementById('cart-bar');
const cartBarCount = document.getElementById('cartBarCount');
const cartBarTotal = document.getElementById('cartBarTotal');
const adminPanel = document.getElementById('admin-panel');
const logoutButton = document.createElement('button');
logoutButton.textContent = 'Cerrar sesión';
logoutButton.classList.add('secondary');
const productForm = document.getElementById('productForm');
const productReset = document.getElementById('productReset');

async function api(path, options = {}) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options
  });
  return res.json();
}

function showMessage(element, text) {
  element.textContent = text;
  setTimeout(() => {
    if (element.textContent === text) {
      element.textContent = '';
    }
  }, 3000);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
}

function setActiveTab(tabName) {
  tabButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tabName);
  });

  if (tabName === 'cart') {
    setActiveSidebar('cart');
    toggleSidebar(true);
    Object.values(sections).forEach((section) => section.classList.add('hide'));
    sections.products.classList.remove('hide');
    return;
  }

  Object.values(sections).forEach((section) => section.classList.add('hide'));
  if (sections[tabName]) {
    sections[tabName].classList.remove('hide');
  }

  if (tabName === 'products') {
    loadProducts();
  }
  if (tabName === 'orders') {
    loadOrders();
  }
  if (tabName === 'login') {
    authMessage.textContent = '';
  }
  if (tabName === 'register') {
    registerMessage.textContent = '';
  }
}

function setActiveSidebar(activePanel) {
  sidebarTabs.forEach((button) => {
    button.classList.toggle('active', button.dataset.sidebar === activePanel);
  });
  sidebarCart.classList.toggle('hide', activePanel !== 'cart');
  sidebarOrders.classList.toggle('hide', activePanel !== 'orders');
  if (activePanel === 'cart') {
    loadCart();
  } else {
    loadOrders();
  }
}

function toggleSidebar(open = true) {
  sidebar.classList.toggle('hide', !open);
}

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setActiveTab(button.dataset.tab);
  });
});

sidebarTabs.forEach((button) => {
  button.addEventListener('click', () => {
    setActiveSidebar(button.dataset.sidebar);
  });
});

openSidebar.addEventListener('click', () => {
  setActiveSidebar('cart');
  toggleSidebar(true);
});

closeSidebar.addEventListener('click', () => toggleSidebar(false));

gotoRegister.addEventListener('click', () => setActiveTab('register'));
gotoLogin.addEventListener('click', () => setActiveTab('login'));
openCartBar.addEventListener('click', () => setActiveTab('cart'));
checkoutBarButton.addEventListener('click', () => checkout());
checkoutButton.addEventListener('click', () => checkout());

async function refreshUser() {
  const user = await api('/me');
  renderUser(user);
}

function renderUser(user) {
  userArea.innerHTML = '';
  if (!user) {
    adminPanel.classList.add('hide');
    document.querySelector('[data-tab="login"]').classList.remove('hidden-tab');
    document.querySelector('[data-tab="register"]').classList.remove('hidden-tab');
    if (document.querySelector('.top-tab.active')?.dataset.tab === 'orders') {
      setActiveTab('login');
    }
    return;
  }

  const label = document.createElement('span');
  label.textContent = `Bienvenido, ${user.username}`;
  userArea.appendChild(label);
  userArea.appendChild(logoutButton);
  document.querySelector('[data-tab="login"]').classList.add('hidden-tab');
  document.querySelector('[data-tab="register"]').classList.add('hidden-tab');

  if (user.role === 'admin') {
    adminPanel.classList.remove('hide');
    loadAdminProducts();
  } else {
    adminPanel.classList.add('hide');
  }

  if (['login', 'register'].includes(document.querySelector('.top-tab.active')?.dataset.tab)) {
    setActiveTab('products');
  }
  loadProducts();
  loadCart();
}

async function loadProducts() {
  const products = await api('/products');
  productList.innerHTML = products
    .map(
      (product) => `
      <article class="product-card">
        <img src="${product.image}" alt="${product.name}" />
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <p class="badge">Precio: ${formatCurrency(product.price)}</p>
        <p class="badge">Stock: ${product.stock}</p>
        <button ${product.stock === 0 ? 'disabled' : ''} onclick="addToCart(${product.id})">${product.stock === 0 ? 'Agotado' : 'Agregar al carrito'}</button>
      </article>`
    )
    .join('');
}

async function loadCart() {
  const cart = await api('/cart');
  cartList.innerHTML = cart.length
    ? cart
        .map(
          (item) => `
      <div class="cart-item">
        <h3>${item.name}</h3>
        <p>Cantidad: ${item.quantity}</p>
        <p>Subtotal: ${formatCurrency(item.price * item.quantity)}</p>
        <button class="secondary" onclick="removeFromCart(${item.id})">Eliminar</button>
      </div>`
        )
        .join('')
    : '<div class="empty-state">El carrito está vacío. Agrega productos desde la tienda.</div>';

  sidebarCart.innerHTML = cart.length
    ? cart
        .map(
          (item) => `
      <div class="cart-item">
        <h3>${item.name}</h3>
        <p>Cantidad: ${item.quantity}</p>
        <p>Subtotal: ${formatCurrency(item.price * item.quantity)}</p>
        <button class="secondary" onclick="removeFromCart(${item.id})">Eliminar</button>
      </div>`
        )
        .join('')
    : '<div class="empty-state">Tu carrito está vacío. Agrega productos desde la tienda.</div>';

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  cartTotal.textContent = formatCurrency(total);
  renderCartBar(cart);
}

function renderCartBar(cart) {
  if (!cart.length) {
    cartBar.classList.add('hide');
    return;
  }
  cartBar.classList.remove('hide');
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  cartBarCount.textContent = count;
  cartBarTotal.textContent = formatCurrency(total);
}

async function loadOrders() {
  const response = await api('/orders');
  if (response.error) {
    ordersMessage.textContent = response.error;
    ordersList.innerHTML = '<div class="empty-state">Inicia sesión para ver tus pedidos.</div>';
    sidebarOrders.innerHTML = '<div class="empty-state">Inicia sesión para ver tus pedidos.</div>';
    return;
  }

  ordersMessage.textContent = '';
  const orderHtml = response.length
    ? response
        .map(
          (order) => `
      <article class="order-card">
        <div class="section-header">
          <h3>Pedido #${order.id}</h3>
          <p>${new Date(order.createdAt).toLocaleString('es-ES')}</p>
        </div>
        <p class="badge">Total: ${formatCurrency(order.total)}</p>
        ${order.items
          .map(
            (item) => `
        <div class="order-item">
          <p><strong>${item.name}</strong></p>
          <p>Cantidad: ${item.quantity}</p>
          <p>Precio unidad: ${formatCurrency(item.price)}</p>
        </div>`
          )
          .join('')}
      </article>`
        )
        .join('')
    : '<div class="empty-state">Aún no hay pedidos registrados.</div>';

  ordersList.innerHTML = orderHtml;
  sidebarOrders.innerHTML = orderHtml;
}

async function addToCart(productId) {
  const response = await api('/cart/add', { method: 'POST', body: JSON.stringify({ productId, quantity: 1 }) });
  if (response.error) return showMessage(authMessage, response.error);
  loadCart();
}

async function removeFromCart(productId) {
  const response = await api('/cart/remove', { method: 'POST', body: JSON.stringify({ productId }) });
  if (response.error) return showMessage(cartMessage, response.error);
  loadCart();
}

async function checkout() {
  const response = await api('/cart/checkout', { method: 'POST', body: JSON.stringify({}) });
  if (response.error) {
    showMessage(cartMessage, response.error);
    return;
  }
  showMessage(cartMessage, 'Compra realizada con éxito');
  loadCart();
  loadOrders();
  setActiveTab('orders');
}

loginButton.addEventListener('click', async () => {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const response = await api('/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  if (response.error) return showMessage(authMessage, response.error);
  renderUser(response);
  setActiveTab('products');
});

registerButton.addEventListener('click', async () => {
  const username = document.getElementById('registerUsername').value.trim();
  const password = document.getElementById('registerPassword').value;
  const response = await api('/register', { method: 'POST', body: JSON.stringify({ username, password }) });
  if (response.error) return showMessage(registerMessage, response.error);
  renderUser(response);
  setActiveTab('products');
});

logoutButton.addEventListener('click', async () => {
  await api('/logout', { method: 'POST' });
  renderUser(null);
  setActiveTab('products');
});

productForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = document.getElementById('productId').value;
  const name = document.getElementById('productName').value.trim();
  const description = document.getElementById('productDescription').value.trim();
  const price = document.getElementById('productPrice').value;
  const stock = document.getElementById('productStock').value;
  const image = document.getElementById('productImage').value.trim();

  const body = { name, description, price, stock, image };
  const path = id ? `/admin/products/${id}` : '/admin/products';
  const method = id ? 'PUT' : 'POST';
  const response = await api(path, { method, body: JSON.stringify(body) });
  if (response.error) return showMessage(document.getElementById('adminMessage'), response.error);
  productForm.reset();
  document.getElementById('productId').value = '';
  loadAdminProducts();
  loadProducts();
  showMessage(document.getElementById('adminMessage'), 'Producto guardado con éxito');
});

productReset.addEventListener('click', () => {
  productForm.reset();
  document.getElementById('productId').value = '';
});

async function loadAdminProducts() {
  const products = await api('/admin/products');
  adminProducts.innerHTML = products
    .map(
      (product) => `
      <article class="admin-card">
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <p class="badge">Precio: ${formatCurrency(product.price)}</p>
        <p class="badge">Stock: ${product.stock}</p>
        <div class="buttons-row">
          <button onclick="editProduct(${product.id}, '${escapeHtml(product.name)}', '${escapeHtml(product.description)}', ${product.price}, ${product.stock}, '${product.image}')">Editar</button>
          <button class="secondary" onclick="deleteProduct(${product.id})">Eliminar</button>
        </div>
      </article>`
    )
    .join('');
}

window.editProduct = (id, name, description, price, stock, image) => {
  document.getElementById('productId').value = id;
  document.getElementById('productName').value = name;
  document.getElementById('productDescription').value = description;
  document.getElementById('productPrice').value = price;
  document.getElementById('productStock').value = stock;
  document.getElementById('productImage').value = image;
};

window.deleteProduct = async (id) => {
  const response = await api(`/admin/products/${id}`, { method: 'DELETE' });
  if (response.error) return showMessage(document.getElementById('adminMessage'), response.error);
  loadAdminProducts();
  loadProducts();
};

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

setActiveTab('products');
refreshUser();
