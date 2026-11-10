# 貨艙壓力看板 · 工程任務（v0.5）

對齊：[Kanban_Plan.md](./Kanban_Plan.md)（口徑、公式、模擬數據、術語的**唯一來源**）· [Kanban_Requirements.md](./Kanban_Requirements.md)（Q1–Q3）· 線框 `images/01_overview.png`、`images/02_flight_detail.png` · 素材 **Plume_Light_协作启动包**（工作區第二目錄；品牌 / 色板 / 員工簽 / 旅客預報契約，見 §0.1）

代碼質量：`aaron-python-formatted` 的工程原則（**Readable → Modular → Robust → Testable → Automated**）。TypeScript / React 用該語言慣例；Python / Django 用 Python 慣例。**業務規則不在此處重寫**——實現時讀 Plan，不要發明口徑。

**本期範圍**：M1–M3（JSON 驅動的 React 看板）。**M4 Django 不在本期實作**，只保留 `DataSource` 接口，切換時 UI 零改動。

---

## 0. 怎麼用這份文件

按 T1 → T8 順序做。每個 Task 結束時必須滿足該節的 **完成標準**（可檢查、可跑通），再進入下一個。公式與七班斷言以 Plan §4 / §7 為準。

未寫明的細節用下列默認，並在 PR / 提交說明裡標出假設：

| 未寫明項 | 默認 |
|---|---|
| 裝機截止（之後不可 `DEFER`） | 起飛前 3 小時 |
| 路由 | 兩視圖狀態切換（`overview` / `detail`），不加 `react-router` |
| 樣式 | CSS Modules（每組件一檔）+ `styles/tokens.css`；不加 Tailwind / CSS-in-JS |
| 時區 | 全部時間 `Asia/Hong_Kong`（UTC+8） |
| 語言鍵 | 與主站共用 `localStorage` 鍵 `plume-light-language`；看板只認 `zh-Hant` / `en`，其他值回退 `zh-Hant` |

允許依賴：`react`、`react-dom`、`vite`、`typescript`、`@floating-ui/react`、`@tanstack/react-query`、`vitest`。不加 Recharts / ECharts / i18next / react-router。

### 0.1 協作啟動包：用什麼、不用什麼

包路徑（工作區第二目錄）：`Plume_Light_协作启动包/`。倉庫內已有**同一批品牌檔**的副本：`plume-light-demo/assets/`。複製時**優先用倉庫 `assets/`**（與當前旅客站一致）；若該檔缺失，再從啟動包 `品牌与人物素材/` 取。啟動包日期 2026-11-05，**舊於**當前倉庫；業務口徑以 Plan 為準，不以包內舊營運頁為準。

| 用 | 來源 | 放到看板哪裡 |
|---|---|---|
| Logo（淺底） | `品牌与人物素材/plume_light_logo_horizontal.svg` | `kanban-app/public/brand/`；淺色區 |
| Logo（反白） | `…/plume_light_logo_horizontal_reversed.svg` | 深綠頂欄（`--deep` / `#02544f`） |
| 圖標 / favicon | `…/plume_light_icon.svg` | `index.html` favicon + 小標 |
| 羽毛（可選） | `…/plume-feather.png` | 僅當需要小裝飾；不當主 Logo |
| 國泰刷翼（反白） | `…/cathay-brushwing-white.png` | 頂欄「CATHAY PACIFIC」側標，可選 |
| 色板與字體 | `01_素材包与协作规范.md` + `视觉与文案基线/styles.css` 的 `:root` | `src/styles/tokens.css`（**只抽變量，不整份拷貝 CSS**） |
| 員工簽文案 | `视觉与文案基线/i18n.js` 的 `ops.badge` / `nav.ops` **繁中 + EN 兩列** | T2 字典 `kb.staffOnly`、`kb.navTitle` |
| 語言鍵 | 同檔 `plume-light-language` | 已與 §0 默認一致 |
| 旅客預報契約 | `网页源码快照/assets/model.js` 的 `KEY`、`declarations`、件欄位 | T4 `JsonDataSource` 覆蓋 CX257 |
| 演示場景卡 | `01`「共用演示場景卡」：CX257 · HKG→LHR T3 · Lin | 與 Plan 航段一致；**不改** Plan §7 七班種子 |
| 表達紅線 | `00` 第 1–4 條、`02` 員工看板 / 航司同步 / 零超載 | 文案與 SYNC 燈；見下「禁止宣稱」 |

