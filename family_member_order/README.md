# Plume Light 家長端

本原型沿用參考專案的原生 **HTML、CSS、JavaScript**、品牌資產、導航及頁尾樣式，提供家庭互聯、行李代填、授權追蹤及家庭權益。新增家長頁支援繁體中文與英文，共享文案檔仍保留原專案五語資料。

參考專案：[JDLAmbrose/Cathay_Pacific](https://github.com/JDLAmbrose/Cathay_Pacific)  
基準 commit：`c5617cbeff64cc65df07e07ee057d84e484b16b7`

## 1. 本地啟動

不需要 Node.js、npm 或前端建置工具，準備 Python 3 即可。

1. 解壓縮 ZIP，在 VS Code 使用 **File → Open Folder** 開啟解壓後資料夾。
2. Windows 可直接雙擊 **Start_Parent.bat**，或在 VS Code 的 **Terminal → New Terminal** 執行：

```powershell
py tools/serve.py --port 8000
```

macOS / Linux 可使用：

```bash
python3 tools/serve.py --port 8000
```

3. 開啟 [http://127.0.0.1:8000/](http://127.0.0.1:8000/)。停止伺服器時按 **Ctrl+C**。若連接埠被佔用，改用 `--port 8001` 並開啟相應網址。

ZIP 的網站檔案放在根目錄；部署 checkout 則放在 `dist/`。`tools/serve.py` 會自動辨識兩種結構。建議透過伺服器瀏覽，以保持跨頁資料儲存一致。

## 2. 預填資料與演示流程

家長為 **May Chen／Silver**。會員、行程、行李及交易均為演示資料。

| 成員 | 初始狀態 | 適合展示 |
|---|---|---|
| Lin Chen | 已互聯，未授權追蹤 | 完整四步代填及獨立授權 |
| Alex Chen | 已互聯、已授權，有進行中訂單 | 直接查看行程概覽 |
| Emily Chen | 邀請表單已預填，尚未互聯 | 邀請、接受及新成員代填 |

### 行李代填

選擇 Lin 的「代填行李」，依次完成 **信息預留 → 行李預報 → 價格計算 → 確認結算**。四步直接復用原專案元件；如計價提示需要額外行李額，先處理提示，再核對資料及完成演示付款。

付款不會自動取得查看權限。Lin 尚未授權時，付款後的行程頁仍顯示等待授權。

### 家庭互聯與授權

使用 Emily 的預填表單：選擇會籍號碼、已登記手機或電郵其中一項，再填姓名及關係。點擊「確認資料」，核對彈窗並確認發送；邀請先顯示為「待接受」。

點擊「預覽邀請內容」，從受邀成員視角接受或婉拒。接受後關係才建立；進度分享是另一項可選同意，不勾選也可以允許家長代填。

新成員接受後會取得**獨立的演示機票及行李草稿**，方便立即連續展示四步流程。這不代表查到真實機票，也不會沿用另一位成員正在編輯的行李。

未授權時，可在家長端點擊「請求查看授權」，再預覽成員確認頁。受邀者亦可由完成頁管理分享：開啟後可查看進度；關閉後重新鎖定，家庭關係與代填仍保留。邀請與授權預覽須在同一瀏覽器使用，目前不會寄出真實電郵。

### 家庭權益

包含家庭里程碑、同行優惠碼、五級會員表格及有獨立標題的常見問題。五級為 **Green、Silver、Gold、Diamond、Diamond Exec（2027 年起）**，表頭使用不同底色，並標示家長目前會籍。同行優惠使用 promo code；訂票按鈕連往國泰官網。表內福利為 Hackathon 擬議內容。

## 3. 檔案位置

下表以 ZIP 根目錄為準；部署 checkout 中的網站檔案位於 `dist/`。

| 路徑 | 用途 |
|---|---|
| `index.html` | 家庭互聯首頁 |
| `pages/information.html`、`baggage.html`、`pricing.html`、`checkout.html` | 四步代填；均位於 `pages/` |
| `pages/journey.html`、`pages/benefits.html` | 行程概覽及家庭權益 |
| `pages/invitation.html`、`pages/authorization.html` | 受邀者接受與分享管理 |
| `pages/assistant.html` | 從行李項目進入的原有助手 |
| `assets/styles.css`、`assets/i18n.js`、品牌資產 | 保留原檔 |
| `assets/family-core.js`、`family-app.js` | 家庭資料、頁面與互聯授權；均位於 `assets/` |
| `assets/family-booking.js`、`family-benefits.js` | 代填適配及權益；均位於 `assets/` |
| `assets/family.css`、`family-booking.css`、`family-benefits.css` | 家長新增樣式；均位於 `assets/` |
| `tools/serve.py` | 本地伺服器 |

## 4. 日後與學生端合併

建議先在學生專案新增 **parent/** 子資料夾，放入本次網站檔案並保留 `index.html`、`assets/`、`pages/` 結構，再增加連往 `parent/index.html` 的入口。這樣可保留學生根首頁，並在獨立分支提交與審閱。

若進一步共用同一套 assets，保留三個接入點：

| 檔案 | 接入點 |
|---|---|
| `app.js` | `ROOT_PREFIX` 優先讀取 `body.dataset.rootPrefix` |
| `app.js` | 有 `data-family-view` 時跳過原學生頁的自動初始化與渲染 |
| `model.js` | 依 `data-family-view` 使用家長專用儲存鍵 |

保留家長 HTML 的 `data-page`、`data-family-view`、`data-root-prefix` 及 DOM 容器。JavaScript 順序為 `i18n → model → app → family-core → family-booking → family-benefits → family-app`；CSS 先載入原 `styles.css`，再載入三個 family 樣式檔。移動共用資產時，同步調整引用路徑。

## 5. 保存與重置

資料存在瀏覽器 localStorage，刷新後保留。同一瀏覽器的 `localhost`、`127.0.0.1` 及不同連接埠各有獨立資料。

需要恢復首次展示時，在開發者工具 **Application／應用程式 → Local Storage** 刪除以下兩鍵，再刷新；此操作會清除本機家長演示進度：

- `plume-light-family-links-v1`：成員、邀請、授權及表單。
- `plume-light-family-booking-v1`：行程、行李草稿及訂單。

網站沒有額外場景控制臺。

## 6. 接入正式服務

已驗證新成員接受、四步代填、付款後未授權鎖定、授權後顯示及撤回後重新鎖定的完整流程。

目前沒有真實會員查詢、郵件派送、付款或跨裝置同步。正式服務需接入會員登入與核驗、關係及訂單 API、授權紀錄與後端存取判斷，以及郵件派送。Python 伺服器供本地展示使用，不是上述業務後端。
