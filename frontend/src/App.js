import React, { useEffect, useState, useRef } from 'react';
import logo from './logo.svg';
import './App.css';
import { DndContext, closestCenter, useDroppable } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDraggable } from '@dnd-kit/core';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

const STATUS = [
  { key: 'pending', label: '未完成' },
  { key: 'in_progress', label: '進行中' },
  { key: 'done', label: '已完成' },
  { key: 'archive', label: 'Archive' },
];
const DELETE_KEY = 'delete';
const EDIT_KEY = 'edit';

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
  const [projectCodes, setProjectCodes] = useState([]);
  const [taskTypes, setTaskTypes] = useState([]);
  const [showProjectCodeMgr, setShowProjectCodeMgr] = useState(false);
  const [showTaskTypeMgr, setShowTaskTypeMgr] = useState(false);
  const [newProjectCode, setNewProjectCode] = useState('');
  const [newTaskType, setNewTaskType] = useState('');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarLogs, setCalendarLogs] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [editTodo, setEditTodo] = useState(null); // { ...todo } or null
  const [editDesc, setEditDesc] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newCardStatus, setNewCardStatus] = useState('pending');

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

  // 取得選單資料
  useEffect(() => {
    fetch('/api/project_codes').then(r => r.json()).then(setProjectCodes);
    fetch('/api/task_types').then(r => r.json()).then(setTaskTypes);
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
    if (newStatus.startsWith(DELETE_KEY)) {
      await handleDelete(todoId);
      return;
    }
    if (newStatus.startsWith(EDIT_KEY)) {
      const todo = todos.find(t => t.id === todoId);
      if (todo) {
        setEditTodo(todo);
        setEditDesc(todo.description);
      }
      return;
    }
    if (newStatus.startsWith('new_')) {
      const statusKey = newStatus.replace('new_', '');
      setNewCardStatus(statusKey);
      setShowNewModal(true);
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

  // 新增專案代碼
  const handleAddProjectCode = async () => {
    if (!newProjectCode.trim()) return;
    await fetch('/api/project_codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: newProjectCode.trim() })
    });
    setNewProjectCode('');
    fetch('/api/project_codes').then(r => r.json()).then(setProjectCodes);
  };
  // 刪除專案代碼
  const handleDeleteProjectCode = async (code) => {
    await fetch(`/api/project_codes/${encodeURIComponent(code)}`, { method: 'DELETE' });
    fetch('/api/project_codes').then(r => r.json()).then(setProjectCodes);
  };
  // 新增任務類型
  const handleAddTaskType = async () => {
    if (!newTaskType.trim()) return;
    await fetch('/api/task_types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: newTaskType.trim() })
    });
    setNewTaskType('');
    fetch('/api/task_types').then(r => r.json()).then(setTaskTypes);
  };
  // 刪除任務類型
  const handleDeleteTaskType = async (type) => {
    await fetch(`/api/task_types/${encodeURIComponent(type)}`, { method: 'DELETE' });
    fetch('/api/task_types').then(r => r.json()).then(setTaskTypes);
  };

  // 取得特定日期的 worklog
  const fetchWorklogByDate = async (date) => {
    setCalendarLoading(true);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    try {
      const res = await fetch(`/api/summary/today?date=${dateStr}`);
      const data = await res.json();
      setCalendarLogs(data);
    } catch (e) {
      setCalendarLogs([]);
    }
    setCalendarLoading(false);
  };

  // 日曆日期變更時觸發
  useEffect(() => {
    fetchWorklogByDate(calendarDate);
  }, [calendarDate]);

  // 編輯彈窗的更新
  const handleEditSave = async () => {
    if (editTodo) {
      await fetch(`/api/todos/${editTodo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_code: editTodo.project_code,
          task_type: editTodo.task_type,
          description: editDesc,
          status: editTodo.status
        })
      });
      setEditTodo(null);
      fetchTodos();
    }
  };

  return (
    <div className="App">
      <h1>工作待辦清單</h1>
      {/* 日曆 UI */}
      <div style={{ margin: '32px 0 16px 0', display: 'flex', gap: 32, alignItems: 'flex-start' }}>
        <div>
          <Calendar
            onChange={setCalendarDate}
            value={calendarDate}
            locale="zh-TW"
          />
        </div>
        <div style={{ flex: 1, minWidth: 320 }}>
          <h3 style={{ margin: 0 }}> {calendarDate.toLocaleDateString()} 的工時紀錄</h3>
          {calendarLoading ? (
            <div>載入中...</div>
          ) : calendarLogs.length === 0 ? (
            <div style={{ color: '#aaa' }}>無資料</div>
          ) : (
            <>
              <div 
                style={{ 
                  padding: '8px', 
                  marginBottom: '8px', 
                  backgroundColor: calendarLogs.reduce((sum, log) => sum + (log.hour_spent || 0), 0) >= 8 ? '#d4edda' : '#f8d7da',
                  color: calendarLogs.reduce((sum, log) => sum + (log.hour_spent || 0), 0) >= 8 ? '#155724' : '#721c24',
                  borderRadius: '4px',
                  fontWeight: 'bold'
                }}
              >
                總工時：{calendarLogs.reduce((sum, log) => sum + (log.hour_spent || 0), 0)} 小時
              </div>
              <ul style={{ padding: 0, margin: 0 }}>
                {calendarLogs.map((log, idx) => (
                  <li key={idx} style={{ borderBottom: '1px solid #eee', marginBottom: 8, paddingBottom: 8 }}>
                    <div><b>{log.project_code}</b> [{log.task_type}],工時: {log.hour_spent} 小時, 描述: {log.description}  </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
      {/* 管理按鈕列 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <button onClick={() => setShowProjectCodeMgr(true)}>專案代碼管理</button>
        <button onClick={() => setShowTaskTypeMgr(true)}>任務類型管理</button>
        <button onClick={handleSummary} disabled={summaryLoading}>
          {summaryLoading ? '結算中...' : '結算本日工時'}
        </button>
      </div>
      {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
      {loading ? (
        <div>載入中...</div>
      ) : (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          {/* 狀態佇列 */}
          <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
            {STATUS.map(s => (
              <div key={s.key} style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  <NewCardButton 
                    statusKey={s.key} 
                    onClick={() => {
                      setNewCardStatus(s.key);
                      setShowNewModal(true);
                    }} 
                  />
                  <DroppableEditColumn id={EDIT_KEY + '_' + s.key} label="Edit" statusKey={s.key} onEditDrop={todo => { setEditTodo(todo); setEditDesc(todo.description); }} />
                  <DroppableDeleteColumn id={DELETE_KEY + '_' + s.key} label="Delete" />
                </div>
                <DroppableColumn id={s.key} label={s.label}>
                  <SortableContext items={todos.filter(t => t.status === s.key).map(t => t.id)} strategy={verticalListSortingStrategy}>
                    {todos.filter(t => t.status === s.key).length === 0 && (
                      <div style={{ color: '#aaa', textAlign: 'center', marginTop: 32 }}>無資料</div>
                    )}
                    {todos.filter(t => t.status === s.key).map(todo => (
                      <DraggableTodo key={todo.id} todo={todo} onUpdate={async (newTodo) => {
                        await fetch(`/api/todos/${todo.id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            project_code: newTodo.project_code,
                            task_type: newTodo.task_type,
                            description: newTodo.description,
                            status: newTodo.status
                          })
                        });
                        fetchTodos();
                      }} />
                    ))}
                  </SortableContext>
                </DroppableColumn>
              </div>
            ))}
          </div>
        </DndContext>
      )}
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
            {/* 新增總工時顯示 */}
            {(() => {
              let summaryData;
              try {
                summaryData = JSON.parse(summaryJson);
              } catch {
                summaryData = null;
              }
              // summaryData 可能是陣列或物件
              let logs = Array.isArray(summaryData) ? summaryData : (summaryData && summaryData.logs ? summaryData.logs : []);
              if (logs && logs.length > 0) {
                const total = logs.reduce((sum, log) => sum + (log.hour_spent || 0), 0);
                const bgColor = total >= 8 ? '#d4edda' : '#f8d7da';
                const color = total >= 8 ? '#155724' : '#721c24';
                return (
                  <div style={{
                    padding: '8px',
                    marginBottom: '8px',
                    backgroundColor: bgColor,
                    color: color,
                    borderRadius: '4px',
                    fontWeight: 'bold'
                  }}>
                    總工時：{total} 小時
                  </div>
                );
              }
              return null;
            })()}
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
      {/* 專案代碼管理視窗 */}
      {showProjectCodeMgr && (
        <div style={{ position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.3)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowProjectCodeMgr(false)}>
          <div style={{ background: 'white', padding: 24, borderRadius: 8, minWidth: 320, maxWidth: 400, boxShadow: '0 2px 16px #0002', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <b>專案代碼管理</b>
              <button onClick={() => setShowProjectCodeMgr(false)}>關閉</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input value={newProjectCode} onChange={e => setNewProjectCode(e.target.value)} placeholder="新增專案代碼" style={{ flex: 1 }} />
              <button onClick={handleAddProjectCode}>新增</button>
            </div>
            <ul style={{ maxHeight: 200, overflowY: 'auto', padding: 0, margin: 0 }}>
              {projectCodes.map(code => (
                <li key={code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #eee', padding: '4px 0' }}>
                  <span>{code}</span>
                  <button style={{ color: 'white', background: '#e74c3c', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 12, cursor: 'pointer' }} onClick={() => handleDeleteProjectCode(code)}>刪除</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {/* 任務類型管理視窗 */}
      {showTaskTypeMgr && (
        <div style={{ position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.3)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowTaskTypeMgr(false)}>
          <div style={{ background: 'white', padding: 24, borderRadius: 8, minWidth: 320, maxWidth: 400, boxShadow: '0 2px 16px #0002', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <b>任務類型管理</b>
              <button onClick={() => setShowTaskTypeMgr(false)}>關閉</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input value={newTaskType} onChange={e => setNewTaskType(e.target.value)} placeholder="新增任務類型" style={{ flex: 1 }} />
              <button onClick={handleAddTaskType}>新增</button>
            </div>
            <ul style={{ maxHeight: 200, overflowY: 'auto', padding: 0, margin: 0 }}>
              {taskTypes.map(type => (
                <li key={type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #eee', padding: '4px 0' }}>
                  <span>{type}</span>
                  <button style={{ color: 'white', background: '#e74c3c', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 12, cursor: 'pointer' }} onClick={() => handleDeleteTaskType(type)}>刪除</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {/* 編輯彈窗 */}
      {editTodo && (
        <div style={{ position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.3)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setEditTodo(null)}>
          <div style={{ background: 'white', padding: 24, borderRadius: 8, minWidth: 320, maxWidth: 400, boxShadow: '0 2px 16px #0002', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <b>編輯卡片描述</b>
              <button onClick={() => setEditTodo(null)}>關閉</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{editTodo.project_code} [{editTodo.task_type}]</div>
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} style={{ width: '100%', minHeight: 80, fontSize: 15, border: '1px solid #ccc', borderRadius: 4, padding: 8 }} />
            </div>
            <div style={{ textAlign: 'right' }}>
              <button onClick={handleEditSave}>儲存</button>
            </div>
          </div>
        </div>
      )}
      {/* 新增卡片彈窗 */}
      {showNewModal && (
        <div style={{ position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.3)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowNewModal(false)}>
          <div style={{ background: 'white', padding: 24, borderRadius: 8, minWidth: 320, maxWidth: 400, boxShadow: '0 2px 16px #0002', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <b>新增卡片</b>
              <button onClick={() => setShowNewModal(false)}>關閉</button>
            </div>
            <form onSubmit={async e => {
              e.preventDefault();
              if (!form.project_code || !form.task_type) return;
              await fetch('/api/todos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, status: newCardStatus })
              });
              setForm({ project_code: '', task_type: '', description: '' });
              setShowNewModal(false);
              fetchTodos();
            }}>
              <div style={{ marginBottom: 8 }}>
                <select
                  value={form.project_code}
                  onChange={e => setForm(f => ({ ...f, project_code: e.target.value }))}
                  required
                  style={{ width: '100%' }}
                >
                  <option value="">選擇專案代碼</option>
                  {projectCodes.map(code => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 8 }}>
                <select
                  value={form.task_type}
                  onChange={e => setForm(f => ({ ...f, task_type: e.target.value }))}
                  required
                  style={{ width: '100%' }}
                >
                  <option value="">選擇任務類型</option>
                  {taskTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 8 }}>
                <textarea
                  placeholder="描述"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  style={{ width: '100%', minHeight: 80, fontSize: 15, border: '1px solid #ccc', borderRadius: 4, padding: 8 }}
                />
              </div>
              <div style={{ textAlign: 'right' }}>
                <button type="submit">新增</button>
              </div>
            </form>
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
        border: '2px dashed #c0392b',
        borderRadius: 8,
        padding: 8,
        minHeight: 36,
        background: isOver ? '#ff7675' : '#fbeaea',
        color: '#c0392b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: 16,
        marginBottom: 4,
        transition: 'background 0.2s',
      }}
    >
      🗑️ {label}
    </div>
  );
}

// 新增 Edit 佇列元件
function DroppableEditColumn({ id, label }) {
  const { setNodeRef, isOver, active } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        border: '2px dashed #2980b9',
        borderRadius: 8,
        padding: 8,
        minHeight: 36,
        background: isOver ? '#d6eaff' : '#ecf6fb',
        color: '#2980b9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: 16,
        marginBottom: 4,
        transition: 'background 0.2s',
      }}
    >
      ✏️ {label}
    </div>
  );
}

// 新增卡片按鈕元件
function NewCardButton({ statusKey, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: '2px dashed #27ae60',
        borderRadius: 8,
        padding: 8,
        minHeight: 36,
        background: '#eafbf0',
        color: '#27ae60',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: 16,
        marginBottom: 4,
        cursor: 'pointer',
        width: '100%',
      }}
    >
      ➕ New
    </button>
  );
}

// 單一卡片的拖曳元件
function DraggableTodo({ todo }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: todo.id });

  // 將文字中的 URL 轉換為超連結
  const renderTextWithLinks = (text) => {
    // URL 正則表達式
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    if (!text) return text;
    
    const parts = text.split(urlRegex);
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()} // 防止點擊連結時觸發拖曳
            style={{ color: '#2980b9', textDecoration: 'underline' }}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

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
      <div style={{ display: 'flex', alignItems: 'center', fontWeight: 'bold', fontSize: 15 }}>
        {todo.project_code} <span style={{ fontWeight: 'normal', color: '#888', marginLeft: 4 }}>[{todo.task_type}]</span>
      </div>
      <div style={{ fontSize: 13, color: '#444', margin: '4px 0' }}>
        {renderTextWithLinks(todo.description)}
      </div>
    </div>
  );
}

export default App;