| 不用 | 原因 |
|---|---|
| `网页源码快照/pages/operations.html` 及舊 KPI（覆蓋率 / 餘量） | 舊營運頁；新看板按 Plan 重做 |
| 整份 `styles.css`、整份 `i18n.js` | 旅客站五語言 + 預訂樣式；看板只要 token + 繁中/EN |
| `traveller-student/child/access.png` | 旅客首頁人物，員工看板不用 |
| `cathay-brushwing.png`（深色） | 深綠頂欄用反白版即可 |
| `原始资料/`（docx、分鏡 v2.2） | 視頻與舊手冊；看板口徑在 Plan |
| 包內 `ops.budget = 5000` 等舊參數 | 那是旅客行李預算，**不是**機型 `CAP` |

**色板（寫進 `tokens.css`，數值來自啟動包，不是重設計）**

| token | 值 | 用途 |
|---|---|---|
| `--green` | `#02544F` | 主色、頂欄、ctl.on |
| `--deep` | `#043F39` | 更深頂條 |
| `--ink` | `#173F39` | 主文字 |
| `--muted` | `#6C8079` | 次要文字 |
| `--paper` | `#F6F8F5` | 頁底 |
| `--pale` | `#EAF3ED` | 選中淺底 |
| `--gold` | `#E4B46C` | 焦點環、強調（勿當警告色） |
| `--cream` | `#F3ECD9` | 輔助底 |
| `--line` | `#DCE6DE` | 邊框 |

狀態色啟動包沒有，沿用線框 `wf.css`：`--bad #d6453d`、`--warn #d99a12`、`--ok #2f9e6b`、`--off #9aa5a3`；堆疊段：商貨 `#2c5e5a`、乘客 `#8fb5b1`、Plume `#2f6fb5`。字體棧、`:focus-visible` 金框、`prefers-reduced-motion`、大字 `--text-scale: 1.15` 從啟動包 CSS 帶過來。圓角跟組件走（按鈕 8px、卡片 10–16px），**不**全局強制 `--radius: 20px`。

**CX257 預報映射（T4 必讀 `model.js`，不要猜）**

- 鍵：`localStorage['plume-light-multipage-v2']`，`schema === 1`
- 只讀 `declarations.*` 且 `status === 'submitted'`、`legId` / `flight.flightNo` 對上 `CX257`
- 草稿 `drafts`、`countUnknown`、未保存項 **不進入**看板（啟動包：未知 ≠ 0；未保存不進營運統計）
- 件：`weight == null` 不當 0，該件不計入重量或整筆標記缺失；有 `l,w,h` 則 `m3 = l*w*h/1e6`
- `mode === 'checked'` 且訂單/件為 Cargo → `BagMode = 'cargo'`；其餘托運 → `'on_flight'`
- **禁止**把 `state.ops.budget`（舊 5000 kg）當成機型 CAP

**禁止宣稱（啟動包 00 / 02，寫進文案與 SYNC 燈）**

- 員工簽 = 界面用途，**不是**登錄鑒權
- 「預報已保存，演示看板可讀取」，不是「已同步航司」
- 不寫「零超載」「杜絕二次卸貨」；80% 申報率不是本看板指標
- 商貨、重量、缺口均為**演示數據**

---

## 1. 質量門（每段代碼都過）

### 1.1 五步流向

每個功能按這個順序寫，I/O 與計算不相混：

1. **邊界校驗** — JSON / API / `localStorage` / 營運覆寫：缺欄、負重量、未知機型顯式失敗或標 `CARGO_UNK`，不靜默當 0。
2. **標準化** — 轉成 `types/kanban.ts` 的具名型別；時間統一 HKT。
3. **純計算** — `engine/` 全是無副作用函數：不讀 `window`、不碰 DOM、不 `fetch`、不改入參。
4. **I/O 適配** — 只有 `services/` 讀文件或打 API。組件不寫 `fetch`。
5. **單一職責組件** — 一個視覺區域一個組件。頁面檔只組裝，不畫 SVG、不算 LOAD。

