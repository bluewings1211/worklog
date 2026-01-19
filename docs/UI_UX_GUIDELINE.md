# UI/UX Design Guideline

> 智能工作台 (Worklog) 專案的設計規範文件

## 1. 設計原則

### 1.1 核心原則

| 原則 | 說明 |
|------|------|
| **一致性 (Consistency)** | 相同功能使用相同的視覺元素和互動模式 |
| **簡潔性 (Simplicity)** | 減少視覺噪音，突出核心功能 |
| **可預測性 (Predictability)** | 使用者能預期操作結果 |
| **回饋性 (Feedback)** | 每個操作都有即時視覺回饋 |
| **容錯性 (Forgiveness)** | 提供撤銷機制，避免誤操作造成損失 |

### 1.2 設計優先級

1. **功能優先** - 先確保功能可用
2. **易用性** - 減少學習成本
3. **美觀性** - 在不影響功能下提升視覺體驗

---

## 2. 色彩系統

### 2.1 主色調（基於 DaisyUI GitHub 主題）

```css
/* 主要色彩 */
--primary: #0969da;        /* 藍色 - 主要操作、連結 */
--secondary: #656d76;      /* 灰色 - 次要資訊 */
--accent: #8250df;         /* 紫色 - 強調、特殊功能 */

/* 語意色彩 */
--success: #1a7f37;        /* 綠色 - 成功、已完成 */
--warning: #d97706;        /* 琥珀色 - 警告、進行中 */
--error: #d1242f;          /* 紅色 - 錯誤、刪除 */
--info: #0969da;           /* 藍色 - 提示資訊 */

/* 基底色彩 */
--base-100: #ffffff;       /* 主背景 */
--base-200: #f6f8fa;       /* 次背景 */
--base-300: #d0d7de;       /* 邊框 */
--neutral: #24292f;        /* 主文字 */
```

### 2.2 漸層規範

專案統一使用以下漸層組合：

| 用途 | 漸層 | Tailwind Class |
|------|------|----------------|
| **主要操作** | 靛藍 → 紫色 | `from-indigo-500 to-purple-600` |
| **成功狀態** | 翠綠 → 青色 | `from-emerald-500 to-teal-600` |
| **警告狀態** | 琥珀 → 橙色 | `from-amber-500 to-orange-600` |
| **錯誤/刪除** | 紅色 → 粉紅 | `from-red-500 to-pink-600` |
| **背景裝飾** | 藍色 → 靛藍 (20% 透明度) | `from-blue-400/20 to-indigo-400/20` |

### 2.3 看板欄位色彩

| 狀態 | 背景漸層 | 邊框 | 文字 |
|------|----------|------|------|
| 待處理 | `from-slate-100 to-slate-200` | `border-slate-300` | `text-slate-700` |
| 進行中 | `from-blue-100 to-blue-200` | `border-blue-300` | `text-blue-700` |
| 已完成 | `from-green-100 to-green-200` | `border-green-300` | `text-green-700` |
| 封存 | `from-purple-100 to-purple-200` | `border-purple-300` | `text-purple-700` |

---

## 3. 排版規範

### 3.1 字體

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto',
             'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans',
             'Helvetica Neue', sans-serif;
```

### 3.2 字級規範

| 用途 | Tailwind Class | 範例 |
|------|----------------|------|
| 頁面標題 | `text-3xl font-bold` | 智能工作台 |
| 區塊標題 | `text-lg font-bold` | 日曆選擇 |
| 卡片標題 | `text-sm font-bold` | 專案代碼 |
| 正文 | `text-sm` | 一般內容 |
| 輔助文字 | `text-xs text-gray-500` | 提示說明 |

### 3.3 字重使用

- `font-bold` - 標題、重要資訊
- `font-medium` - 按鈕文字、強調文字
- `font-normal` - 正文、一般文字

---

## 4. 間距與圓角

### 4.1 間距規範

| 用途 | 數值 | Tailwind Class |
|------|------|----------------|
| 元件內間距 | 16px | `p-4` |
| 區塊間距 | 24px - 32px | `gap-6` / `gap-8` |
| 小元素間距 | 8px - 12px | `gap-2` / `gap-3` |

### 4.2 圓角規範（統一標準）

| 元素類型 | 數值 | Tailwind Class |
|----------|------|----------------|
| 小元素（按鈕、標籤） | 12px | `rounded-xl` |
| 中元素（卡片、輸入框） | 16px | `rounded-2xl` |
| 大元素（容器、Modal） | 24px | `rounded-3xl` |

---

## 5. 元件規範

### 5.1 按鈕

#### 主要按鈕
```jsx
<button className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600
  text-white px-4 py-2 rounded-xl font-medium
  hover:shadow-lg transition-all duration-200
  hover:scale-105 active:scale-95">
  <Icon className="w-4 h-4" />
  按鈕文字
