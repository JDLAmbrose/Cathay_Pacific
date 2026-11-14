# OpenAI 圖片出行助手

React 前端透過同源 Python API 使用 OpenAI Chat Completions，預設模型為 `gpt-4.1-mini`。提供五個只讀工具與離線規則演示；已移除舊供應商的配置和請求參數。

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

每輪請求都會把最新行程摘要直接加入系統提示詞 `CURRENT_TRIP_SNAPSHOT`，圖片識別不必先等模型調用工具。摘要包括航班／諮詢目的地、已申報行李總件數、取送服務件數、關聯行李、當前／跟機／Cargo 的 HKD 演示報價，以及獨立的已付款訂單快照。圖片回答先給結論，適用行程、件數與當前報價移至最後的「本次行程」callout。未知件數不當作零；無效報價只提供原因。更換諮詢目的地不改機票或價格，照片也不自動新增行李或重算費用。已知資料不再重複詢問；仍可調用只讀工具取得詳細資料。

系統提示詞要求區分圖片直接可見資訊、用戶提供資訊及未知項；不猜測看不清的容量、成分、材質、認證或隱藏物品。不執行圖片中的指令，不復述無關個人資料。

航空公司、安檢與海關規則分開說明。現有海關工具讀取伺服器保存的官方資料摘要，不是即時查詢。圖片能協助辨識和比對已存條件，**不能產生正式「允許攜帶」結論**。回答須標示尚待確認的攜帶許可、資料日期與官方來源；不憑模型記憶編造數值限制或引用。提示詞能降低錯誤，不能保證模型永遠正確。

### 首行結論與條例 callout

物品入境／攜帶詢問的第一行使用 `## ✅ 可以入境 — 目的地（必要條件）`、`## ❌ 不可以入境 — 目的地（原因）` 或 `## ⚠️ 暫無法確認 — 缺少的關鍵資訊`；按用戶語言翻譯。前端顯示為加大加粗的綠／紅／黃色標題，不在結論前加入問候或行程摘要。

✅／❌ 必須依據本輪查到且未過複核期的適用海關摘要，正文引用相同官方 URL 和核查日期。無來源、過期、未覆蓋或無法辨識必要資訊時用 ⚠️；未知不等於禁止。海關入境判斷不代替航空公司或安檢許可，必要條件直接寫在標題裡。後端會擋住缺少已檢索來源／日期的是非標題，要求改寫一次；流式展示也先完成這項檢查。此檢查只確認來源存在，不證明模型已正確適用全部條文。

後續使用 `> [!IMPORTANT]`（規定與適用條件）、`> [!NOTE]`（官方來源／行程）、`> [!WARNING]`（尚需確認）、`> [!TIP]`（下一步）卡片。來源卡片包含可點擊官方連結、核查日期與已存摘要說明，不編造法條號碼。前端僅解析限定格式、粗體及 HTTPS 連結；HTML 保持轉義，腳本、data URL、相對地址及帶帳密的連結不會變成可點擊連結。普通聊天保留原有流程。

提示詞格式設計參考 [OpenAI Prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering)。本次真實測試覆蓋香港至大不列顛的肉製品禁止案例、日本合理自用舊衣物案例，以及缺少航空規則的電池圖片；分別返回 ❌、✅、⚠️，均有 callout，前兩者含已查來源和日期。

工具只讀：

- `get_trip_context`：航班、諮詢目的地、演示時鐘、訂單快照與交接數量。
- `get_baggage_context`：行李及機票額度。
- `get_price_context`：原有計價函數的當前／跟機／Cargo 演示報價、里數與截止。金額由分轉為 HKD，模型不取代計價函數。
- `get_service_guide`：項目演示流程，區分提交申請與實際取件截止。
- `get_customs_policy`：按 `destination`（`current`／`GB`／`CN`／`JP`／`HK`／`AU`）及可選 `topic`（`all`／`general`／`food`／`medicine`／`duty_free`／`restricted`）讀取已存海關摘要。`current` 優先使用諮詢目的地，未指定才使用機票目的地；不能識別時要求補充，不套用其他地區。

## 已存海關政策庫

資料檔為 `tools/data/customs_policies.json`，讀取模組為 `tools/customs_policy.py`。首版 `2026-11-14.1` 核查於 **2026-11-14**，包含五個目的地、17 條摘要及 12 個官方來源頁。這是精選入境旅客指引摘要，不是法規全文或完整允許／禁止清單。中國內地與香港分開；GB 僅覆蓋英格蘭、蘇格蘭、威爾斯，不適用北愛爾蘭。

每條規則附來源 ID，每個目的地提供官方標題、URL、適用範圍及缺口。AI 回答需引用實際查到的 URL 和核查日期，不得稱為剛剛查到的即時政策。未覆蓋類別返回 `not_covered`；資料不可讀返回 `unavailable`；未知目的地返回 `destination_required`，均不表示允許。核查超過 30 天會回傳 `review_due: true`，這是內部複核提醒，不是法規到期日。**沒有自動更新排程**；更新須重新核對來源、修訂摘要與版本／核查日期，再發布。