拆分條件（滿足任一即拆，**不是**按行數切）：職責超過一個視覺區域；SVG 座標計算與 JSX 擠在一起；同一檔既算業務又渲染；出現第二個可獨立測試的規則。一個連貫函數可以較長；十個只為「變短」的碎片函數不要寫。

### 1.2 命名（契約的一部分）

| 語言 | 變量 / 函數 | 組件 · 型別 · 異常 | 模塊常量 |
|---|---|---|---|
| TypeScript / React | `camelCase`（`calculateHoldLoad`） | `PascalCase`（`FlightBarColumn`） | `UPPER_SNAKE_CASE`（`CAUTION_RATIO = 0.9`） |
| Python | `snake_case` | `PascalCase` | `UPPER_SNAKE_CASE` |

布爾讀起來像條件：`isCargoUnknown`、`hasVolumeBottleneck`、`canAcceptDeferral`。

JSON 欄位與 TS 欄位用**完整領域名**，與 Plan §3.3 對齊。線框草稿裡的 `wc` / `px` / `pl` / `uw` **不得**進入正式代碼，對應 `commercialCargoKg`、`estimatedPaxBaggageKg`、`plumeOnFlightKg`、`weightLoadRatio`。

公開函數、核心計算、非顯而易見的接口加型別。穩定業務對象用 `type` / `interface`（TS）或 `@dataclass(frozen=True)`（Python）。`any` 不用。

### 1.3 錯誤、日誌、測試

- 區分：非法輸入、缺資源、業務規則違反、基礎設施失敗。
- 只 catch 能翻譯或能恢復的錯。不寫 `except Exception: pass` / 空 `catch`。
- 業務失敗丟具名錯（`InvalidFlightDataError`、`UnknownAircraftError`），View 層再變成 400/422。
- 日誌用 `flightId`、`asOf` 這類非敏感上下文；不打憑證、不在服務裡用 `print`。
- 金額此處是公斤與立方，用普通 `number` 即可；比較閾值用 vis-à-vis `CAUTION_RATIO` 常量，不散落 `0.9`。
- 測試測契約：Plan §7 正常斷言 + 缺商貨 / 體積瓶頸 / 臨近起飛 / 非法輸入。引擎測試不掛 React。

```ts
// 反例：縮寫 + 計算與 SVG 擠在一起
const uw = (d.wc + d.px + d.pl) / d.aw;
return <text fill={uw >= 1 ? "red" : "green"}>{Math.round(uw * 100)}%</text>;

// 正例：領域名 + 純函數與展示分離
export function calculateLoadRatio(totalKg: number, capacityKg: number): number {
  if (capacityKg <= 0) {
    throw new InvalidFlightDataError(`capacityKg must be > 0, got ${capacityKg}`);
  }
  return totalKg / capacityKg;
}
```

---

## 2. 目錄：一檔一事

React 子工程在 `kanban-app/`（Vite）。現有靜態站（`index.html` / `pages/` / `assets/`）不改目錄約定；看板獨立 `npm run dev`。後期可把 build 掛到 `pages/operations.html`。

```text
kanban-app/
├── public/brand/                         T5  啟動包 Logo / icon（見 §0.1）
├── public/data/kanban-snapshot.json      T1  基準快照
├── src/
│   ├── types/kanban.ts                   T1  領域模型（唯一型別源）
│   ├── config/aircraftSpecs.ts           T1  機型 CAP
│   ├── config/thresholds.ts              T1  90% / 100% / 23kg / 0.227m³ / 裝機截止
│   ├── i18n/dictionary.ts                T2  繁中 / EN 詞條
│   ├── i18n/I18nProvider.tsx             T2  Context
│   ├── i18n/useI18n.ts                   T2  Hook
│   ├── engine/
│   │   ├── errors.ts                     T3  具名錯
│   │   ├── passengerForecast.ts          T3  非 Plume 預測
│   │   ├── holdLoad.ts                   T3  單班 LOAD / STATUS / DEFICIT
│   │   ├── deferralPlan.ts               T3  後班篩選 + 貪心延後
│   │   └── evaluateSnapshot.ts           T3  全航段 KPI + 隊列
│   ├── services/
│   │   ├── schema.ts                     T4  校驗原始 JSON
│   │   ├── dataSource.ts                 T4  KanbanDataSource 協議 + Json 實現
│   │   ├── applyFeedback.ts              T4  事件作用在快照上（純函數）
│   │   └── useKanbanSnapshot.ts          T4  React Query
│   ├── styles/tokens.css                 T5  色、間距、字號（對齊 wf.css）
│   ├── components/common/                T5  StatusBadge, AssessmentBadge, InfoPopover, SyncIndicator
│   ├── components/layout/                T5  TopHeader, ControlBar
│   ├── components/overview/              T6  總覽各塊（見下表）
│   ├── components/detail/                T7  詳情各塊（見下表）
│   ├── pages/OverviewPage.tsx            T6  只組裝
│   ├── pages/FlightDetailPage.tsx        T7  只組裝
│   └── App.tsx                           T8  Provider + 兩視圖切換
└── tests/                                T3  引擎單測（Vitest）
```

