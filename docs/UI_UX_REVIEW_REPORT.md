# UI/UX 審視報告

> 審視日期：2026-01-14
> 審視範圍：智能工作台 (Worklog) 前端介面
> 審視者：Claude Code

---

## 執行摘要

本報告針對 Worklog 專案前端介面進行全面的 UI/UX 審視，識別出 **15 項** 需要改善的問題，並依據影響程度分類為設計一致性、操作流暢性、視覺層次三大類別。

### 問題統計

| 類別 | 問題數量 | 優先級 |
|------|----------|--------|
| 設計一致性 | 5 | 高 |
| 操作流暢性 | 5 | 高 |
| 視覺層次與可讀性 | 5 | 中 |

---

## 一、設計一致性問題

### 1.1 漸層色彩不統一

**問題描述**
專案中使用多種漸層組合，缺乏統一的品牌色彩系統。

**現況**
```
indigo-purple、blue-indigo、emerald-teal、purple-pink、orange-red
```

**影響位置**
- 管理工具按鈕（App.js:517-549）
- 看板欄位標頭
- 各種 Modal 標題

**建議**
建立 Design Token 系統，統一漸層組合為四種：主要、成功、警告、危險。

---

### 1.2 圓角半徑不一致

**問題描述**
混用多種圓角尺寸，視覺語言混亂。

**現況**
```jsx
rounded-xl (12px)
rounded-2xl (16px)
rounded-3xl (24px)
```

**建議**
統一標準：
- `rounded-xl` - 小元素（按鈕、標籤）
- `rounded-2xl` - 中元素（卡片、輸入框）
- `rounded-3xl` - 大元素（容器、Modal）

---

### 1.3 按鈕樣式混亂

**問題描述**
管理工具區的按鈕混用兩種 hover 實現方式。

**問題代碼位置**
`frontend/src/App.js:517-549`

**現況**
```jsx
// 前兩個按鈕使用 CSS hover
<button className="... hover:scale-105 active:scale-95">專案管理</button>

// 後兩個按鈕使用 Framer Motion
<motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
  任務類型
</motion.button>
```

**建議**
統一選擇一種實現方式。建議使用 CSS transition 以減少 JS 執行負擔。

---

### 1.4 圖標來源混用

**問題描述**
任務卡片的編輯/刪除按鈕使用 emoji，其他地方使用 Lucide 圖標。

**問題代碼位置**
`frontend/src/App.js:1415-1428`

**現況**
```jsx
<button>✏️</button>  // emoji
<button>🗑️</button>  // emoji
```

**建議**
統一使用 Lucide React：
```jsx
import { Edit, Trash2 } from 'lucide-react';

<button><Edit className="w-3 h-3" /></button>
<button><Trash2 className="w-3 h-3" /></button>
```

---

### 1.5 狀態顏色定義重複

**問題描述**
STATUS 陣列與 index.css 中的 Kanban 樣式定義了不同的顏色系統。

**現況**

| 來源 | 待處理 | 進行中 | 已完成 | 封存 |
|------|--------|--------|--------|------|
| App.js STATUS | slate | blue | green | purple |
| index.css | blue | amber | green | gray |

**建議**
刪除 index.css 中未使用的 `.kanban-column-*` 類別，或統一兩處定義。

---

## 二、操作流暢性問題

### 2.1 缺少拖曳視覺回饋

**問題描述**
拖曳任務卡片到目標欄位時，欄位本身沒有明顯的 drop zone 高亮效果。

**問題代碼位置**
`frontend/src/App.js:1359-1369` (DroppableColumn)

**現況**
```jsx
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
```

**建議**
增加 drop zone 高亮效果：
```jsx
className={`transition-all duration-200 ${
  isOver
    ? 'scale-105 ring-4 ring-indigo-400/50 bg-indigo-50/50'
    : ''
}`}
```

---

### 2.2 Modal 缺少鍵盤支援

**問題描述**
所有 Modal 都無法使用 ESC 鍵關閉，不符合無障礙設計標準。

**影響位置**
- 新增任務 Modal
- 編輯任務 Modal
- 專案代碼管理 Modal
- 任務類型管理 Modal
- 常用連結管理 Modal
- 工時結算 Modal

**建議**
新增 ESC 鍵監聽：
```jsx
useEffect(() => {
  const handleEsc = (e) => {
    if (e.key === 'Escape') setShowModal(false);
  };
  window.addEventListener('keydown', handleEsc);
  return () => window.removeEventListener('keydown', handleEsc);
}, []);
```

---

### 2.3 新增任務入口分散

**問題描述**
每個看板欄位都有「新增任務」按鈕，但沒有全域快捷新增方式。

