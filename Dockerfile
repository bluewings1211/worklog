# --- build 前端 ---
FROM node:20 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install
COPY frontend ./
RUN npm run build

# --- build server ---
FROM node:20 AS server
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .

# 複製前端 build 結果到 server 靜態目錄
RUN rm -rf ./frontend/build && mkdir -p ./frontend/build
COPY --from=frontend-build /app/frontend/build ./frontend/build

# 預設資料庫目錄
RUN mkdir -p /app/data

EXPOSE 3000
CMD ["node", "server.js"]