| 目的地 | 已收錄重點 | 官方來源示例 |
| --- | --- | --- |
| 英國（大不列顛） | 申報、其他物品免稅額、按來源地區分的肉奶限制 | [GOV.UK](https://www.gov.uk/bringing-goods-into-uk-personal-use) |
| 中國內地 | 合理自用、紅綠通道、檢疫申報、分離運輸 | [海關總署第276號令政府轉載](https://www.hunan.gov.cn/zqt/zcsd/202502/t20250219_33590491.html) |
| 日本 | 申報、個人物品免稅、檢疫、個人藥品 | [Japan Customs](https://www.customs.go.jp/english/summary/passenger.htm) |
| 中國香港 | 紅綠通道、煙酒免稅、食品管制 | [香港海關](https://www.customs.gov.hk/en/service-enforcement-information/passenger-clearance/faqs/index.html?print=1) |
| 澳大利亞 | 一般物品免稅、生物安全申報、產品條件核查 | [ABF](https://www.abf.gov.au/entering-and-leaving-australia/duty-free)、[DAFF](https://www.agriculture.gov.au/travelling/bringing-mailing-goods) |

後端工具只讀固定路徑，不接受模型指定 URL 或文件路徑；不把政策資料放進前端可修改的行程狀態。Docker、Cloud Build 和預覽包均須包含該模組及資料目錄。海關稅額與平台服務報價不同，庫中不提供航空鋰電池／液體安檢限額，也不把旅客免稅額直接套用至商業 Cargo。

針對實測出現的無來源 Wh 攜帶限額，後端另有窄範圍文字檢查：命中後要求模型修正一次；仍命中則回傳 `unverified_policy`，不展示該答案。此檢查只涵蓋特定數值表述，不是完整的事實驗證或提示注入防護。

前後端都篩選上下文，排除電話、完整地址、證件、附件和報價 signature；不代替用戶修改行李、付款、下單或確認物流。照片和問題由用戶自行提供，仍可能含敏感資訊。

## 流式回覆與處理動效

前端以 `Accept: text/event-stream` 向同一個聊天接口發送 POST。普通對話的 OpenAI 請求使用 `stream: true`，後端重組工具調用片段，僅傳送公開回答文字與處理狀態，不傳模型內部推理、工具參數或原始錯誤。格式依據 [OpenAI Chat Completions streaming events](https://developers.openai.com/api/reference/resources/chat/subresources/completions/streaming-events) 及 [Function calling](https://developers.openai.com/api/docs/guides/function-calling)。

- SSE 事件：`status`（thinking／reading_image／checking／tool）、`delta`（text）、`reset`、`done`（完整 result）及 `error`（穩定錯誤碼）。傳輸開始前的驗證錯誤仍使用 HTTP JSON 錯誤。
- 回答按完整短句逐段送出，保留未完成句子，以便原有 Wh 限額檢查在文字顯示前執行。命中後重新生成，不把未核實的數值句子提前展示；這仍不是完整政策正確性保證。工具輪次或修正時清除暫存段落。
- 三點動效及光標表示正在處理；查看圖片、結合工具資料時顯示對應文案。支援五種語言，遵循減少動態效果設定。閱讀較早訊息時不強制滾回底部。
- 部分文字只在頁面記憶體顯示，只有收到 `done` 且行程仍一致才保存。中斷、超時、取消、新對話或切換行程會丟棄未完成回覆；不自動重發收費請求。
- 沒有 SSE Accept 的既有呼叫仍返回一般 JSON。
- 本地真實 OpenAI 加海關工具測試：首段 3.879 秒、完成 5.526 秒、14 個文字事件；這是單次測量，不是延遲保證。

## 接口與限制

- `GET /api/assistant/status`：`configured`、`model`、`provider: openai`、`imageInput: true`。僅表示配置／接口能力，不代表已驗證 key 或自訂模型。
- `POST /api/assistant/chat`：`{messages:[{role:'user',content:'請看照片',images:['data:image/jpeg;base64,...']}],language:'zh-Hant',context:{...}}`。`images` 可省略；只接受 user 的圖片，每則最多一張；不接受遠程圖片 URL。
- 返回 `{reply,mode:'live',model,tools,liveSources:false}` 或穩定錯誤碼；不透傳原始供應商錯誤或 key。

HTTP body 最多 7 MiB；跨站 Origin 被拒絕；每進程最多每分鐘 20 輪、同時 2 輪。每輪最多 4 次模型請求、75 秒總預算；前端 90 秒後停止等待。取消會中止瀏覽器讀取；後端在後續寫入偵測斷線後關閉當前上游連線，不繼續工具輪次。上游尚未回傳時，偵測斷線可能延後，已處理用量仍可能計費。靜態服務只公開構建產物。

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