</button>
```

#### 次要按鈕
```jsx
<button className="px-4 py-2 border border-gray-200 rounded-xl
  text-gray-700 font-medium hover:bg-gray-50 transition-colors duration-200">
  按鈕文字
</button>
```

#### 危險按鈕
```jsx
<button className="bg-gradient-to-r from-red-500 to-pink-600
  text-white px-4 py-2 rounded-xl font-medium">
  刪除
</button>
```

### 5.2 卡片

```jsx
<div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl
  border border-white/20 p-6
  hover:shadow-3xl transition-all duration-300">
  {/* 卡片內容 */}
</div>
```

### 5.3 輸入框

```jsx
<input className="w-full px-4 py-3 border border-gray-200 rounded-xl
  focus:ring-2 focus:ring-indigo-500 focus:border-transparent
  outline-none transition-all duration-200 bg-white" />
```

### 5.4 Modal

```jsx
<div className="modal-enhanced">
  <div className="modal-box-enhanced w-full max-w-lg">
    {/* Modal 內容 */}
  </div>
</div>
```

---

## 6. 圖標規範

### 6.1 圖標來源

**統一使用 Lucide React 圖標庫**

```jsx
import { Plus, Clock, Calendar, Settings, Link, Edit, Trash2 } from 'lucide-react';
```

### 6.2 圖標尺寸

| 用途 | 尺寸 | Tailwind Class |
|------|------|----------------|
| 小按鈕內 | 12px | `w-3 h-3` |
| 一般按鈕內 | 16px | `w-4 h-4` |
| 標題圖標 | 20px | `w-5 h-5` |
| 裝飾圖標 | 24-32px | `w-6 h-6` / `w-8 h-8` |

### 6.3 禁止使用

- 禁止在按鈕或操作元素中使用 emoji
- 裝飾性文字（如空狀態）可酌情使用 emoji

---

## 7. 動畫與互動

### 7.1 過渡效果

統一使用 `transition-all duration-200` 或 `transition-all duration-300`

### 7.2 Hover 效果

| 效果 | 適用場景 | 實現方式 |
|------|----------|----------|
| 放大 | 按鈕、可點擊卡片 | `hover:scale-105` |
| 陰影增強 | 卡片 | `hover:shadow-xl` |
| 背景變色 | 列表項目 | `hover:bg-gray-50` |

### 7.3 動畫選擇

- **CSS Transition** - 簡單的 hover、focus 效果
- **Framer Motion** - 進場動畫、複雜序列動畫
- **不要混用** - 同一元件只使用一種方式

### 7.4 拖曳反饋

```jsx
/* 拖曳中狀態 */
.task-card.dragging {
  opacity: 0.9;
  transform: rotate(5deg) scale(1.08);
  z-index: 9999;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
}
```

---

## 8. 回饋機制

### 8.1 操作確認

| 操作類型 | 確認方式 |
|----------|----------|
| 新增 | 直接執行，顯示成功提示 |
| 編輯 | 直接執行，顯示成功提示 |
| **刪除** | **必須顯示確認對話框** |
| 批量操作 | 顯示確認對話框 |

### 8.2 錯誤處理

```jsx
<div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
  <div className="flex items-center gap-3">
    <div className="w-8 h-8 bg-red-500 rounded-xl flex items-center justify-center">
      <AlertCircle className="w-4 h-4 text-white" />
    </div>
    <span className="text-red-700 font-medium">{errorMessage}</span>
  </div>
</div>
```

### 8.3 載入狀態

```jsx
<div className="flex items-center justify-center py-8">
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
  <span className="ml-3 text-gray-600">載入中...</span>
</div>
```

---

## 9. 無障礙設計

### 9.1 鍵盤支援

- Modal 必須支援 `ESC` 關閉
- 可聚焦元素必須有 `focus` 狀態
- Tab 順序應符合視覺順序

### 9.2 對比度

- 正文文字對比度 ≥ 4.5:1
- 大標題對比度 ≥ 3:1
- 避免使用純色彩傳達訊息

---

## 10. 檢查清單

開發新功能前，請確認：

- [ ] 色彩使用符合規範的漸層或主題色
- [ ] 圓角使用統一的 `rounded-xl` / `rounded-2xl` / `rounded-3xl`
- [ ] 按鈕 hover 效果統一（CSS 或 Framer Motion 擇一）
- [ ] 圖標來源為 Lucide React
- [ ] 刪除操作有確認對話框
- [ ] Modal 支援 ESC 關閉
- [ ] 載入和錯誤狀態有適當顯示

---

## 更新記錄

| 日期 | 版本 | 變更內容 |
|------|------|----------|
| 2026-01-14 | 1.0.0 | 初始版本，基於現有專案分析建立 |
