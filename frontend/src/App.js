import React, { useEffect, useState, useRef } from 'react';
import './App.css';
import { DndContext, closestCenter, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDraggable } from '@dnd-kit/core';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

const STATUS = [
  { key: 'pending', label: '未完成' },
  { key: 'in_progress', label: '進行中' },
  { key: 'done', label: '已完成' },
  { key: 'archive', label: 'Archive' },
];
const INITIAL_POMODORO = 40 * 60;  // 初始蕃茄鐘時長（秒）

function App() {
  const [filterRange, setFilterRange] = useState('all'); // 篩選範圍：'all', '3days', '7days', '1month'
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ project_code: '', task_type: '', description: '' });
  const [error, setError] = useState('');
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
  const [showLinksMgr, setShowLinksMgr] = useState(false);
  const [links, setLinks] = useState([]);
  const [newLink, setNewLink] = useState({ name: '', url: '', note: '' });
  const [pomodoroTime, setPomodoroTime] = useState(INITIAL_POMODORO);
  const [pomodoroRunning, setPomodoroRunning] = useState(false);
  const startRef = useRef(null);

  // 格式化時間 mm:ss
  const formatTime = (sec) => {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  // 桌面通知
  const notifyPomodoro = () => {
    if (Notification.permission === 'granted') {
      new Notification('蕃茄鐘時間到！', { body: '40分鐘倒數已結束，請休息一下。' });
      window.focus(); // 嘗試讓頁面跳到前景
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification('蕃茄鐘時間到！', { body: '40分鐘倒數已結束，請休息一下。' });
          window.focus(); // 嘗試讓頁面跳到前景
        }
      });
    }
  };

  // 蕃茄鐘倒數邏輯 (time-delta)
  useEffect(() => {
    if (pomodoroRunning) {
      startRef.current = performance.now() - (INITIAL_POMODORO - pomodoroTime) * 1000;
      const timerId = setInterval(() => {
        const elapsed = Math.floor((performance.now() - startRef.current) / 1000);
        setPomodoroTime(Math.max(0, INITIAL_POMODORO - elapsed));
      }, 250);
      return () => clearInterval(timerId);
    }
  }, [pomodoroRunning, pomodoroTime]);

  // 偵測倒數結束
  useEffect(() => {
    if (pomodoroTime === 0 && pomodoroRunning) {
      setPomodoroRunning(false);
      notifyPomodoro();
    }
  }, [pomodoroTime, pomodoroRunning]);

  // 取得所有待辦事項
  const fetchTodos = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/todos');
      const data = await res.json();
      setTodos(data.map(todo => ({
          ...todo,
          last_modified: new Date(todo.last_modified) // 確保 last_modified 是 Date 物件
        })));
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

  // 拖曳結束時，更新卡片狀態
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || !active) return;
    const todoId = active.id;
    const newStatus = over.id;
    
    // 只處理狀態切換
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

  // 取得所有常用連結
  const fetchLinks = async () => {
    try {
      const res = await fetch('/api/links');
      const data = await res.json();
      setLinks(data);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  // 新增常用連結
  const handleAddLink = async () => {
    if (!newLink.name.trim() || !newLink.url.trim()) return;
    await fetch('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLink)
    });
    setNewLink({ name: '', url: '', note: '' });
    fetchLinks();
  };
  // 刪除常用連結
  const handleDeleteLink = async (id) => {
    await fetch(`/api/links/${id}`, { method: 'DELETE' });
    fetchLinks();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-base-200 to-base-100 p-4">
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold text-center mb-6 text-base-content">工作待辦清單</h1>
      {/* 日曆 UI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-1">
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body p-4">
              <Calendar
                onChange={setCalendarDate}
                value={calendarDate}
                locale="zh-TW"
              />
            </div>
          </div>
        </div>
        <div className="lg:col-span-2">
          <div className="card bg-base-100 shadow-lg">
            <div className="card-header p-4 border-b border-base-300">
              <h3 className="card-title text-lg font-semibold">{calendarDate.toLocaleDateString()} 的工時紀錄</h3>
            </div>
            <div className="card-body p-4">
          {calendarLoading ? (
            <div>載入中...</div>
          ) : calendarLogs.length === 0 ? (
            <div className="text-base-content/40 text-center py-4">無資料</div>
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
        </div>
      </div>
      {/* 管理按鈕列 + 蕃茄鐘 */}
      <div className="card bg-base-100 shadow-lg mb-6">
        <div className="card-body p-4">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-outline btn-sm" onClick={() => setShowProjectCodeMgr(true)}>專案代碼管理</button>
              <button className="btn btn-outline btn-sm" onClick={() => setShowLinksMgr(true)}>常用連結管理</button>
              <button className="btn btn-outline btn-sm" onClick={() => setShowTaskTypeMgr(true)}>任務類型管理</button>
              <button className={`btn btn-primary btn-sm ${summaryLoading ? 'loading' : ''}`} onClick={handleSummary} disabled={summaryLoading}>
                {summaryLoading ? '結算中...' : '結算本日工時'}
              </button>
            </div>
            {/* 蕃茄鐘區塊 */}
            <div className="card bg-warning/20 border border-warning/40 min-w-fit">
              <div className="card-body p-4 text-center">
                <h4 className="font-bold text-sm mb-2">蕃茄鐘（40分鐘）</h4>
                <div className="text-2xl font-mono mb-3 text-warning-content">{formatTime(pomodoroTime)}</div>
                <div className="flex gap-2 justify-center">
                  <button className={`btn btn-xs ${pomodoroRunning ? 'btn-warning' : 'btn-success'}`} onClick={() => setPomodoroRunning(r => !r)}>{pomodoroRunning ? '暫停' : '開始'}</button>
                  <button className="btn btn-xs btn-ghost" onClick={() => { setPomodoroRunning(false); setPomodoroTime(INITIAL_POMODORO); }}>重設</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* 常用連結按鈕列（顯示在專案代碼管理下方） */}
      {links.length > 0 && (
        <div className="card bg-base-100 shadow-lg mb-6">
          <div className="card-body p-4">
            <h4 className="card-title text-base mb-3">常用連結</h4>
            <div className="flex flex-wrap gap-2">
              {links.map(link => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-outline btn-info"
                  title={link.note || link.url}
                >
                  {link.name}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
      {error && <div className="alert alert-error mb-4"><span>{error}</span></div>}
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      ) : (

        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        {/* 篩選按鈕 */}
        <div className="card bg-base-100 shadow-lg mb-6">
          <div className="card-body p-4">
            <h4 className="card-title text-base mb-3">時間範圍篩選</h4>
            <div className="btn-group">
              <button className={`btn btn-sm ${filterRange === 'all' ? 'btn-active' : 'btn-ghost'}`} onClick={() => setFilterRange('all')} disabled={filterRange === 'all'}>全部</button>
              <button className={`btn btn-sm ${filterRange === '3days' ? 'btn-active' : 'btn-ghost'}`} onClick={() => setFilterRange('3days')} disabled={filterRange === '3days'}>近三天</button>
              <button className={`btn btn-sm ${filterRange === '7days' ? 'btn-active' : 'btn-ghost'}`} onClick={() => setFilterRange('7days')} disabled={filterRange === '7days'}>近七天</button>
              <button className={`btn btn-sm ${filterRange === '1month' ? 'btn-active' : 'btn-ghost'}`} onClick={() => setFilterRange('1month')} disabled={filterRange === '1month'}>近一個月</button>
            </div>
          </div>
        </div>
          {/* 狀態佇列 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {STATUS.map(s => (
              <div key={s.key} className={`kanban-column-${s.key}`}>
                <div style={{ marginBottom: 4 }}>
                  <NewCardButton 
                    statusKey={s.key} 
                    onClick={() => {
                      setNewCardStatus(s.key);
                      setShowNewModal(true);
                    }} 
                  />
                </div>
                <DroppableColumn id={s.key} label={s.label}>
                  <SortableContext
                      items={todos
                        .filter(t => {
                          if (filterRange === 'all') return true;
                          const now = new Date();
                          const diffDays = (now - t.last_modified) / (1000 * 60 * 60 * 24);
                          if (filterRange === '3days') return diffDays <= 3;
                          if (filterRange === '7days') return diffDays <= 7;
                          if (filterRange === '1month') return diffDays <= 30;
                          return true;
                        })
                        .filter(t => t.status === s.key)
                        .map(t => t.id)}
                      strategy={verticalListSortingStrategy}>
                    {todos.filter(t => t.status === s.key).length === 0 && (
                      <div className="text-base-content/40 text-center py-8">無資料</div>
                    )}
                    {todos.filter(t => t.status === s.key).map(todo => (
                      <DraggableTodo 
                        key={todo.id} 
                        todo={todo} 
                        onEdit={(editingTodo) => {
                          setEditTodo(editingTodo);
                          setEditDesc(editingTodo.description);
                        }}
                        onDelete={handleDelete}
                      />
                    ))}
                  </SortableContext>
                </DroppableColumn>
              </div>
            ))}
          </div>
        </DndContext>
      )}
      {showSummary && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-2xl">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-lg">本日工時 JSON</h3>
              <button className="btn btn-ghost btn-sm" onClick={handleCopySummary} title="複製到剪貼簿">
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
              className="textarea textarea-bordered w-full h-60 font-mono text-sm"
              ref={summaryRef}
              value={summaryJson}
              onChange={e => setSummaryJson(e.target.value)}
            />
            <div className="modal-action">
              <button className="btn btn-sm" onClick={() => setShowSummary(false)}>關閉</button>
            </div>
          </div>
        </div>
      )}
      {/* 專案代碼管理視窗 */}
      {showProjectCodeMgr && (
        <div className="modal modal-open">
          <div className="modal-box"
            onClick={e => e.stopPropagation()}>
            <form method="dialog">
              <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={() => setShowProjectCodeMgr(false)}>✕</button>
            </form>
            <h3 className="font-bold text-lg mb-4">專案代碼管理</h3>
            <div className="flex gap-2 mb-3">
              <input className="input input-bordered input-sm flex-1" value={newProjectCode} onChange={e => setNewProjectCode(e.target.value)} placeholder="新增專案代碼" />
              <button className="btn btn-primary btn-sm" onClick={handleAddProjectCode}>新增</button>
            </div>
            <ul style={{ maxHeight: 200, overflowY: 'auto', padding: 0, margin: 0 }}>
              {projectCodes.map(code => (
                <li key={code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #eee', padding: '4px 0' }}>
                  <span>{code}</span>
                  <button className="btn btn-error btn-xs" onClick={() => handleDeleteProjectCode(code)}>刪除</button>
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
              <button className="btn btn-sm" onClick={() => setShowTaskTypeMgr(false)}>關閉</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input className="input input-bordered input-sm flex-1" value={newTaskType} onChange={e => setNewTaskType(e.target.value)} placeholder="新增任務類型" />
              <button className="btn btn-primary btn-sm" onClick={handleAddTaskType}>新增</button>
            </div>
            <ul style={{ maxHeight: 200, overflowY: 'auto', padding: 0, margin: 0 }}>
              {taskTypes.map(type => (
                <li key={type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #eee', padding: '4px 0' }}>
                  <span>{type}</span>
                  <button className="btn btn-error btn-xs" onClick={() => handleDeleteTaskType(type)}>刪除</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {/* 常用連結管理彈窗 */}
      {showLinksMgr && (
        <div style={{ position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.3)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowLinksMgr(false)}>
          <div style={{ background: 'white', padding: 24, borderRadius: 8, minWidth: 340, maxWidth: 420, boxShadow: '0 2px 16px #0002', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <b>常用連結管理</b>
              <button className="btn btn-sm" onClick={() => setShowLinksMgr(false)}>關閉</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input className="input input-bordered input-sm w-24" value={newLink.name} onChange={e => setNewLink(l => ({ ...l, name: e.target.value }))} placeholder="名稱" />
              <input className="input input-bordered input-sm flex-1" value={newLink.url} onChange={e => setNewLink(l => ({ ...l, url: e.target.value }))} placeholder="URL" />
              <input className="input input-bordered input-sm w-24" value={newLink.note} onChange={e => setNewLink(l => ({ ...l, note: e.target.value }))} placeholder="備註" />
              <button className="btn btn-primary btn-sm" onClick={handleAddLink}>新增</button>
            </div>
            <ul style={{ maxHeight: 220, overflowY: 'auto', padding: 0, margin: 0 }}>
              {links.map(link => (
                <li key={link.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #eee', padding: '4px 0' }}>
                  <span style={{ fontWeight: 'bold', color: '#2980b9' }}>{link.name}</span>
                  <span style={{ color: '#888', fontSize: 13, marginLeft: 8, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.url}</span>
                  {link.note && <span style={{ color: '#aaa', fontSize: 12, marginLeft: 8 }}>{link.note}</span>}
                  <button className="btn btn-error btn-xs ml-2" onClick={() => handleDeleteLink(link.id)}>刪除</button>
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
              <button className="btn btn-sm" onClick={() => setEditTodo(null)}>關閉</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{editTodo.project_code} [{editTodo.task_type}]</div>
              <textarea className="textarea textarea-bordered w-full" value={editDesc} onChange={e => setEditDesc(e.target.value)} style={{ minHeight: 80 }} />
            </div>
            <div style={{ textAlign: 'right' }}>
              <button className="btn btn-primary btn-sm" onClick={handleEditSave}>儲存</button>
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
              <button className="btn btn-sm" onClick={() => setShowNewModal(false)}>關閉</button>
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
                <button className="btn btn-primary btn-sm" type="submit">新增</button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

// Droppable 狀態欄元件
function DroppableColumn({ id, label, children }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  
  const getColumnClass = (id) => {
    switch(id) {
      case 'todo': return 'kanban-column-todo';
      case 'progress': return 'kanban-column-progress'; 
      case 'done': return 'kanban-column-done';
      case 'archive': return 'kanban-column-archive';
      default: return 'bg-base-100';
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`card shadow-lg p-4 min-h-[200px] transition-all duration-200 ${getColumnClass(id)} ${isOver ? 'scale-105 shadow-xl' : ''}`}
    >
      <h3 className="text-center font-semibold text-base-content mb-4">{label}</h3>
      {children}
    </div>
  );
}

// 移除了 DroppableDeleteColumn 和 DroppableEditColumn 元件

// 新增卡片按鈕元件
function NewCardButton({ statusKey, onClick }) {
  return (
    <button
      className="btn btn-outline btn-success w-full mb-1"
      onClick={onClick}
      style={{
        borderStyle: 'dashed',
        borderWidth: '2px',
        minHeight: '36px'
      }}
    >
      ➕ New
    </button>
  );
}

// 單一卡片的拖曳元件
function DraggableTodo({ todo, onEdit, onDelete }) {
  const [isHovered, setIsHovered] = useState(false);
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

  const getCardClass = (todo) => {
    switch(todo.status) {
      case 'todo': return 'kanban-card-todo';
      case 'progress': return 'kanban-card-progress';
      case 'done': return 'kanban-card-done';
      case 'archive': return 'kanban-card-archive';
      default: return '';
    }
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`kanban-card ${getCardClass(todo)} relative mb-2 p-3 ${isDragging ? 'opacity-70 scale-105' : ''}`}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
    >
      {/* 拖曳區域 - 排除按鈕區域 */}
      <div
        {...listeners}
        className={`cursor-grab flex-1 transition-all duration-200 ${isHovered ? 'mr-18' : 'mr-0'}`}
      >
        <div className="flex items-center font-bold text-sm mb-2">
          <span className="text-primary">{todo.project_code}</span> 
          <span className="font-normal text-base-content/60 ml-1">[{todo.task_type}]</span>
        </div>
        <div className="text-xs text-base-content/80 leading-relaxed">
          {renderTextWithLinks(todo.description)}
        </div>
      </div>
      
      {/* 懸停操作按鈕 */}
      {isHovered && !isDragging && (
        <div className="absolute top-2 right-2 flex gap-1 bg-base-100/90 backdrop-blur-sm rounded-lg p-1 shadow-lg z-10">
          <button 
            className="btn btn-primary btn-xs"
            onMouseDown={(e) => {
              e.stopPropagation(); // 阻止拖曳事件
            }}
            onClick={(e) => { 
              e.stopPropagation(); 
              e.preventDefault();
              onEdit(todo); 
            }}
            title="編輯"
          >
            ✏️
          </button>
          <button 
            className="btn btn-error btn-xs"
            onMouseDown={(e) => {
              e.stopPropagation(); // 阻止拖曳事件
            }}
            onClick={(e) => { 
              e.stopPropagation(); 
              e.preventDefault();
              onDelete(todo.id); 
            }}
            title="刪除"
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
