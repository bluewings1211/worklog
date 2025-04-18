# Worklog 工時管理系統

這是一個簡易的工時與任務管理系統，支援多專案、多任務類型、工時結算、拖曳排序等功能。前端採用 React，後端為 Node.js + Express + SQLite，並支援 Docker 一鍵部署。

## 主要功能

- 任務卡片可依狀態（未完成、進行中、已完成、Archive）分類
- 支援拖曳卡片於同一狀態下排序（自訂優先度）
- 支援拖曳卡片跨狀態移動
- 任務描述支援多行與自動偵測超連結
- 可管理專案代碼與任務類型（新增、刪除）
- 日曆檢視每日工時紀錄，並顯示總工時（不足 8 小時紅底，達標綠底）
- 一鍵結算本日工時，並可複製 JSON
- 支援工時資料的即時同步與樂觀 UI 更新
- 支援 Docker 化部署

## 專案結構

```
worklog/
├── Dockerfile                # Docker 建置腳本
├── LICENSE                   # MIT 授權
├── package.json              # 後端相依
├── README.md                 # 專案說明
├── server.js                 # Node.js/Express/SQLite 後端
├── data/
│   └── worklog.db            # SQLite 資料庫
├── frontend/
│   ├── package.json          # 前端相依
│   ├── public/               # 靜態資源
│   └── src/                  # React 前端原始碼
```

## 安裝與啟動

### 1. Docker 一鍵部署

```bash
docker build -t worklog-app .
docker run -p 3000:3000 -v $(pwd)/data:/app/data worklog-app
```

- 啟動後，瀏覽器開啟 http://localhost:3000 即可使用（前後端皆同一 port）
- SQLite 資料會保存在本機 data 目錄

### 2. 手動本地開發

#### 後端
```bash
npm install
node server.js
```

#### 前端
```bash
cd frontend
npm install
npm start
```

前端預設 http://localhost:6689，後端 http://localhost:3000。

## API 端點

- `GET /api/todos`：取得所有任務
- `POST /api/todos`：新增任務
- `PUT /api/todos/:id`：更新任務
- `PATCH /api/todos/order`：批次更新任務順序
- `DELETE /api/todos/:id`：刪除任務
- 其他：`/api/project_codes`, `/api/task_types`, `/api/summary/today` 等

## 其他說明

- 首次啟動會自動建立預設專案代碼與任務類型
- 拖曳排序後順序會即時儲存
- 日曆與結算畫面皆會顯示總工時提示
- Express 已正確設定 SPA fallback，API 路徑不會被 React 靜態頁面攔截
- 專案採用 MIT License

---

如需更多細節，請參考原始碼註解或提出 issue！
