const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcryptjs');
const { db, initDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(
  session({
    secret: 'baskev-shop-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
  })
);

initDatabase();

function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.status(401).json({ error: 'No autorizado' });
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  res.status(403).json({ error: 'Acceso denegado' });
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Debe enviar usuario y contraseña' });
  }

  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
    if (err) return res.status(500).json({ error: 'Error de servidor' });
    if (!user) return res.status(400).json({ error: 'Usuario o contraseña incorrectos' });

    const matches = bcrypt.compareSync(password, user.password);
    if (!matches) return res.status(400).json({ error: 'Usuario o contraseña incorrectos' });

    req.session.user = { id: user.id, username: user.username, role: user.role };
    res.json({ username: user.username, role: user.role });
  });
});

app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Debe enviar usuario y contraseña' });
  }

  const hash = bcrypt.hashSync(password, 10);
  db.run(
    `INSERT INTO users (username, password, role) VALUES (?, ?, 'user')`,
    [username, hash],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'El nombre de usuario ya existe' });
        }
        return res.status(500).json({ error: 'Error al registrar usuario' });
      }
      req.session.user = { id: this.lastID, username, role: 'user' };
      res.json({ username, role: 'user' });
    }
  );
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get('/api/me', (req, res) => {
  if (req.session && req.session.user) {
    return res.json(req.session.user);
  }
  res.json(null);
});

app.get('/api/products', (req, res) => {
  db.all(`SELECT * FROM products`, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error al cargar productos' });
    res.json(rows);
  });
});

app.post('/api/cart/add', (req, res) => {
  const { productId, quantity } = req.body;
  const qty = Number(quantity) || 1;
  if (!req.session.cart) {
    req.session.cart = [];
  }

  db.get(`SELECT * FROM products WHERE id = ?`, [productId], (err, product) => {
    if (err || !product) return res.status(400).json({ error: 'Producto no encontrado' });
    const existing = req.session.cart.find((item) => item.id === product.id);
    if (existing) {
      existing.quantity += qty;
    } else {
      req.session.cart.push({ id: product.id, name: product.name, price: product.price, quantity: qty });
    }
    res.json({ cart: req.session.cart });
  });
});

app.get('/api/cart', (req, res) => {
  res.json(req.session.cart || []);
});

app.post('/api/cart/remove', (req, res) => {
  const { productId } = req.body;
  if (!req.session.cart) {
    return res.json([]);
  }
  req.session.cart = req.session.cart.filter((item) => item.id !== productId);
  res.json(req.session.cart);
});

app.post('/api/cart/checkout', requireAuth, (req, res) => {
  const cart = req.session.cart || [];
  if (!cart.length) {
    return res.status(400).json({ error: 'El carrito está vacío' });
  }

  const productIds = cart.map((item) => item.id);
  const placeholders = productIds.map(() => '?').join(',');

  db.all(`SELECT id, stock FROM products WHERE id IN (${placeholders})`, productIds, (err, products) => {
    if (err) return res.status(500).json({ error: 'Error al verificar el stock' });

    const stockMap = new Map(products.map((product) => [product.id, product.stock]));
    for (const item of cart) {
      if (!stockMap.has(item.id) || stockMap.get(item.id) < item.quantity) {
        return res.status(400).json({ error: `Stock insuficiente para ${item.name}` });
      }
    }

    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const createdAt = new Date().toISOString();

    db.run(
      `INSERT INTO orders (user_id, total, created_at) VALUES (?, ?, ?)`,
      [req.session.user.id, total, createdAt],
      function (err) {
        if (err) return res.status(500).json({ error: 'Error al crear el pedido' });

        const orderId = this.lastID;
        const itemStmt = db.prepare(`INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)`);
        const stockStmt = db.prepare(`UPDATE products SET stock = stock - ? WHERE id = ?`);

        db.serialize(() => {
          cart.forEach((item) => {
            itemStmt.run(orderId, item.id, item.quantity, item.price);
            stockStmt.run(item.quantity, item.id);
          });
          itemStmt.finalize();
          stockStmt.finalize();
          req.session.cart = [];
          res.json({ success: true });
        });
      }
    );
  });
});

app.get('/api/orders', requireAuth, (req, res) => {
  db.all(
    `SELECT o.id AS orderId, o.total, o.created_at, oi.quantity, oi.price, p.name
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC, oi.id ASC`,
    [req.session.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Error al cargar pedidos' });

      const orders = [];
      const map = new Map();
      rows.forEach((row) => {
        if (!map.has(row.orderId)) {
          map.set(row.orderId, {
            id: row.orderId,
            total: row.total,
            createdAt: row.created_at,
            items: []
          });
          orders.push(map.get(row.orderId));
        }
        map.get(row.orderId).items.push({
          name: row.name,
          quantity: row.quantity,
          price: row.price
        });
      });
      res.json(orders);
    }
  );
});

app.get('/api/admin/products', requireAdmin, (req, res) => {
  db.all(`SELECT * FROM products`, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error al cargar inventario' });
    res.json(rows);
  });
});

app.post('/api/admin/products', requireAdmin, (req, res) => {
  const { name, description, price, stock, image } = req.body;
  if (!name || !price || stock == null) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }
  db.run(
    `INSERT INTO products (name, description, price, stock, image) VALUES (?, ?, ?, ?, ?)`,
    [name, description || '', Number(price), Number(stock), image || 'https://via.placeholder.com/250x180?text=BasKev'],
    function (err) {
      if (err) return res.status(500).json({ error: 'Error guardando producto' });
      res.json({ id: this.lastID, name, description, price: Number(price), stock: Number(stock), image: image || 'https://via.placeholder.com/250x180?text=BasKev' });
    }
  );
});

app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  const productId = Number(req.params.id);
  const { name, description, price, stock, image } = req.body;
  db.run(
    `UPDATE products SET name = ?, description = ?, price = ?, stock = ?, image = ? WHERE id = ?`,
    [name, description || '', Number(price), Number(stock), image || 'https://via.placeholder.com/250x180?text=BasKev', productId],
    function (err) {
      if (err) return res.status(500).json({ error: 'Error actualizando producto' });
      if (this.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
      res.json({ success: true });
    }
  );
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  const productId = Number(req.params.id);
  db.run(`DELETE FROM products WHERE id = ?`, [productId], function (err) {
    if (err) return res.status(500).json({ error: 'Error eliminando producto' });
    if (this.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ success: true });
  });
});

app.listen(PORT, () => {
  console.log(`BasKev Shop corriendo en http://localhost:${PORT}`);
});
