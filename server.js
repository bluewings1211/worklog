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
    db.run(`CREATE TABLE IF NOT EXISTS project_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS task_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL UNIQUE
    )`);
    // 預設資料（如無資料時）
    db.get('SELECT COUNT(*) as cnt FROM project_codes', (err, row) => {
      if (row && row.cnt === 0) {
        ['SuperCloud Composer', 'ProjectX', 'DemoProject'].forEach(code => {
          db.run('INSERT INTO project_codes (code) VALUES (?)', [code]);
        });
      }
    });
    db.get('SELECT COUNT(*) as cnt FROM task_types', (err, row) => {
      if (row && row.cnt === 0) {
        [
          'Implement','Meeting','Test','Survey','Bug Fix','Support','Trouble Shooting','Take Leave','Document','Operation','Design','Misc','Training','Project Management','Manager Task','POC'
        ].forEach(type => {
          db.run('INSERT INTO task_types (type) VALUES (?)', [type]);
        });
      }
    });
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
  // 先查詢原本狀態
  db.get('SELECT * FROM todos WHERE id = ?', [id], (err, oldTodo) => {
    if (err || !oldTodo) return res.status(404).json({ error: 'Todo not found' });
    db.run(
      'UPDATE todos SET project_code=?, task_type=?, description=?, status=? WHERE id=?',
      [project_code, task_type, description, status, id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        // 狀態切換邏輯
        if (oldTodo.status !== status) {
          const now = new Date().toISOString();
          if (status === 'in_progress' && oldTodo.status !== 'in_progress') {
            // 進入 in_progress，新增一筆 start_time
            console.log(`[work_sessions] 新增 start_time: todo_id=${id}, time=${now}`);
            db.run(
              'INSERT INTO work_sessions (todo_id, start_time) VALUES (?, ?)',
              [id, now]
            );
          } else if (oldTodo.status === 'in_progress' && status !== 'in_progress') {
            // 離開 in_progress，補上 end_time
            db.get(
              'SELECT * FROM work_sessions WHERE todo_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1',
              [id],
              (err, session) => {
                if (session) {
                  console.log(`[work_sessions] 補上 end_time: session_id=${session.id}, time=${now}`);
                  db.run(
                    'UPDATE work_sessions SET end_time = ? WHERE id = ?',
                    [now, session.id]
                  );
                } else {
                  console.log(`[work_sessions] 找不到未結束的 session 來補 end_time, todo_id=${id}`);
                }
              }
            );
          }
        }
        db.get('SELECT * FROM todos WHERE id = ?', [id], (err, todo) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json(todo);
        });
      }
    );
  });
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

// 取得所有 project_codes
app.get('/api/project_codes', (req, res) => {
  db.all('SELECT code FROM project_codes ORDER BY code ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => r.code));
  });
});

// 新增專案代碼
app.post('/api/project_codes', (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'code is required' });
  db.run('INSERT INTO project_codes (code) VALUES (?)', [code], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// 刪除專案代碼
app.delete('/api/project_codes/:code', (req, res) => {
  const { code } = req.params;
  db.run('DELETE FROM project_codes WHERE code = ?', [code], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// 取得所有 task_types
app.get('/api/task_types', (req, res) => {
  db.all('SELECT type FROM task_types ORDER BY type ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => r.type));
  });
});

// 新增任務類型
app.post('/api/task_types', (req, res) => {
  const { type } = req.body;
  if (!type) return res.status(400).json({ error: 'type is required' });
  db.run('INSERT INTO task_types (type) VALUES (?)', [type], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// 刪除任務類型
app.delete('/api/task_types/:type', (req, res) => {
  const { type } = req.params;
  db.run('DELETE FROM task_types WHERE type = ?', [type], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// 結算本日工時（可指定日期）
app.get('/api/summary/today', (req, res) => {
  let dateStr;
  if (req.query.date) {
    dateStr = req.query.date;
  } else {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateStr = `${yyyy}-${mm}-${dd}`;
  }
  // 查詢指定日期所有 work_sessions，並 join todos
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

// 靜態檔案服務（React build）與 SPA fallback，必須放在所有 API 路由之後
app.use(express.static(path.join(__dirname, 'frontend', 'build')));
app.get('/{*any}', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API not found' });
  }
  res.sendFile(path.join(__dirname, 'frontend', 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});