const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// SQLite DB 檔案路徑，可用於 Docker volume 掛載
const DB_PATH = path.join(__dirname, 'data', 'worklog.db');
const fs = require('fs');
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}
const db = new sqlite3.Database(DB_PATH);

// 初始化資料表
function initDb() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_code TEXT NOT NULL,
      task_type TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      item_no INTEGER UNIQUE NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS work_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      todo_id INTEGER NOT NULL,
      start_time TEXT,
      end_time TEXT,
      FOREIGN KEY(todo_id) REFERENCES todos(id)
    )`);
  });
}

initDb();

app.use(cors());
app.use(express.json());

// 取得所有待辦事項
app.get('/api/todos', (req, res) => {
  db.all('SELECT * FROM todos ORDER BY item_no ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 新增待辦事項
app.post('/api/todos', (req, res) => {
  const { project_code, task_type, description, status } = req.body;
  if (!project_code || !task_type || !status) {
    return res.status(400).json({ error: 'project_code, task_type, status are required' });
  }
  db.get('SELECT MAX(item_no) as maxNo FROM todos', [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    const nextNo = (row?.maxNo || 0) + 1;
    const todoStatus = status || 'pending';
    db.run(
      'INSERT INTO todos (project_code, task_type, description, status, item_no) VALUES (?, ?, ?, ?, ?)',
      [project_code, task_type, description || '', todoStatus, nextNo],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        db.get('SELECT * FROM todos WHERE id = ?', [this.lastID], (err, todo) => {
          if (err) return res.status(500).json({ error: err.message });
          res.status(201).json(todo);
        });
      }
    );
  });
});

// 更新待辦事項
app.put('/api/todos/:id', (req, res) => {
  const { project_code, task_type, description, status } = req.body;
  const { id } = req.params;
  db.run(
    'UPDATE todos SET project_code=?, task_type=?, description=?, status=? WHERE id=?',
    [project_code, task_type, description, status, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM todos WHERE id = ?', [id], (err, todo) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(todo);
      });
    }
  );
});

// 刪除待辦事項
app.delete('/api/todos/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM todos WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});