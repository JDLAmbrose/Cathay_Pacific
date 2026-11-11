# GLM 出行助手接入指南

此版本保留原生 HTML/JavaScript 前端，擴展現有 Python 服務為同源 API。無需 Node/npm、框架或 Python 第三方依賴。建議使用 Python 3.12+；Docker 使用 3.12。

## 本地啟動

在項目根目錄運行：

```sh
python3 tools/serve.py --port 8000 --api-key-file /Users/rtxon/Desktop/1.txt
```

打開 <http://127.0.0.1:8000/pages/assistant.html>。文件內容應只有 API key，不能包含引號、`API_KEY=` 或其他說明。密鑰文件留在網站目錄之外；不要把它加入 Git 或鏡像。

亦可通過服務端環境變量配置：

| 變量 | 用途 / 默認值 |
| --- | --- |
| `GLM_API_KEY` | 服務端密鑰；優先於文件配置 |
| `GLM_API_KEY_FILE` | 密鑰文件絕對路徑；`--api-key-file` 設置此值 |
| `GLM_MODEL` | 默認 `glm-5.3`，可換成帳戶支持的 GLM 型號 |
| `GLM_BASE_URL` | 默認 `https://open.bigmodel.cn/api/paas/v4`；必須為可信服務的 HTTPS 地址 |
| `PORT` | Cloud Run 注入；設置後默認監聽 `0.0.0.0`，否則 `127.0.0.1:8000` |

`.env.example` 僅列出配置項，不會自動載入；本地使用上述命令即可。模型或 endpoint 改動需重啟服務。文件中的 key 每次調用時讀取，因此替換文件內容後可直接重試。不要將密鑰放在 URL、前端變量或 `localStorage`。

