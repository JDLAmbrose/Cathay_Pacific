<p align="center">
  <img src="assets/plume_light_logo_horizontal.svg" alt="Plume Light" width="380">
</p>

# 泰易送 · 翼隨行 — Plume Light

Plume Light 是為 Cathay Hackathon 製作的行李服務原型。旅客可以在出發前申報行李、查詢攜帶規則、安排取送及查看交接進度。家人可按旅客授權協助預訂，營運人員則可透過貨物與用戶看板查看演示數據。

主站採用 **React 19、TypeScript 和 Vite**，保留各功能頁的獨立網址。預設場景是留學生 Lin Chen 搭乘 CX257 由香港前往倫敦希思羅，部分行李送往 LSE 宿舍。機票、會員、付款、物流及看板數據均用於演示。

[快速開始](#快速開始) · [多頁面設計與流程](#多頁面設計與流程) · [家庭互聯與權益](#家庭互聯與權益) · [營運看板](#營運看板) · [開發與部署](#開發與部署)

## 快速開始

### 一鍵啟動完整演示

安裝 **Node.js 24 LTS** 和 **Python 3.9+**。下載或 clone 完整倉庫後，在根目錄執行：

```sh
npm start
```

macOS 也可雙擊 [start.command](start.command)，或執行 `sh start.command`。Windows 可雙擊 [start.bat](start.bat)。

啟動腳本會在首次運行或鎖文件變更時用 `npm ci` 安裝依賴，然後構建 React 主站、打包兩個看板並啟動 Python 服務。首次安裝需要網絡。瀏覽器會開啟 [http://127.0.0.1:8000/](http://127.0.0.1:8000/)，在終端按 `Ctrl+C` 停止。

- 想自行開啟瀏覽器，可執行 `npm start -- --no-open`。
- 8000 已被佔用時，macOS / Linux 可執行 `PLUME_PORT=8001 npm start`，PowerShell 可先執行 `$env:PLUME_PORT = '8001'` 再執行 `npm start`。
- 沒有 OpenAI 密鑰時，進入「AI 出行助手」並選擇「離線規則演示」。啟用 OpenAI 的方式見 [AI 助手接入指南](doc/AI_AGENT.md)。

請透過 HTTP 開啟網站。首頁與各功能頁需要載入 JavaScript modules，直接雙擊 HTML 無法啟動。演示時請固定使用同一瀏覽器、主機名與連接埠，因為 `localhost`、`127.0.0.1` 和不同連接埠各有自己的瀏覽器資料。

### React 開發與熱更新

```sh
npm ci
npm run dev
```

開啟 Vite 終端列出的網址，預設為 [http://localhost:5173/](http://localhost:5173/)。如需 OpenAI 或模擬查件，另開終端執行 `python3 tools/serve.py --port 8000`，Windows 可使用 `py`。Vite 會把 `/api` 轉發至 `http://127.0.0.1:8000`，可透過 `PLUME_API_ORIGIN` 調整。使用 OpenAI 時，可在 Python 命令加上 `--api-key-file /path/to/openai-key.txt`。

### Docker 啟動

已安裝 Docker Compose 時，可從倉庫根目錄執行 `docker compose up --build`，再開啟 [http://127.0.0.1:8080/](http://127.0.0.1:8080/)。容器會構建前端並運行 Python API，主機只需 Docker。

## 多頁面設計與流程

`index.html` 與 `pages/*.html` 保留各頁的直達網址。旅客頁共用 React 入口、導覽與頁尾，站內切頁會更新瀏覽器網址和歷史。語言支援繁體中文、英語、法語、西班牙語與阿拉伯語，並提供大字模式、鍵盤操作與減少動畫設定支援。

以下路徑可接在本地服務網址後使用。

| 頁面 | 路徑 | 目前流程 |
| --- | --- | --- |
| 行程首頁 | `/` | 航班橫幅和主視覺按預約狀態顯示行李準備或行程入口。下方「家人協助 · 輕裝同行」與「出發前的瑣事，變簡單了」在寬屏上下對齊，右側四項等高、純展示，窄屏改為上下排列。頁底提供三組虛構旅客故事。 |
| ① 乘機人 | `/pages/prepare.html` | 確認乘機人、票據免費托運額及未成年旅客提示。需要他人協助時，可查看入會與家庭互聯指引。 |
| ② 信息預留 | `/pages/information.html` | 分開填寫取件與送件資料。香港、大灣區其他覆蓋地區及出發國境內其他覆蓋地區的演示申請截止分別為起飛前 24、48、120 小時，取件時間另行校驗。 |
| ③ 行李預報 | `/pages/baggage.html` | 逐件填寫物品類別、重量及尺寸，區分全部托運預報和需要取送的行李。頁面提醒如實填報，因為資料會影響報價及上門核對。 |
| ④ 價格計算 | `/pages/pricing.html` | 以拖曳或鍵盤把行李分配到隨身、隨航班、Cargo 三個泳道。隨身件須填有效重量且低於 7 kg；跟機先核對票據免費額及超額加購，Cargo 按實重與體積重較高者逐件計價。 |
| ⑤ 確認結算 | `/pages/checkout.html` | 核對取送、運輸費及里數，模擬現金付款或里數兌換。完成後保存當時的訂單資料與報價。 |
| AI 出行助手 | `/pages/assistant.html` | 可從主導覽獨立進入。支援 OpenAI 多輪問答及離線規則樣本；OpenAI 透過只讀工具取得行程、行李、報價與服務資訊，離線清單建議需由旅客確認後回寫。 |
| 行程概覽 | `/pages/journey.html` | 查看訂單、模擬取消與退款，逐件確認到達機場、裝機與當地物流交接。全部服務行李完成當地交接後，Python API 可返回演示查件資料。 |
| 家庭專區 | `/pages/benefits.html`、`/pages/family.html` | 「家庭權益」展示里程碑與會籍方案；「家庭互聯」處理邀請、成員及行程權限。 |
| 營運看板 | `/pages/operations.html` | 從入口選擇「貨物」或「用戶」，可在看板內切換。 |

預訂頁共用草稿，但草稿、已提交預報和付款後的訂單各有自己的狀態。價格頁依當前行李配置重新計價，行程頁依交接事件更新，付款成功本身不會確認行李已裝機。可用頁尾的演示控制台切換留學生、兒童家庭、逾期或缺少尺寸等場景。

## 家庭互聯與權益

- **從乘機人頁開始。** 勾選由他人協助後，可查看國泰入會連結及家庭互聯指引。已有合適的互聯聯絡人時，可選擇聯絡人並記錄模擬協助請求。
- **從家庭專區建立關係。** 旅客或家人可發出邀請，使用會籍號碼、已登記手機或電郵識別對方。透過邀請預覽可在同一瀏覽器模擬接受或婉拒。成年旅客自行確認；兒童場景依演示會籍資料核對已關聯的合資格監護人。
- **按航段授權。** 協助預訂、付款和查看進度是三項獨立權限，綁定指定訂位和航段。家人獲准代填後，沿用「信息預留 → 行李預報 → 價格計算 → 確認結算」四步，付款仍需對應權限。可預覽成員視角、調整權限或撤回授權。
- **查看家庭權益。** 家庭里程碑以三筆符合資格、已完成的取送訂單為目標，同一筆訂單只計一次，已取消或退款的訂單不計入。探訪優惠資格另按家長或監護人關係及已完成的服務判斷，優惠碼來自演示配置。權益頁還展示 Green、Silver、Gold、Diamond 和 Diamond Exec（2027 年起）五級擬議福利。

邀請、會籍比對與同意確認使用本地演示資料。預覽不會發送真實郵件，也不會在不同裝置間同步。正式使用須接入會員驗證及後端權限管理。

## 營運看板

主站的「營運看板」先開啟選擇頁，再進入獨立的 React 看板子工程。

| 看板 | 本地直達路徑 | 建議操作 |
| --- | --- | --- |
| 貨物／貨艙壓力 | `/pages/hold-pressure/index.html` | 選擇航段、時間窗與重量或體積口徑，查看多航班壓力、告警和處置清單。點選航班查看貨艙佔用、Plume 行李缺口與可延後至同航段後班的方案，可推進演示時鐘或模擬貨量變化。 |
| 用戶／會員追蹤 | `/pages/hold-pressure/index.html?board=members` | 切換學期書籤與客群，對比入會、服務預訂及付費轉化、家庭互聯、會籍分布、收入與貢獻利潤、增量機票消費及優惠碼使用。 |

貨物看板以預置快照為基線。從主站保存有已知重量的 CX257 托運預報後，用同一瀏覽器和網址來源開啟或刷新看板，可查看該航班的 Plume 行李負載變化。未提交草稿與隨身行李不納入這項聯動。會員看板讀取獨立的模擬快照，主站新增訂單或邀請不會改寫其統計。看板的員工用途標示用於演示，尚無員工登入或後端存取控制。

**修改看板時**，可從根目錄另開 Vite，使用 5174 避免與主站衝突：

```sh
npm --prefix kanban-app ci
npm --prefix kanban-app run dev -- --port 5174
```

獨立開發網址有自己的瀏覽器資料；驗證旅客預報與看板聯動時，請使用主站的同源入口。修改看板源碼後，先執行 `npm --prefix kanban-app run build` 更新 `pages/hold-pressure/`，再執行根目錄的 `npm run build`，將選擇頁、兩個看板及快照一起複製到 `dist/`。

## 開發與部署

| 路徑 | 用途 |
| --- | --- |
| [src/main.tsx](src/main.tsx)、[src/App.tsx](src/App.tsx) | React 入口、共用版面及頁面切換 |
| [src/pages/](src/pages/)、[src/components/](src/components/) | 頁面元件、共用互動和 CSS Modules |
| [src/engine/booking.ts](src/engine/booking.ts)、[src/services/](src/services/) | 報價、訂單、家庭權限、里程碑、瀏覽器儲存與 API |
| [src/config/](src/config/) | 路徑、五語文案、演示資料與設計變量 |
| [kanban-app/](kanban-app/)、[pages/hold-pressure/](pages/hold-pressure/) | 營運看板源碼與靜態構建產物 |
| [tools/](tools/) | 啟動腳本、Python 靜態服務、OpenAI 及模擬查件 API |

旅客草稿、預報、訂單、家庭狀態與里數等資料保存在瀏覽器的 `plume-light-multipage-v2`，語言偏好保存在 `plume-light-language`。可從演示控制台重設場景。

```sh
npm test
npm run build
python3 -m unittest discover -s tools/tests -p 'test_*.py'
```

`npm run build` 會檢查 TypeScript 並產出完整的 `dist/`。可用 `npm run preview` 查看構建結果，或執行 `python3 tools/serve.py --port 8000` 同時提供網站與 API。看板子工程安裝依賴後可獨立執行 `npm --prefix kanban-app test`。

[GitHub Actions](.github/workflows/preview.yml) 會在 PR 中檢查並產出 `plume-light-preview`。下載並解壓該產物後，可用其中的 `preview.command` 或 `preview.bat` 啟動，只需 Python 3.9+。工作流另為 GitHub Pages 構建子路徑版本，`main` 的部署會提供主站與兩個靜態看板。Pages 不運行 Python API，助手可使用離線模式。需要 OpenAI 或查件 API 的部署方式見 [Cloud Run 指引](doc/AI_AGENT.md#google-cloud-run)。

延伸閱讀：[產品需求與演示設計](doc/Plume_Light_PRD.md) · [AI 助手接入](doc/AI_AGENT.md) · [貨艙壓力指標與規則](kanban/Kanban_Requirements.md) · [會員追蹤指標](kanban/Member_Kanban_Requirements.md) · [演示影片分鏡](doc/Plume_Light_Video_Storyboard_v2.2.md)

[授權條款](LICENSE)