`backend/` 目錄與 Django 檔案**本期不建**。`dataSource.ts` 裡留 `DjangoApiDataSource` 的接口註釋或空殼即可。

---

## 3. 組件邊界（不要擠）

每個組件：**只擁有**下表「職責」列；頁面把已算好的 view-model 傳進來。

### 3.1 總覽

| 組件 | 職責 | 不放進此檔 |
|---|---|---|
| `KpiCard` | 單卡：標題、主值、輔行、可選迷你條 | 聚合邏輯 |
| `KpiSummaryRow` | 四卡排版 | 自己算 KPI |
| `HoldLoadBarChart` | 座標系、0–120% 刻度、90% / 100% 線、把每班交給 `FlightBarColumn` | 單柱細節、Tooltip 文案 |
| `FlightBarColumn` | 一根柱：色塊、斜紋 DEFER、超限紅框、UNK 虛線框、柱頂 `LOAD%`（VOL 更緊加 `▲`；UNK 寫 `BAG n%`）、柱底航班 / 時刻 / `StatusBadge` | **柱內 kg 數字**、機型、座位數、分段標籤 |
| `FlightBarTooltip` | Floating UI 浮窗：機型座位、CAP、三段 kg、**Plume 計入 kg (SHARE%)**、可延後件/kg、WT%、VOL%、DEFICIT | 畫柱 |
| `ActionQueuePanel` | 待處理列表：航班、STATUS、T−、DEFICIT、DEFER→目標、評估簽 | 篩選規則（由 engine 給 `actionQueue`） |
| `FlightManifestTable` | 全數字表 + `PLUME kg (SHARE)` + 三段微型去向條 | 進詳情以外的副作用 |
| `OverviewPage` | 排以上組件、把 `selectedFlightId` 回報 App | SVG path、LOAD 公式 |

`FlightBarColumn` 完成標準：柱的 SVG 裡沒有商貨/乘客/Plume 的 kg `<text>`。那些數字只出現在 `FlightBarTooltip`。

### 3.2 詳情

| 組件 | 職責 | 不放進此檔 |
|---|---|---|
| `FlightHeaderBanner` | 航班、STATUS、航段、DEP、機型、座位/Plume 人數、CAP、T− | 延後算法 |
| `HoldOccupancyCard` | WT / VOL 橫條（條內無字）+ 懸停分段 kg/m³ + 對照表 | 分支圖 |
| `PlumeAssessmentCard` | PAX / PCS / ON-FLIGHT kg / CAP SHARE + DEFICIT 條（DEFER 綠 + RESIDUAL 斜紋）+ LOAD 前後 | SVG 桑基 |
| `DeferralFlowChart` | 左申報塊、中三路、右候選列；線寬=重量 | 單個後班卡片內部排版 |
| `CandidateFlightNode` | 一個後班：ACCEPT 綠框或 ✕ NO-GO + 原因 | 算 ACCEPT CAP |
| `FlightDetailPage` | 排以上組件、返回總覽 | 座標公式（抽 `ribbonPath.ts`） |

桑基貝塞爾抽到 `components/detail/ribbonPath.ts`（純函數，`string` path）。`DeferralFlowChart` 只消費 path 與 layout 數據。

### 3.3 共用