GLM 接口採用[智譜官方 Chat Completions 協議](https://docs.bigmodel.cn/api-reference/模型-api/对话补全)。默認型號見 [GLM-5.3 文檔](https://docs.bigmodel.cn/cn/guide/models/text/glm-5.3)。使用通用模型 API 的 key 和可用額度；不能假定 Coding Plan 訂閱等於通用 API 額度。

## 助手的工作方式

```text
瀏覽器 /pages/assistant.html
  → POST /api/assistant/chat（問題、最近對話、白名單行程摘要）
  → Python agent → GLM
  ← GLM tool_calls → 執行白名單只讀工具 → GLM 組織回答
  ← 純文字回答、已查詢的工具名稱
```

四個工具分別讀取：

- `get_trip_context`：當前航班、諮詢目的地、演示時鐘、現有訂單及交接數量。
- `get_baggage_context`：行李清單、所選物品、機票額度、規則樣本狀態。
- `get_price_context`：現有計價函數產生的報價、全部跟機 / Cargo 對比、截止時間和里數。
- `get_service_guide`：項目服務流程及演示參數。

前端先篩選，後端再按 schema 篩選，排除聯絡人、電話、完整地址、證件、附件及報價內含私人資料的 `signature`。問題文字和行李名稱仍由用戶輸入，可能含私人資訊，因此頁面有發送說明。工具返回的資料標記為 `browser_demo`，不能當成後端認證的真實訂單。

**金額單位：**現有前端計價以分保存；發給 agent 前轉為 HKD。GLM 解釋計價結果，不代替計價函數。缺少重量/尺寸等會返回無效報價；不把未知值當零。全部跟機 / Cargo 是假設方案，並不更改目前選擇。詢問其他目的地不會改寫機票。

每次最多 16 則消息、40,000 字元歷史；單次問題最多 2,000 字元。最多 4 次模型請求，最後一次不提供工具；單次上游等待最多 35 秒，整輪預算 75 秒，前端等待最多 90 秒。取消只停止瀏覽器等待，已送出的模型請求可能仍執行至逾時。清空對話、切換模式或上下文變動不會將舊回答寫回新狀態。

助手沒有寫入工具；不會自動改行李、提交預訂、付款或確認物流。畫面提供行李、報價和行程入口，用戶在原有流程中自行確認。

目前沒有即時官方規則檢索、真實航班/物流、地圖或實際訂票 API。規範性問題會要求補充屬性並提示向官方核實。GLM 回答仍需人工判斷。離線規則演示保留原有規則卡片及建議確認流程；只有選擇離線模式或用 `file://` 打開時使用，不冒充 GLM 回答。

## API 與錯誤

- `GET /api/assistant/status`：返回 `configured` 和模型名。只檢查本地密鑰配置，不代表已驗證帳戶/額度。
- `POST /api/assistant/chat`：JSON `{messages:[{role:'user',content:'...'}],language:'zh-Hant',context:{trip:{},baggage:{},pricing:{}}}`；只接受 user/assistant 角色。成功返回 `{reply,mode:'live',model,tools,liveSources:false}`。
- 錯誤返回 `{error:'穩定錯誤碼'}`，不透傳上游原始內容或密鑰。已有 `/api/handover/tracking` 不變。

| 錯誤 | 處理 |
| --- | --- |
| `not_configured` / `invalid_configuration` | 檢查文件路徑、環境變量和 HTTPS endpoint |
| `provider_auth` | 檢查 API key 是否有效、是否屬於該 endpoint |
| `provider_subscription_expired` | 智譜錯誤 1309：套餐到期；續訂或更換可調用通用 API 的 key |
| `provider_quota` | 智譜錯誤 1113：檢查 API 帳戶餘額 |
| `provider_rate_limit` / `rate_limit` / `busy` | 等待後重試，或暫用離線模式 |
| `provider_timeout` / `incomplete_response` | 縮短問題後重試 |
| `provider_unavailable` | 檢查網絡、endpoint 和上游服務 |

HTTP 層限制請求大小 128 KiB，拒絕跨站 Origin，限制每進程每分鐘 20 次及同時 2 次模型任務。不採信轉發 IP。靜態服務只開放首頁、`assets/`、`pages/`；服務端程式、環境文件及 `.git` 不公開。GLM 回答作轉義純文字渲染，不執行 HTML。

## Google Cloud Run

已提供 Dockerfile：同一服務提供網頁和 API，使用 `PORT`，以非 root 用戶運行，無須前端修改 API 網址。這一輪沒有執行雲部署。

先在已啟用 Cloud Run、Cloud Build、Artifact Registry 和 Secret Manager 的項目中準備服務帳戶及 secret。以下是可供團隊按實際項目替換的命令，**不要直接保留佔位值**：

```sh
export PLUME_PROJECT_ID='your-google-cloud-project'
export PLUME_REGION='asia-east1'
export PLUME_KEY_FILE='/absolute/path/to/private-key.txt'

gcloud iam service-accounts create plume-agent --project="$PLUME_PROJECT_ID"
gcloud secrets create plume-glm-api-key --project="$PLUME_PROJECT_ID" \
  --replication-policy=automatic --data-file="$PLUME_KEY_FILE"
gcloud secrets add-iam-policy-binding plume-glm-api-key --project="$PLUME_PROJECT_ID" \
  --member="serviceAccount:plume-agent@${PLUME_PROJECT_ID}.iam.gserviceaccount.com" \
  --role='roles/secretmanager.secretAccessor'

gcloud run deploy plume-light --project="$PLUME_PROJECT_ID" --region="$PLUME_REGION" \
  --source=. --service-account="plume-agent@${PLUME_PROJECT_ID}.iam.gserviceaccount.com" \
  --set-secrets=GLM_API_KEY=plume-glm-api-key:1 \
  --set-env-vars=GLM_MODEL=glm-5.3 \
  --port=8080 --timeout=120 --concurrency=4 --max-instances=1 \
  --no-allow-unauthenticated
```

已存在的 secret 使用 `gcloud secrets versions add` 更新，並在部署時選用相應版本。部署權限、建置服務帳戶權限及費用由團隊的 Google Cloud 項目管理者配置。[Cloud Run Secret Manager 官方指引](https://cloud.google.com/run/docs/configuring/services/secrets)。

演示預設使用 IAM 保護服務。具有 invoker 權限的團隊成員可用本地代理訪問：

```sh
gcloud run services proxy plume-light --project="$PLUME_PROJECT_ID" --region="$PLUME_REGION" --port=8080
```

然後打開 <http://127.0.0.1:8080/>。不應把共用 GLM key 放到前端解決登入。公開賽事演示前應決定用戶驗證、全局額度與費用上限；目前的限流是單進程、重啟即清空，不能替代跨實例限額。Python 標準庫服務適合本次原型；正式公開服務需遷移到生產 HTTP/ASGI 服務、受控資料來源及持久化驗證。旅客狀態仍在瀏覽器 localStorage，雲端不自動提供多裝置同步。

## 驗證

```sh
python3 -m unittest discover -s tools/tests -p 'test_*.py'
node tools/tests/assistant.cjs
node tools/tests/pricing.cjs
node tools/tests/pricing-board.cjs
node tools/tests/booking-flow.cjs
node tools/tests/home-state.cjs
```

後端測試覆蓋工具循環、歷史、工具白名單、私隱欄位移除、請求限制、靜態隔離、跨站請求、上游錯誤和重定向保護。前端測試覆蓋金額單位、多輪、轉義、重試、取消、舊回覆隔離及五種語言。測試中的成功模型回覆是 mock；不能用作實際 GLM 成功調用的證明。

2026-11-10 已使用文件中的 key 完成真實 GLM-5.3 四輪對話，涵蓋航班/報價比較、申請截止、行李查詢及充電寶規格追問；四個只讀工具均有實際調用。標準端點的 `glm-4.7-flash` 當次返回 429 / 1305（訪問量過大）；`glm-4.7` 被上游映射為 `glm-5.3-flash`。預設模型已改為 `glm-5.3`，仍可透過環境變量覆蓋。早前 1309 是當時的上游響應，不能據此推斷目前團隊套餐狀態。

團隊套餐、個人套餐與標準 API Key 的用途分開管理，不能僅憑請求成功就推斷套餐適用於任意產品。Coding Plan 的官方 OpenAI 相容端點為 `https://open.bigmodel.cn/api/coding/paas/v4`，但套餐限指定工具與產品環境。當次只用此端點作短連通性診斷，網站預設仍為標準端點。正式出行助手 / Cloud Run 部署應使用適用的標準 API Key，或由智譜確認企業授權範圍。參見 [Key 分類管理](https://docs.bigmodel.cn/cn/coding-plan/notice/api-key-management)及[官方適用工具](https://docs.bigmodel.cn/cn/coding-plan/tool/others)。

更新後的本地 HTTP API 又完成三輪真實測試，均返回 200 / `glm-5.3`：查詢報價及截止（21.4 秒，行程/報價/服務規則工具）、關聯行李查詢（16.3 秒，行李工具）、對話屬性回憶（2.1 秒，正確保留「一個、74Wh、鋰離子」）。測試場景為 3 件服務行李，跟機 HKD 1,800、Cargo HKD 1,950；香港申請截止 2026-11-14 09:30，實際取件截止同日 21:30。這些是演示資料，不代表真實航班規則。模型的攜帶建議仍未經官方檢索核實。