**建議**
- 新增全域快捷鍵 `N` 開啟新增任務 Modal
- 或在頁面右下角新增浮動新增按鈕

---

### 2.4 表單驗證時機不佳

**問題描述**
新增/編輯任務的表單僅在提交時驗證，缺少即時反饋。

**問題代碼位置**
`frontend/src/App.js:325-344`

**現況**
```jsx
const handleAddTodo = async (e) => {
  e.preventDefault();
  setError('');
  if (!form.project_code || !form.task_type) {
    setError('請填寫專案代碼與任務類型');
    return;
  }
  // ...
};
```

**建議**
- 在 select 元素加入即時驗證
- 使用視覺提示（紅色邊框）標示未填欄位
- 提交按鈕在表單未完成時顯示 disabled 狀態

---

### 2.5 刪除操作缺少確認

**問題描述**
刪除任務沒有確認對話框，容易造成誤刪。

**問題代碼位置**
`frontend/src/App.js:122-130`

**現況**
```jsx
const handleDelete = async (id) => {
  setTodos(prev => prev.filter(t => t.id !== id));
  // 直接刪除，無確認
  try {
    await fetch(`/api/todos/${id}`, { method: 'DELETE' });
  } catch (e) {
    fetchTodos();
  }
};
```

**建議**
```jsx
const handleDelete = async (id) => {
  if (!window.confirm('確定要刪除此任務嗎？此操作無法復原。')) return;
  // ... 原有邏輯
};
```

---

## 三、視覺層次與可讀性問題

### 3.1 資訊架構可優化

**問題描述**
日曆佔用 1/3 空間，但工時統計更為重要卻在右側。蕃茄鐘是高頻功能但位置不夠突出。

**現況布局**
```
[日曆 1/3] [工時統計 2/3]
[管理工具 -------- ] [蕃茄鐘]
```

**建議布局**
```
[蕃茄鐘 + 工時統計 2/3] [日曆 1/3]
[管理工具 -------------------- ]
```

---

### 3.2 空狀態文字對比度不足

**問題描述**
看板欄位的空狀態使用低對比度的白色文字。

**問題代碼位置**
`frontend/src/App.js:807-813`

**現況**
```jsx
<p className="text-white/60 font-medium">沒有任務</p>
```

**建議**
使用對應欄位的 textColor 提高對比度：
```jsx
<p className={`${s.textColor} opacity-70 font-medium`}>沒有任務</p>
```

---

### 3.3 錯誤提示風格不協調

**問題描述**
紅色錯誤提示框與整體漸層風格不一致。

**問題代碼位置**
`frontend/src/App.js:636-649`

**建議**
使用與其他元件一致的漸層風格：
```jsx
<div className="bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 rounded-2xl p-4">
```

---

### 3.4 頁面標題佔用空間過大

**問題描述**
`text-5xl` 標題佔用過多垂直空間。

**問題代碼位置**
`frontend/src/App.js:384-387`

**現況**
```jsx
<h1 className="text-5xl font-bold ...">✨ 智能工作台</h1>
```

**建議**
縮小為 `text-3xl` 或 `text-4xl`，減少標題區域的垂直高度。

---

### 3.5 日曆樣式與主題不一致

**問題描述**
react-calendar 使用獨立的漸層配色（#667eea → #764ba2），與專案主題色不一致。

**問題代碼位置**
`frontend/src/App.css:88-186`

**建議**
將日曆的紫色漸層改為專案的 indigo-purple 漸層：
```css
background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
```

---

## 優先改善清單

依據影響範圍和實作難度排序：

| 優先級 | 項目 | 預估難度 | 影響範圍 |
|--------|------|----------|----------|
| 1 | 新增刪除確認對話框 | 低 | 資料安全 |
| 2 | 統一圖標系統（emoji → Lucide） | 低 | 視覺一致性 |
| 3 | 新增 Modal ESC 關閉支援 | 低 | 無障礙 |
| 4 | 統一按鈕 hover 實現 | 低 | 程式碼品質 |
| 5 | 改善空狀態文字對比度 | 低 | 可讀性 |
| 6 | 統一圓角規範 | 中 | 視覺一致性 |
| 7 | 新增拖曳 drop zone 高亮 | 中 | 操作體驗 |
| 8 | 表單即時驗證 | 中 | 使用體驗 |
| 9 | 統一漸層色彩系統 | 中 | 品牌一致性 |
| 10 | 調整資訊架構布局 | 高 | 整體體驗 |

---

## 附錄：截圖參考

審視時截取的頁面截圖存放於：
```
.playwright-mcp/worklog-full-page.png
```

---

## 更新記錄

| 日期 | 版本 | 變更內容 |
|------|------|----------|
| 2026-01-14 | 1.0.0 | 初始版本 |