`StatusBadge` / `AssessmentBadge` 只接收 union 狀態，自己查 i18n。`InfoPopover` 用 `@floating-ui/react`（hover + focus + dismiss + `Esc` + `aria-describedby`）。`ControlBar` **受控**：`asOf`、`windowDays`、`nearHours`、`metric`（`'weight' | 'volume'`）全部由 App / page 傳入。`TopHeader` 管標題、員工簽、`SyncIndicator`、繁中/EN。

頁面與 App **不**內聯上述任一區塊的 JSX 超過組裝層（`<>…</>` + props）。

---

## 4. 任務

### T1 · 型別、常量、基準 JSON

**產出**

- `src/types/kanban.ts`
- `src/config/aircraftSpecs.ts`
- `src/config/thresholds.ts`
- `public/data/kanban-snapshot.json`

**契約（寫在 `kanban.ts`）**

```ts
type HoldStatus = "OVER" | "CAUTION" | "NORMAL" | "CARGO_UNK";
type DeferralAssessment = "CLEAR" | "PARTIAL" | "NO_GO" | "MONITOR";
type BagMode = "on_flight" | "cargo";
type BagState = "staged" | "loaded" | "arrived";
```

原始快照形狀對齊 Plan §3.3。`aircraftSpecs` 用 `Readonly<Record<AircraftModel, AircraftCapacitySpec>>`。閾值只出自 `thresholds.ts`：`CAUTION_RATIO = 0.9`、`OVER_RATIO = 1`、`DEFAULT_PAX_BAG_KG = 23`、`DEFAULT_PAX_BAG_M3 = 0.227`、`CARGO_KG_PER_M3 = 160`、`DEFAULT_PLUME_BAG_M3 = 0.19`、`LOAD_CUTOFF_HOURS = 3`。

JSON 錄入 Plan §7 七班，**含 CX251 逐件**（才能斷言 66 件 / 1,180 kg 三路分流）。其他班可用聚合件但欄位仍是 `plumeBags[]`。`cargoKg: null` 表示 UNK。CX257 種子用 Plan 表；**現場旅客件由 T4 覆蓋**，不要在 JSON 裡另寫一套 Lin 行李與 Plan 搶數。

**完成標準**：型別能描述快照；常量無魔法數散落；JSON 可被 `JSON.parse` 且七班 `id` 齊全。尚未寫 UI。

---

### T2 · 雙語

**產出**：`i18n/dictionary.ts`、`I18nProvider.tsx`、`useI18n.ts`

詞條覆蓋 Plan §6 全部鍵，外加控制條、KPI 標題、圖例、表頭、浮層短句。`TranslationKey = keyof typeof dictionary["zh-Hant"]`。切換寫入 `plume-light-language`。

從啟動包 `i18n.js` **只抽繁中 / EN**（不要做法西阿）：

| 鍵 | 繁中（包內原文） | EN |
|---|---|---|
| `kb.staffOnly` | 僅限國泰員工 · 營運演示 · 規劃參考 | Cathay staff only · Operations demo · Planning reference |
| `kb.navTitle` | 營運看板（僅限國泰員工） | Operations (Cathay staff only) |
| `kb.noAutoSale` | 不會自動出售或釋放貨運艙位。 | No cargo space is automatically sold or released. |
| `kb.missingNotZero` | 缺失不等於零 | Missing is not zero |
| `kb.demoSaved` | 預報已保存，演示看板可讀取 | Declaration saved; demo board can read it |

**完成標準**：`t("kb.status.over")` 在兩種語言都有值；漏鍵在編譯期失敗。無硬編碼中文/英文在組件字面量裡（狀態代碼 `OVER` 等作為數據值除外）。不把包內簡體大綱句貼進繁中界面。

---

### T3 · 純引擎 + 單測

**產出**：`engine/*.ts` + `tests/holdLoad.test.ts` + `tests/deferralPlan.test.ts` + `tests/evaluateSnapshot.test.ts`

函數邊界（一個檔一個主題）：

