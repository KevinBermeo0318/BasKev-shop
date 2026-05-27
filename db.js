const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'data.db');
const db = new sqlite3.Database(dbPath);

function initDatabase() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user'
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        stock INTEGER NOT NULL,
        image TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        total REAL NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        FOREIGN KEY(order_id) REFERENCES orders(id),
        FOREIGN KEY(product_id) REFERENCES products(id)
      )
    `);

    db.get(`SELECT COUNT(*) AS count FROM users`, (err, row) => {
      if (err) {
        console.error('Error comprobando usuarios', err);
        return;
      }
      if (row.count === 0) {
        const bcrypt = require('bcryptjs');
        const passwordHash = bcrypt.hashSync('admin123', 10);
        db.run(
          `INSERT INTO users (username, password, role) VALUES (?, ?, ?)`,
          ['admin', passwordHash, 'admin'],
          (insertErr) => {
            if (insertErr) {
              console.error('Error creando admin inicial', insertErr);
            } else {
              console.log('Usuario admin inicial creado: admin / admin123');
            }
          }
        );
      }
    });

    db.get(`SELECT COUNT(*) AS count FROM products`, (err, row) => {
      if (err) {
        console.error('Error comprobando productos', err);
        return;
      }
      if (row.count === 0) {
        const sampleProducts = [
          ['Air Dunk Pro', 'Zapatillas de basket con amortiguación y diseño urbano.', 129.99, 12, 'https://via.placeholder.com/250x180?text=Air+Dunk+Pro'],
          ['Sky Court 200', 'Soporte extra en tobillo y suela antideslizante.', 99.99, 8, 'https://via.placeholder.com/250x180?text=Sky+Court+200'],
          ['Bounce Street', 'Ligereza y comodidad para entrenar y jugar.', 89.99, 15, 'https://via.placeholder.com/250x180?text=Bounce+Street']
        ];
        const stmt = db.prepare(`INSERT INTO products (name, description, price, stock, image) VALUES (?, ?, ?, ?, ?)`);
        sampleProducts.forEach((product) => stmt.run(product));
        stmt.finalize();
      }
    });
  });
}

module.exports = { db, initDatabase };
