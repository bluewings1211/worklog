import React, { useEffect, useState, useRef } from 'react';
import './App.css';
import { DndContext, closestCenter, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDraggable } from '@dnd-kit/core';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Clock, Calendar as CalendarIcon, Settings, Link, BarChart3, Play, Pause, RotateCcw, Edit, Trash2, Filter } from 'lucide-react';

const STATUS = [
  { key: 'pending', label: '待處理', color: 'from-slate-100 to-slate-200', borderColor: 'border-slate-300', textColor: 'text-slate-700', icon: '📋' },
  { key: 'in_progress', label: '進行中', color: 'from-blue-100 to-blue-200', borderColor: 'border-blue-300', textColor: 'text-blue-700', icon: '⚡' },
  { key: 'done', label: '已完成', color: 'from-green-100 to-green-200', borderColor: 'border-green-300', textColor: 'text-green-700', icon: '✅' },
  { key: 'archive', label: '封存', color: 'from-purple-100 to-purple-200', borderColor: 'border-purple-300', textColor: 'text-purple-700', icon: '📦' },
];
const INITIAL_POMODORO = 40 * 60;  // 初始蕃茄鐘時長（秒）

function App() {
  const [filterRange, setFilterRange] = useState('7days'); // 篩選範圍：'all', '3days', '7days', '1month'
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
      const todosArray = Array.isArray(data) ? data : [];
      setTodos(todosArray.map(todo => ({
          ...todo,
          last_modified: new Date(todo.last_modified) // 確保 last_modified 是 Date 物件
        })));
    } catch (e) {
      setError('載入失敗');
      setTodos([]);
    }
    setLoading(false);
  };

  // 載入其他資料
  useEffect(() => {
    fetchTodos();
    fetchProjectCodes();
    fetchTaskTypes();
    fetchCalendarLogs();
    fetchLinks();
  }, []);

  // 刪除功能：樂觀更新，先移除再呼叫後端
  const handleDelete = async (id) => {
    setTodos(prev => prev.filter(t => t.id !== id));
    try {
      await fetch(`/api/todos/${id}`, { method: 'DELETE' });
    } catch (e) {
      // 如果刪除失敗，重新載入
      fetchTodos();
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
      setTodos(prev => prev.map(t => t.id === todoId ? { ...t, status: newStatus } : t));
      try {
        await fetch(`/api/todos/${todoId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...todo, status: newStatus })
        });
      } catch (e) {
        fetchTodos();
      }
    }
  };

  // 取得專案代碼
  const fetchProjectCodes = async () => {
    try {
      const res = await fetch('/api/project_codes');
      const data = await res.json();
      setProjectCodes(Array.isArray(data) ? data : []);
    } catch (e) {
      setProjectCodes([]);
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
    fetchProjectCodes();
  };

  // 刪除專案代碼
  const handleDeleteProjectCode = async (code) => {
    await fetch(`/api/project_codes/${encodeURIComponent(code)}`, { method: 'DELETE' });
    fetchProjectCodes();
  };

  // 取得任務類型
  const fetchTaskTypes = async () => {
    try {
      const res = await fetch('/api/task_types');
      const data = await res.json();
      setTaskTypes(Array.isArray(data) ? data : []);
    } catch (e) {
      setTaskTypes([]);
    }
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
    fetchTaskTypes();
  };

  // 刪除任務類型
  const handleDeleteTaskType = async (type) => {
    await fetch(`/api/task_types/${encodeURIComponent(type)}`, { method: 'DELETE' });
    fetchTaskTypes();
  };

  // 取得日曆工時紀錄
  const fetchCalendarLogs = async () => {
    setCalendarLoading(true);
    try {
      const res = await fetch(`/api/summary/today?date=${calendarDate.toISOString().split('T')[0]}`);
      const data = await res.json();
      setCalendarLogs(Array.isArray(data) ? data : []);
    } catch (e) {
      setCalendarLogs([]);
    }
    setCalendarLoading(false);
  };

  useEffect(() => {
    fetchCalendarLogs();
  }, [calendarDate]);

  // 結算本日工時
  const handleSummary = async () => {
    setSummaryLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/summary/today?date=${today}`);
      const data = await res.json();
      const logsArray = Array.isArray(data) ? data : [];
      setSummaryJson(JSON.stringify({ date: today, logs: logsArray }, null, 2));
      setShowSummary(true);
    } catch (e) {
      setError('結算失敗');
    }
    setSummaryLoading(false);
  };

  // 複製到剪貼簿
  const handleCopySummary = () => {
    if (summaryRef.current) {
      summaryRef.current.select();
      document.execCommand('copy');
    }
  };

  // 取得所有常用連結
  const fetchLinks = async () => {
    try {
      const res = await fetch('/api/links');
      const data = await res.json();
      setLinks(Array.isArray(data) ? data : []);
    } catch (e) {
      setLinks([]);
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

  // 新增任務
  const handleAddTodo = async (e) => {
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
        body: JSON.stringify({ ...form, status: newCardStatus }),
      });
      setForm({ project_code: '', task_type: '', description: '' });
      setShowNewModal(false);
      fetchTodos();
    } catch (e) {
      setError('新增失敗');
    }
  };

  // 編輯任務
  const handleEditTodo = async (e) => {
    e.preventDefault();
    if (!editTodo) return;
    try {
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
      setEditDesc('');
      fetchTodos();
    } catch (e) {
      setError('編輯失敗');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative z-10 container mx-auto p-6">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-10"
        >
          <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 bg-clip-text text-transparent mb-4">
            ✨ 智能工作台
          </h1>
          <p className="text-gray-600 text-lg font-medium">高效管理您的工作流程</p>
        </motion.div>

        {/* 日曆與工時統計 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8"
        >
          <div className="lg:col-span-1">
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 p-6 hover:shadow-3xl transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <CalendarIcon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">日曆選擇</h3>
              </div>
              <div className="calendar-container rounded-2xl overflow-hidden">
                <Calendar
                  onChange={setCalendarDate}
                  value={calendarDate}
                  locale="zh-TW"
                  className="react-calendar-modern"
                />
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-2">
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 p-6 hover:shadow-3xl transition-all duration-300">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">{calendarDate.toLocaleDateString()} 工時統計</h3>
                </div>
              </div>
              <div className="space-y-4">
                {calendarLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <span className="ml-3 text-gray-600">載入中...</span>
                  </div>
                ) : calendarLogs.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Clock className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 font-medium">暫無工時記錄</p>
                  </div>
                ) : (
                  <>
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`p-4 rounded-2xl border-2 ${
                        calendarLogs.reduce((sum, log) => sum + (log.hour_spent || 0), 0) >= 8 
                          ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200' 
                          : 'bg-gradient-to-r from-orange-50 to-red-50 border-orange-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          calendarLogs.reduce((sum, log) => sum + (log.hour_spent || 0), 0) >= 8 
                            ? 'bg-emerald-500' 
                            : 'bg-orange-500'
                        }`}>
                          <Clock className="w-4 h-4 text-white" />
                        </div>
                        <span className={`font-bold text-lg ${
                          calendarLogs.reduce((sum, log) => sum + (log.hour_spent || 0), 0) >= 8 
                            ? 'text-emerald-700' 
                            : 'text-orange-700'
                        }`}>
                          總工時：{calendarLogs.reduce((sum, log) => sum + (log.hour_spent || 0), 0)} 小時
                        </span>
                      </div>
                    </motion.div>
                    <div className="space-y-3 mt-4">
                      {calendarLogs.map((log, idx) => (
                        <motion.div 
                          key={idx}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="bg-white rounded-xl p-4 border border-gray-100 hover:shadow-md transition-all duration-200"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
                              <div>
                                <span className="font-bold text-gray-800">{log.project_code}</span>
                                <span className="mx-2 text-gray-400">•</span>
                                <span className="text-sm bg-gray-100 px-2 py-1 rounded-lg text-gray-600">{log.task_type}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Clock className="w-4 h-4" />
                              <span className="font-medium">{log.hour_spent} 小時</span>
                            </div>
                          </div>
                          {log.description && (
                            <p className="text-sm text-gray-600 mt-2 pl-6">{log.description}</p>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </motion.div>
        
        {/* 管理工具列與蕃茄鐘 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 p-6 mb-8 hover:shadow-3xl transition-all duration-300"
        >
          <div className="flex flex-col xl:flex-row gap-6 items-start xl:items-center justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-600" />
                管理工具
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button 
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-xl font-medium hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
                  onClick={() => setShowProjectCodeMgr(true)}
                >
                  <Settings className="w-4 h-4" />
                  專案管理
                </button>
                <button 
                  className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-4 py-2 rounded-xl font-medium hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
                  onClick={() => setShowLinksMgr(true)}
                >
                  <Link className="w-4 h-4" />
                  連結管理
                </button>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white px-4 py-2 rounded-xl font-medium hover:shadow-lg transition-all duration-200"
                  onClick={() => setShowTaskTypeMgr(true)}
                >
                  <Settings className="w-4 h-4" />
                  任務類型
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-600 text-white px-4 py-2 rounded-xl font-medium hover:shadow-lg transition-all duration-200 ${summaryLoading ? 'opacity-75 cursor-not-allowed' : ''}`}
                  onClick={handleSummary} 
                  disabled={summaryLoading}
                >
                  <BarChart3 className="w-4 h-4" />
                  {summaryLoading ? '結算中...' : '工時結算'}
                </motion.button>
              </div>
            </div>
            
            {/* 蕃茄鐘區塊 */}
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-3xl p-6 min-w-fit"
            >
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  <h4 className="font-bold text-amber-700">蕃茄鐘 40分鐘</h4>
                </div>
                <div className="text-3xl font-mono mb-4 text-amber-800 font-bold">{formatTime(pomodoroTime)}</div>
                <div className="flex gap-2 justify-center">
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`flex items-center gap-1 px-3 py-2 rounded-xl font-medium text-white transition-all duration-200 ${
                      pomodoroRunning 
                        ? 'bg-gradient-to-r from-red-500 to-pink-600 hover:shadow-lg' 
                        : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:shadow-lg'
                    }`} 
                    onClick={() => setPomodoroRunning(r => !r)}
                  >
                    {pomodoroRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    {pomodoroRunning ? '暫停' : '開始'}
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-1 bg-gradient-to-r from-gray-400 to-gray-500 text-white px-3 py-2 rounded-xl font-medium hover:shadow-lg transition-all duration-200" 
                    onClick={() => { setPomodoroRunning(false); setPomodoroTime(INITIAL_POMODORO); }}
                  >
                    <RotateCcw className="w-3 h-3" />
                    重設
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* 常用連結区域 */}
        {links.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 p-6 mb-8 hover:shadow-3xl transition-all duration-300"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
                <Link className="w-5 h-5 text-white" />
              </div>
              <h4 className="text-lg font-bold text-gray-800">常用連結</h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {links.map((link, index) => (
                <motion.a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-gradient-to-r from-cyan-50 to-blue-50 border-2 border-cyan-200 hover:border-cyan-300 text-cyan-700 hover:text-cyan-800 px-4 py-3 rounded-xl font-medium text-center transition-all duration-200 hover:shadow-lg group"
                  title={link.note || link.url}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Link className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span className="truncate">{link.name}</span>
                  </div>
                </motion.a>
              ))}
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 mb-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-500 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold">!</span>
              </div>
              <span className="text-red-700 font-medium">{error}</span>
            </div>
          </motion.div>
        )}
        
        {loading ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16"
          >
            <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600 font-medium text-lg">載入中...</p>
          </motion.div>
        ) : (
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            {/* 篩選器 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 p-6 mb-8 hover:shadow-3xl transition-all duration-300"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Filter className="w-5 h-5 text-white" />
                </div>
                <h4 className="text-lg font-bold text-gray-800">時間範圍篩選</h4>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                    filterRange === 'all' 
                      ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`} 
                  onClick={() => setFilterRange('all')} 
                  disabled={filterRange === 'all'}
                >
                  全部
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                    filterRange === '3days' 
                      ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`} 
                  onClick={() => setFilterRange('3days')} 
                  disabled={filterRange === '3days'}
                >
                  近三天
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                    filterRange === '7days' 
                      ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`} 
                  onClick={() => setFilterRange('7days')} 
                  disabled={filterRange === '7days'}
                >
                  近七天
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                    filterRange === '1month' 
                      ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`} 
                  onClick={() => setFilterRange('1month')} 
                  disabled={filterRange === '1month'}
                >
                  近一個月
                </motion.button>
              </div>
            </motion.div>

            {/* Kanban 看板 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {STATUS.map((s, index) => (
                <motion.div 
                  key={s.key} 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 + index * 0.1 }}
                  className={`bg-gradient-to-br ${s.color} border-2 ${s.borderColor} rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden`}
                >
                  {/* 欄位標頭 */}
                  <div className="p-6 border-b border-white/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center text-xl`}>
                          {s.icon}
                        </div>
                        <h3 className={`font-bold text-lg ${s.textColor}`}>{s.label}</h3>
                      </div>
                      <div className={`bg-white/30 ${s.textColor} px-3 py-1 rounded-xl font-bold text-sm`}>
                        {todos.filter(t => {
                          if (filterRange === 'all') return true;
                          const now = new Date();
                          const diffDays = (now - t.last_modified) / (1000 * 60 * 60 * 24);
                          if (filterRange === '3days') return diffDays <= 3;
                          if (filterRange === '7days') return diffDays <= 7;
                          if (filterRange === '1month') return diffDays <= 30;
                          return true;
                        }).filter(t => t.status === s.key).length}
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full bg-white/30 hover:bg-white/40 border-2 border-dashed border-white/50 hover:border-white/70 rounded-2xl p-3 text-white font-medium transition-all duration-200 flex items-center justify-center gap-2"
                      onClick={() => {
                        setNewCardStatus(s.key);
                        setShowNewModal(true);
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      新增任務
                    </motion.button>
                  </div>
                  
                  {/* 任務列表 */}
                  <DroppableColumn id={s.key} label={s.label}>
                    <div className="p-4 space-y-3 min-h-96">
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
                        {todos.filter(t => {
                          if (filterRange === 'all') return true;
                          const now = new Date();
                          const diffDays = (now - t.last_modified) / (1000 * 60 * 60 * 24);
                          if (filterRange === '3days') return diffDays <= 3;
                          if (filterRange === '7days') return diffDays <= 7;
                          if (filterRange === '1month') return diffDays <= 30;
                          return true;
                        }).filter(t => t.status === s.key).length === 0 && (
                          <div className="text-center py-12">
                            <div className="w-16 h-16 bg-white/30 rounded-3xl flex items-center justify-center mx-auto mb-4">
                              <div className="text-2xl opacity-50">📝</div>
                            </div>
                            <p className="text-white/60 font-medium">沒有任務</p>
                          </div>
                        )}
                        {todos.filter(t => {
                          if (filterRange === 'all') return true;
                          const now = new Date();
                          const diffDays = (now - t.last_modified) / (1000 * 60 * 60 * 24);
                          if (filterRange === '3days') return diffDays <= 3;
                          if (filterRange === '7days') return diffDays <= 7;
                          if (filterRange === '1month') return diffDays <= 30;
                          return true;
                        }).filter(t => t.status === s.key).map((todo, todoIndex) => (
                          <motion.div
                            key={todo.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ delay: todoIndex * 0.05 }}
                            layout
                          >
                            <DraggableTodo 
                              todo={todo} 
                              onEdit={(editingTodo) => {
                                setEditTodo(editingTodo);
                                setEditDesc(editingTodo.description);
                              }}
                              onDelete={handleDelete}
                            />
                          </motion.div>
                        ))}
                      </SortableContext>
                    </div>
                  </DroppableColumn>
                </motion.div>
              ))}
            </motion.div>
          </DndContext>
        )}

        {/* 新增任務 Modal */}
        {showNewModal && (
          <div className="modal modal-open modal-enhanced">
            <div className="modal-box modal-box-enhanced w-11/12 max-w-md">
              <form method="dialog">
                <button 
                  className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" 
                  onClick={() => setShowNewModal(false)}
                >
                  ✕
                </button>
              </form>
              <h3 className="font-bold text-lg mb-4 text-gray-800">
                新增任務到「{STATUS.find(s => s.key === newCardStatus)?.label}」
              </h3>
              
              <form onSubmit={handleAddTodo} className="space-y-4">
                <div>
                  <label className="label">
                    <span className="label-text font-medium">專案代碼</span>
                  </label>
                  <select 
                    className="select select-bordered w-full"
                    value={form.project_code}
                    onChange={(e) => setForm(prev => ({ ...prev, project_code: e.target.value }))}
                    required
                  >
                    <option value="">請選擇專案代碼</option>
                    {projectCodes.map(code => (
                      <option key={code} value={code}>{code}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">
                    <span className="label-text font-medium">任務類型</span>
                  </label>
                  <select 
                    className="select select-bordered w-full"
                    value={form.task_type}
                    onChange={(e) => setForm(prev => ({ ...prev, task_type: e.target.value }))}
                    required
                  >
                    <option value="">請選擇任務類型</option>
                    {taskTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">
                    <span className="label-text font-medium">任務描述</span>
                  </label>
                  <textarea 
                    className="textarea textarea-bordered w-full"
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="請輸入任務描述..."
                  />
                </div>

                <div className="modal-action">
                  <button 
                    type="button" 
                    className="btn btn-ghost" 
                    onClick={() => setShowNewModal(false)}
                  >
                    取消
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                  >
                    新增任務
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 編輯任務 Modal */}
        {editTodo && (
          <div className="modal modal-open modal-enhanced">
            <div className="modal-box modal-box-enhanced w-11/12 max-w-md">
              <form method="dialog">
                <button 
                  className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" 
                  onClick={() => { setEditTodo(null); setEditDesc(''); }}
                >
                  ✕
                </button>
              </form>
              <h3 className="font-bold text-lg mb-4 text-gray-800">編輯任務</h3>
              
              <form onSubmit={handleEditTodo} className="space-y-4">
                <div>
                  <label className="label">
                    <span className="label-text font-medium">專案代碼</span>
                  </label>
                  <input 
                    type="text"
                    className="input input-bordered w-full bg-gray-100"
                    value={editTodo.project_code}
                    disabled
                  />
                </div>

                <div>
                  <label className="label">
                    <span className="label-text font-medium">任務類型</span>
                  </label>
                  <input 
                    type="text"
                    className="input input-bordered w-full bg-gray-100"
                    value={editTodo.task_type}
                    disabled
                  />
                </div>

                <div>
                  <label className="label">
                    <span className="label-text font-medium">任務描述</span>
                  </label>
                  <textarea 
                    className="textarea textarea-bordered w-full"
                    rows={4}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="請輸入任務描述..."
                  />
                </div>

                <div className="modal-action">
                  <button 
                    type="button" 
                    className="btn btn-ghost" 
                    onClick={() => { setEditTodo(null); setEditDesc(''); }}
                  >
                    取消
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                  >
                    更新任務
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 專案代碼管理 Modal */}
        {showProjectCodeMgr && (
          <div className="modal modal-open modal-enhanced">
            <div className="modal-box modal-box-enhanced">
              <form method="dialog">
                <button 
                  className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" 
                  onClick={() => setShowProjectCodeMgr(false)}
                >
                  ✕
                </button>
              </form>
              <h3 className="font-bold text-lg mb-4">專案代碼管理</h3>
              
              <div className="flex gap-2 mb-3">
                <input 
                  className="input input-bordered input-sm flex-1" 
                  value={newProjectCode} 
                  onChange={e => setNewProjectCode(e.target.value)} 
                  placeholder="新增專案代碼" 
                />
                <button className="btn btn-primary btn-sm" onClick={handleAddProjectCode}>新增</button>
              </div>
              
              <div className="max-h-60 overflow-y-auto">
                {projectCodes.map(code => (
                  <div key={code} className="flex items-center justify-between border-b border-gray-200 py-2">
                    <span>{code}</span>
                    <button className="btn btn-error btn-xs" onClick={() => handleDeleteProjectCode(code)}>刪除</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 任務類型管理 Modal */}
        {showTaskTypeMgr && (
          <div className="modal modal-open modal-enhanced">
            <div className="modal-box modal-box-enhanced">
              <form method="dialog">
                <button 
                  className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" 
                  onClick={() => setShowTaskTypeMgr(false)}
                >
                  ✕
                </button>
              </form>
              <h3 className="font-bold text-lg mb-4">任務類型管理</h3>
              
              <div className="flex gap-2 mb-3">
                <input 
                  className="input input-bordered input-sm flex-1" 
                  value={newTaskType} 
                  onChange={e => setNewTaskType(e.target.value)} 
                  placeholder="新增任務類型" 
                />
                <button className="btn btn-primary btn-sm" onClick={handleAddTaskType}>新增</button>
              </div>
              
              <div className="max-h-60 overflow-y-auto">
                {taskTypes.map(type => (
                  <div key={type} className="flex items-center justify-between border-b border-gray-200 py-2">
                    <span>{type}</span>
                    <button className="btn btn-error btn-xs" onClick={() => handleDeleteTaskType(type)}>刪除</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 常用連結管理 Modal */}
        {showLinksMgr && (
          <div className="modal modal-open modal-enhanced">
            <div className="modal-box modal-box-enhanced">
              <form method="dialog">
                <button 
                  className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" 
                  onClick={() => setShowLinksMgr(false)}
                >
                  ✕
                </button>
              </form>
              <h3 className="font-bold text-lg mb-4">常用連結管理</h3>
              
              <div className="grid grid-cols-1 gap-2 mb-3">
                <input 
                  className="input input-bordered input-sm" 
                  value={newLink.name} 
                  onChange={e => setNewLink(l => ({ ...l, name: e.target.value }))} 
                  placeholder="名稱" 
                />
                <input 
                  className="input input-bordered input-sm" 
                  value={newLink.url} 
                  onChange={e => setNewLink(l => ({ ...l, url: e.target.value }))} 
                  placeholder="URL" 
                />
                <input 
                  className="input input-bordered input-sm" 
                  value={newLink.note} 
                  onChange={e => setNewLink(l => ({ ...l, note: e.target.value }))} 
                  placeholder="備註" 
                />
                <button className="btn btn-primary btn-sm" onClick={handleAddLink}>新增</button>
              </div>
              
              <div className="max-h-60 overflow-y-auto">
                {links.map(link => (
                  <div key={link.id} className="flex items-center justify-between border-b border-gray-200 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-cyan-700">{link.name}</div>
                      <div className="text-sm text-gray-500 truncate">{link.url}</div>
                      {link.note && <div className="text-xs text-gray-400">{link.note}</div>}
                    </div>
                    <button className="btn btn-error btn-xs ml-2" onClick={() => handleDeleteLink(link.id)}>刪除</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 工時結算 Modal */}
        {showSummary && (
          <div className="modal modal-open modal-enhanced">
            <div className="modal-box modal-box-enhanced w-11/12 max-w-2xl">
              <form method="dialog">
                <button 
                  className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" 
                  onClick={() => setShowSummary(false)}
                >
                  ✕
                </button>
              </form>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-lg">本日工時 JSON</h3>
                <button className="btn btn-ghost btn-sm" onClick={handleCopySummary} title="複製到剪貼簿">
                  📋
                </button>
              </div>
              
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
      </div>
    </div>
  );
}

// DroppableColumn component
function DroppableColumn({ id, label, children }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  
  return (
    <div
      ref={setNodeRef}
      className={`transition-all duration-200 ${isOver ? 'scale-105' : ''}`}
    >
      {children}
    </div>
  );
}

// DraggableTodo component
function DraggableTodo({ todo, onEdit, onDelete }) {
  const [isHovered, setIsHovered] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: todo.id });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-white/30 transition-all duration-300 cursor-grab relative ${isDragging ? 'opacity-70 scale-105 rotate-3' : 'hover:shadow-xl hover:scale-102'}`}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
    >
      {/* 拖曳區域 */}
      <div
        {...listeners}
        className="flex-1"
      >
        <div className="flex items-center font-bold text-sm mb-2">
          <span className="text-indigo-600">{todo.project_code}</span> 
          <span className="font-normal text-gray-500 ml-1">[{todo.task_type}]</span>
        </div>
        <div className="text-xs text-gray-700 leading-relaxed">
          {todo.description}
        </div>
      </div>
      
      {/* 懸停操作按鈕 */}
      {isHovered && !isDragging && (
        <div className="absolute top-2 right-2 flex gap-1 bg-white/90 backdrop-blur-sm rounded-lg p-1 shadow-lg z-10">
          <button 
            className="btn btn-primary btn-xs"
            onMouseDown={(e) => e.stopPropagation()}
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
            onMouseDown={(e) => e.stopPropagation()}
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