| 檔 | 導出（名稱可近、職責不可混） |
|---|---|
| `passengerForecast.ts` | `forecastPaxBaggage({ seats, plumePax })` → `{ kg, m3 }` |
| `holdLoad.ts` | `resolveCapacity`、`resolveCargoVolume`、`summarizePlume`、`calculateHoldLoad` → 單班 `HoldLoadView`（含 `status`、`weightLoadRatio`、`volumeLoadRatio`、`hasVolumeBottleneck`、`deficitKg`、`plumeShare`） |
| `deferralPlan.ts` | `listCandidateFlights`、`acceptanceHeadroom`、`planDeferral` → 本班分流 + 各後班 `ACCEPT | NO_GO` 及原因 |
| `evaluateSnapshot.ts` | `evaluateSnapshot(snapshot, asOf)` → KPI 合計、每班 `HoldLoadView`、`actionQueue`、每班 `DeferralPlan` |

規則只實現 Plan §4。入參不修改：排序用淺拷貝。`commercialCargoKg === null` → 狀態 `CARGO_UNK`，不算 DEFICIT，後班直接 `NO_GO` / `CARGO_UNK`。`seats < plumePax` 或 `capacityKg <= 0` → `InvalidFlightDataError`。承接：重量與體積的 `max(0, 0.9 * cap - current)` **都**要夠。

**完成標準**（Vitest 全綠，數字以 Plan §7 為準）：

- CX251：`deficitKg = 1056`，`deferKg = 386` 去 CX261，`residualKg = 670`，`assessment = PARTIAL`
- CX253：`deficitKg = 332`，`deferKg = 352` 去 CX261，`assessment = CLEAR`
- CX261 承接兩班共 738 kg 後 LOAD < 90%
- CX255 / CX263：`CARGO_UNK`，不出現在承接池
- CX259：`hasVolumeBottleneck === true`，不可作承接
- CX257 在基準 `asOf` 下 `assessment = MONITOR`（臨近起飛、無可延後件）
- `engine/` 的 import 圖不含 `react` / `react-dom`

跑：`npx vitest run`（在 `kanban-app/`）。

---

### T4 · I/O 與反饋

**產出**：`schema.ts`、`dataSource.ts`、`applyFeedback.ts`、`useKanbanSnapshot.ts`

```ts
interface KanbanDataSource {
  fetchSnapshot(params: SnapshotQueryParams): Promise<RawKanbanSnapshot>;
  overrideFlightCapacity(flightId: string, override: CapacityOverrideInput): Promise<void>;
  subscribeFeedback(onEvent: (event: FeedbackEvent) => void): () => void;
}
```

`JsonDataSource.fetchSnapshot` 讀 `/data/kanban-snapshot.json`。若同瀏覽器有已提交的 CX257 預報，覆蓋該班 `plumeBags`（映射規則見 §0.1；讀現倉庫 `assets/model.js`，啟動包快照僅作欄位對照）。同一來源才能讀到旅客站數據（啟動包：不靠跨設備同步）。

`applyFeedback(snapshot, event)` 是純函數，事件：

| 事件 | 作用 |
|---|---|
| `TIME_TICK` | 改 `asOf`（時間推進，不是現場反饋） |
| `PLUME_DECLARED` | 增改某班 Plume 件 |
| `BAG_ARRIVED_EARLY` | 件 `state → arrived`，移出 ON-FLIGHT |
| `CARGO_UPDATED` | 寫入 `cargoKg` / `cargoM3` |
| `CAP_OVERRIDDEN` | 寫 `capOverride` |

`useKanbanSnapshot` 用 React Query 拉 snapshot，在客戶端跑 `evaluateSnapshot`。組件只消費 Hook 的 `viewModel`。

**完成標準**：引擎測試以外，對 `applyFeedback` 有單測（至少 `CARGO_UPDATED` 讓 UNK 班變成可承接；`BAG_ARRIVED_EARLY` 降低 ON-FLIGHT kg）。UI 檔沒有 `fetch(`。

---

### T5 · 原子組件與頂欄

**產出**：`styles/tokens.css`；`public/brand/` 下的 Logo / icon（§0.1 清單）；`components/common/*`；`components/layout/TopHeader.tsx`、`ControlBar.tsx`

`tokens.css` 先抄啟動包 `:root` 色板與字體棧，再補線框狀態色（§0.1 表）。`index.html`：`theme-color = #02544f`，favicon = `plume_light_icon.svg`。

`TopHeader`：深綠底 + **反白橫版 Logo** + `kb.staffOnly` 徽章 + 繁中/EN。不自繪替代 Logo，不拉伸變形（啟動包：保持原作比例）。

