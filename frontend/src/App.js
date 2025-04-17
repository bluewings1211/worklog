import React, { useEffect, useState, useRef } from 'react';
import logo from './logo.svg';
import './App.css';
import { DndContext, closestCenter, useDroppable } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDraggable } from '@dnd-kit/core';

const STATUS = [
  { key: 'pending', label: '未完成' },
  { key: 'in_progress', label: '進行中' },
  { key: 'done', label: '已完成' },
  { key: 'archive', label: 'Archive' },
];
const DELETE_KEY = 'delete';

function App() {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ project_code: '', task_type: '', description: '' });
  const [error, setError] = useState('');
  const [draggingTodo, setDraggingTodo] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryJson, setSummaryJson] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const summaryRef = useRef();

  // 取得所有待辦事項
  const fetchTodos = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/todos');
      const data = await res.json();
      setTodos(data);
    } catch (e) {
      setError('載入失敗');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTodos();
  }, []);

  // 新增待辦事項
  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.project_code || !form.task_type) {
      setError('請填寫專案代碼與任務類型');
      return;
    }
    try {
      await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, status: 'pending' }),
      });
      setForm({ project_code: '', task_type: '', description: '' });
      fetchTodos();
    } catch (e) {
      setError('新增失敗');
    }
  };

  // 刪除功能：樂觀更新，先移除再呼叫後端
  const handleDelete = async (id) => {
    // 先從畫面移除
    setTodos(todos => todos.filter(t => t.id !== id));
    try {
      const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setError('刪除失敗');
        // 若失敗可選擇重新 fetch 或還原（此處簡單顯示錯誤）
      }
    } catch (e) {
      setError('刪除失敗');
    }
  };

  // 拖曳結束時，更新卡片狀態或刪除
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || !active) return;
    const todoId = active.id;
    const newStatus = over.id;
    if (newStatus === DELETE_KEY) {
      // 拖曳到 Delete 佇列即刪除
      await handleDelete(todoId);
      return;
    }
    if (!STATUS.some(s => s.key === newStatus)) return;
    const todo = todos.find(t => t.id === todoId);
    if (todo && todo.status !== newStatus) {
      await fetch(`/api/todos/${todoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_code: todo.project_code,
          task_type: todo.task_type,
          description: todo.description,
          status: newStatus
        })
      });
      fetchTodos();
    }
  };

  // 工時結算功能
  const handleSummary = async () => {
    setSummaryLoading(true);
    try {
      const res = await fetch('/api/summary/today');
      const data = await res.json();
      const jsonStr = JSON.stringify(data, null, 2);
      setSummaryJson(jsonStr);
      setShowSummary(true);
      // 複製到剪貼簿
      await navigator.clipboard.writeText(jsonStr);
    } catch (e) {
      setError('工時結算失敗');
    }
    setSummaryLoading(false);
  };

  // 複製當前 summaryJson
  const handleCopySummary = async () => {
    if (summaryJson) {
      await navigator.clipboard.writeText(summaryJson);
    }
  };

  return (
    <div className="App">
      <h1>工作待辦清單</h1>
      <form onSubmit={handleAdd} style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          placeholder="專案代碼"
          value={form.project_code}
          onChange={e => setForm(f => ({ ...f, project_code: e.target.value }))}
          required
          style={{ width: 120 }}
        />
        <select
          value={form.task_type}
          onChange={e => setForm(f => ({ ...f, task_type: e.target.value }))}
          required
          style={{ width: 180 }}
        >
          <option value="">選擇任務類型</option>
          <option>Implement</option>
          <option>Meeting</option>
          <option>Test</option>
          <option>Survey</option>
          <option>Bug Fix</option>
          <option>Support</option>
          <option>Trouble Shooting</option>
          <option>Take Leave</option>
          <option>Document</option>
          <option>Operation</option>
          <option>Design</option>
          <option>Misc</option>
          <option>Training</option>
          <option>Project Management</option>
          <option>Manager Task</option>
          <option>POC</option>
        </select>
        <input
          placeholder="描述"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          style={{ width: 220 }}
        />
        <button type="submit">新增</button>
      </form>
      {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
      {loading ? (
        <div>載入中...</div>
      ) : (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          {/* 狀態佇列 */}
          <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
            {STATUS.map(s => (
              <DroppableColumn key={s.key} id={s.key} label={s.label}>
                <SortableContext items={todos.filter(t => t.status === s.key).map(t => t.id)} strategy={verticalListSortingStrategy}>
                  {todos.filter(t => t.status === s.key).length === 0 && (
                    <div style={{ color: '#aaa', textAlign: 'center', marginTop: 32 }}>無資料</div>
                  )}
                  {todos.filter(t => t.status === s.key).map(todo => (
                    <DraggableTodo key={todo.id} todo={todo} />
                  ))}
                </SortableContext>
              </DroppableColumn>
            ))}
          </div>
          {/* Delete 佇列獨立一列，置中顯示 */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
            <DroppableDeleteColumn id={DELETE_KEY} label="Delete" />
          </div>
        </DndContext>
      )}
      <div style={{ margin: '24px 0' }}>
        <button onClick={handleSummary} disabled={summaryLoading}>
          {summaryLoading ? '結算中...' : '結算本日工時'}
        </button>
      </div>
      {showSummary && (
        <div style={{
          position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.3)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
          onClick={() => setShowSummary(false)}
        >
          <div
            style={{ background: 'white', padding: 24, borderRadius: 8, minWidth: 400, minHeight: 300, maxWidth: 600, boxShadow: '0 2px 16px #0002', position: 'relative' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <b>本日工時 JSON</b>
              <button onClick={handleCopySummary} title="複製到剪貼簿" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>
                📋
              </button>
            </div>
            <textarea
              ref={summaryRef}
              value={summaryJson}
              onChange={e => setSummaryJson(e.target.value)}
              style={{ width: '100%', height: 240, fontFamily: 'monospace', fontSize: 15, border: '1px solid #ccc', borderRadius: 4, padding: 8 }}
            />
            <div style={{ textAlign: 'right', marginTop: 8 }}>
              <button onClick={() => setShowSummary(false)}>關閉</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Droppable 狀態欄元件
function DroppableColumn({ id, label, children }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        flex: 1,
        border: '1px solid #ccc',
        borderRadius: 8,
        padding: 8,
        minHeight: 200,
        background: isOver ? '#f0f8ff' : undefined
      }}
    >
      <h3 style={{ textAlign: 'center', color: '#555' }}>{label}</h3>
      {children}
    </div>
  );
}

// Delete 佇列元件
function DroppableDeleteColumn({ id, label }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        flex: 0.7,
        border: '2px solid #c0392b',
        borderRadius: 8,
        padding: 8,
        minHeight: 200,
        background: isOver ? '#ff7675' : '#e74c3c',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: 20,
        transition: 'background 0.2s',
      }}
    >
      {label}
    </div>
  );
}

// 單一卡片的拖曳元件
function DraggableTodo({ todo }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: todo.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        border: '1px solid #eee',
        margin: 4,
        padding: 8,
        borderRadius: 4,
        background: isDragging ? '#e0f7fa' : '#fafbfc',
        opacity: isDragging ? 0.7 : 1,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        cursor: 'grab',
      }}
    >
      <div style={{ fontWeight: 'bold', fontSize: 15 }}>{todo.project_code} <span style={{ fontWeight: 'normal', color: '#888' }}>[{todo.task_type}]</span></div>
      <div style={{ fontSize: 13, color: '#444', margin: '4px 0' }}>{todo.description}</div>
    </div>
  );
}

export default App;
