# Plume Light · 貨艙壓力看板

React + Vite 子工程。開發時獨立運行；生產靜態包掛到主站原營運入口。

## 開發

```bash
# 從倉庫根目錄
./start-kanban.sh
# 或
npm run dev
```

預設 <http://127.0.0.1:5173/>。

## 掛到主站（`pages/operations.html`）

```bash
npm run build
```

產物寫入 `pages/hold-pressure/`。主站導航的 [營運看板](../pages/operations.html) 會跳轉到該目錄。舊靜態營運頁備份在 `archive/operations-legacy.html`。

## 測試

```bash
npm test
```