**完成標準**：Story 不必做；頂欄可見反白 Logo 與員工簽；`ControlBar` 無內部業務 state（時間撥動只 `onAsOfChange`）。`InfoPopover` 可用鍵盤打開並 `Esc` 關閉。

---

### T6 · 總覽頁

**產出**：`components/overview/*`、`pages/OverviewPage.tsx`

對齊 `images/01_overview.png`。指標切換 WT/VOL 只改柱高用的比率，浮窗兩維都顯示。點柱 / 隊列行 / 表行 → `onSelectFlight(id)`。

**完成標準**

- 柱面無段內 kg；UNK 柱頂為 `BAG n%` 且上段虛線框到 100%
- 懸停或聚焦 CX251 浮窗含 Plume 計入 kg、SHARE%、可延後 386 kg
- 隊列至少含 CX257 MONITOR、CX251 PARTIAL、CX253 CLEAR
- `OverviewPage` 不含 `<svg>` 座標計算

---

### T7 · 詳情頁

**產出**：`components/detail/*`、`pages/FlightDetailPage.tsx`

對齊 `images/02_flight_detail.png`。橫條內無 kg 字。分支圖：CX251 的 CX253/255/259 為 `NO-GO`（原因與 Plan §7 一致），CX261 為 `ACCEPT`。窗口改 1D/2D/3D 時候選列與流向跟 `evaluateSnapshot` 結果變。

**完成標準**：CX251 詳情一屏能讀出「缺口 1056 → 延後 386 → 殘餘 670，LOAD 103.9% → 102.4%，去 CX261」。`ribbonPath` 有針對 path 字串的單測（非空、以 `M` 開頭）。

---

### T8 · App 組裝與演示反饋

**產出**：`App.tsx`、入口 `main.tsx`、`index.html`、`package.json` 腳本

`App` 包：`QueryClientProvider`、`I18nProvider`、視圖狀態。頂欄 `SYNC` 在 JSON 模式顯示模擬源。控制條提供「時間 ◀▶」與至少一個演示觸發（例如「填入 CX255 商貨」調 `applyFeedback`），以證明動態重算。

**完成標準**

- `npm run dev` 能開總覽；點 CX251 進詳情；返回總覽
- 繁中 / EN 切換標題與狀態簽
- 撥時間或演示事件後 KPI / 柱 / 隊列變化
- `npm test`（vitest）全綠
- 現有靜態站頁面未被改壞（未改 `assets/app.js` 行為除非為讀 CX257 預報而對齊鍵名）
- 頂欄用啟動包反白 Logo；文案無「已同步航司 / 零超載」

---

### T9 · Django（後期，本期不做）

接口與 JSON 同構：`GET /api/v1/kanban/snapshot`、`PATCH /api/v1/kanban/flights/{id}/capacity`、`GET /api/v1/kanban/stream`（SSE）。Python 側：`schemas.py` dataclass/Pydantic、`domain/` 純函數（可與 TS 引擎對拍同一組 §7 斷言）、`KanbanSnapshotService` 才用 class + `Protocol` 注入倉庫。公開函數全標型別。View 把領域錯轉 400/422。到該期再新建 `backend/`，並加 `DjangoApiDataSource` 實現 T4 的接口。

---

## 5. 總完成標準

1. **模塊**：`engine/` 無 React；頁面檔無 LOAD 公式；柱與浮窗、桑基與候選節點分檔。
2. **去噪**：總覽柱與詳情橫條內部無分段 kg；Plume SHARE 在浮窗與明細表可見。
3. **雙語**：頂欄切換無漏譯（字典漏鍵編譯失敗）。
4. **動態**：時間或反饋事件觸發重算，無需整頁刷新。
5. **測試已跑**：`kanban-app` 內 `npx vitest run` 通過；未跑不得稱通過。
6. **範圍**：無執行調度、無貨機、無 React 大圖表庫、無本期 Django 服務端。
7. **素材**：`public/brand/` 為啟動包（或倉庫 `assets/`）原檔；token 色值與 §0.1 表一致；未整份拷貝舊 `operations.html` / `styles.css` / 五語言 `i18n.js`。
