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

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

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

// 查詢所有 work_sessions（可選條件：todo_id, date 區間, 進行中）
app.get('/api/sessions', (req, res) => {
  const { todo_id, from, to, active } = req.query;
  let sql = 'SELECT * FROM work_sessions WHERE 1=1';
  const params = [];
  if (todo_id) {
    sql += ' AND todo_id = ?';
    params.push(todo_id);
  }
  if (from) {
    sql += ' AND start_time >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND start_time <= ?';
    params.push(to);
  }
  if (active === 'true') {
    sql += ' AND end_time IS NULL';
  }
  sql += ' ORDER BY start_time ASC';
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 刪除某 work_session
app.delete('/api/sessions/:session_id', (req, res) => {
  const { session_id } = req.params;
  db.run('DELETE FROM work_sessions WHERE id = ?', [session_id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// 編輯某 work_session（可修正 start_time, end_time）
app.put('/api/sessions/:session_id', (req, res) => {
  const { session_id } = req.params;
  const { start_time, end_time } = req.body;
  db.run(
    'UPDATE work_sessions SET start_time = ?, end_time = ? WHERE id = ?',
    [start_time, end_time, session_id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM work_sessions WHERE id = ?', [session_id], (err, session) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(session);
      });
    }
  );
});

// 結算本日工時
app.get('/api/summary/today', (req, res) => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  // 查詢今日所有 work_sessions，並 join todos
  db.all(
    `SELECT ws.*, t.project_code, t.task_type, t.item_no, t.description
     FROM work_sessions ws
     JOIN todos t ON ws.todo_id = t.id
     WHERE date(ws.start_time) = ?`,
    [dateStr],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      // 依 todo_id 分組
      const summaryMap = {};
      rows.forEach(row => {
        if (!summaryMap[row.todo_id]) {
          summaryMap[row.todo_id] = {
            project_code: row.project_code,
            task_type: row.task_type,
            item_no: row.item_no,
            date: dateStr,
            description: row.description,
            hour_spent: 0
          };
        }
        if (row.start_time && row.end_time) {
          const start = new Date(row.start_time);
          const end = new Date(row.end_time);
          let diffMs = end - start;
          if (diffMs > 0) {
            let hours = diffMs / (1000 * 60 * 60);
            // 以 0.5 小時為單位，無條件進位
            hours = Math.ceil(hours * 2) / 2;
            summaryMap[row.todo_id].hour_spent += hours;
          }
        }
      });
      // 只輸出有工時的卡片
      const result = Object.values(summaryMap).filter(item => item.hour_spent > 0);
      res.json(result);
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});