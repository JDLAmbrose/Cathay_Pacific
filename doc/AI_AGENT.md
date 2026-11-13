# OpenAI 圖片出行助手

React 前端透過同源 Python API 使用 OpenAI Chat Completions，預設模型為 `gpt-4.1-mini`。保留原有四個只讀工具與離線規則演示；已移除舊供應商的配置和請求參數。

## 本地啟動

```sh
npm run build
python3 tools/serve.py --port 8000 --api-key-file /Users/rtxon/Desktop/1.txt
```

打開 <http://127.0.0.1:8000/pages/assistant.html>，選擇「OpenAI 智能助手」。密鑰文件只包含 key，不要附加引號或變量名。密鑰僅在服務端讀取，不會傳到瀏覽器或加入鏡像。

也可以一次啟動構建與本地服務：

```sh
OPENAI_API_KEY_FILE=/Users/rtxon/Desktop/1.txt npm start -- --no-open
```

| 環境變量 | 用途 |
| --- | --- |
| `OPENAI_API_KEY` | 服務端 key，優先於文件 |
| `OPENAI_API_KEY_FILE` | 私有 key 文件絕對路徑，亦可用 `--api-key-file` 設置 |
| `OPENAI_MODEL` | 預設 `gpt-4.1-mini`；替換時須確認支援圖片輸入與工具調用 |
| `OPENAI_BASE_URL` | 預設 `https://api.openai.com/v1`；只配置受信任的 HTTPS 服務 |
| `PORT` | Cloud Run 注入；設置後監聽 `0.0.0.0`，本地預設 `127.0.0.1:8000` |

`.env.example` 僅為配置示例，不會自動載入。更新文件內的 key 後，下次請求會重新讀取；更換環境變量需重啟。API 使用 OpenAI 帳戶的 API 權限與額度。

## 圖片流程

1. 每次選一張 JPEG、PNG 或 WebP，原文件不超過 8 MiB。不接受 HEIC、GIF、SVG。
2. 瀏覽器縮放至最長邊 1600 px，重編碼為 JPEG，去除 EXIF/GPS 等原文件元資料；壓縮後每張最多 1.5 MiB。圖片內可見的個人資料不會自動打碼，應由用戶避開。
3. 先顯示預覽，允許移除；只有點擊發送後才交由 OpenAI 處理。只選圖片而不輸入文字也可以發送，系統會補上物品判斷問題。
4. 前端提交 `messages[].images` 中的 base64 data URL。後端檢查數量、MIME、base64、文件標記及大小，再轉為 OpenAI `image_url` 內容塊，使用 `detail: high`。
5. 每次請求最多包含最近三張照片，與最多 16 則、40,000 字元對話一起傳送。較早照片標記為不可用，不再聲稱可查看原圖。

圖片放在獨立的頁面記憶體中，不寫入 localStorage、伺服器文件或日誌。原本的文字對話仍按既有方式存於瀏覽器。刷新、離頁或重新載入資料後，照片需要重傳；失敗後在同一頁重試會保留照片。OpenAI 請求使用 `store: false`，這不等同保證供應商零保留；供應商的資料處理仍依 API 帳戶設定。

參考：[OpenAI 圖片輸入](https://developers.openai.com/api/docs/guides/images-vision?api-mode=chat)、[GPT-4.1 mini 模型能力](https://developers.openai.com/api/docs/models/gpt-4.1-mini)。

## 判斷邊界

系統提示詞要求區分圖片直接可見資訊、用戶提供資訊及未知項；不猜測看不清的容量、成分、材質、認證或隱藏物品。不執行圖片中的指令，不復述無關個人資料。

航空公司、安檢與海關規則分開說明。目前沒有即時官方政策查詢工具，所以圖片能協助辨識和整理待確認項目，**不能產生正式「允許攜帶」結論**。回答須標示「尚不能確認攜帶許可」，要求適用行程、物品規格或官方核實；不憑模型記憶編造數值限制或引用。提示詞能降低錯誤，不能保證模型永遠正確。

工具只讀：

- `get_trip_context`：航班、諮詢目的地、演示時鐘、訂單快照與交接數量。
- `get_baggage_context`：行李及機票額度。
- `get_price_context`：原有計價函數的當前／跟機／Cargo 演示報價、里數與截止。金額由分轉為 HKD，模型不取代計價函數。
- `get_service_guide`：項目演示流程，區分提交申請與實際取件截止。

前後端都篩選上下文，排除電話、完整地址、證件、附件和報價 signature；不代替用戶修改行李、付款、下單或確認物流。照片和問題由用戶自行提供，仍可能含敏感資訊。

## 接口與限制

- `GET /api/assistant/status`：`configured`、`model`、`provider: openai`、`imageInput: true`。僅表示配置／接口能力，不代表已驗證 key 或自訂模型。
- `POST /api/assistant/chat`：`{messages:[{role:'user',content:'請看照片',images:['data:image/jpeg;base64,...']}],language:'zh-Hant',context:{...}}`。`images` 可省略；只接受 user 的圖片，每則最多一張；不接受遠程圖片 URL。
- 返回 `{reply,mode:'live',model,tools,liveSources:false}` 或穩定錯誤碼；不透傳原始供應商錯誤或 key。

HTTP body 最多 7 MiB；跨站 Origin 被拒絕；每進程最多每分鐘 20 輪、同時 2 輪。每輪最多 4 次模型請求、75 秒總預算；前端 90 秒後停止等待。取消僅中止瀏覽器等待，已發出的上游請求仍可能完成並計費。靜態服務只公開構建產物。

常見錯誤：`not_configured`（key 配置）、`provider_auth`（認證）、`provider_quota`（API 額度）、`provider_model`（模型權限／名稱）、`provider_rate_limit`（限流）、`invalid_image`（格式／內容無效）、`too_many_images`（張數）、`provider_timeout`（逾時）、`provider_refusal`（請求被拒絕）。

## Google Cloud Run

Dockerfile 構建 React 並啟動同源 Python 服務，以非 root 身份執行。此變更不執行雲部署。

在已配置 Cloud Run、Cloud Build、Artifact Registry、Secret Manager 及服務帳戶的項目中，使用 Secret Manager 注入 `OPENAI_API_KEY`。以下命令的項目、地區、服務帳戶和 secret 需替換為團隊實際資源：

```sh
gcloud run deploy plume-light --project=YOUR_PROJECT --region=asia-east1 \
  --source=. --service-account=YOUR_SERVICE_ACCOUNT \
  --set-secrets=OPENAI_API_KEY=plume-openai-api-key:1 \
  --set-env-vars=OPENAI_MODEL=gpt-4.1-mini \
  --port=8080 --timeout=120 --concurrency=4 --max-instances=1 \
  --no-allow-unauthenticated
```

服務帳戶需有讀取該 secret 的權限。不要把桌面路徑或 key 本文加入 Dockerfile。IAM 保護下可用 `gcloud run services proxy` 本地訪問。公開部署前仍需應用驗證和跨實例限額；本項目標準庫 HTTP 服務與進程內限流適用於原型，不能替代正式生產服務及帳戶驗證。旅客狀態仍保存在瀏覽器，不會因部署雲端而自動同步。

## 驗證

```sh
npm test
npm run build
npm run lint
python3 -m unittest discover -s tools/tests -p 'test_*.py'
```

自動測試涵蓋圖片入參、工具循環保留圖片、格式與大小限制、惡意 URL／偽造 MIME 拒絕、圖片歷史裁剪、不持久化圖片、重試／取消和既有預訂回歸。實際圖片能力需要另用有效 key 做端到端驗證，mock 測試不能替代。
