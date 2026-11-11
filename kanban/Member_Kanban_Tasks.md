# 会员追踪看板 · 工程任务（v0.4）

对齐：[Member_Kanban_Plan.md](./Member_Kanban_Plan.md)（界面、图、工程拆分的**唯一来源**）· [Member_Kanban_Requirements.md](./Member_Kanban_Requirements.md)（八问与口径）· 版式预览 `preview/member-board-preview.html`、`preview/member-board-p.png` · 数据包 **会员监控看板-数据与模型**（工作区第三目录，种子 `20261111`）

代码质量：`aaron-python-formatted` 的工程原则（**Readable → Modular → Robust → Testable → Automated**）。TypeScript / React 用该语言惯例。**业务规则不在此处重写**——实现时读 Plan §1–§3 与 `generate_member_snapshot.py` 的 `evaluate()` / `link_status()` / `current_tier()`，不要另发明口径。

**本期范围**：Plan §7 的 M1–M4，落在现有 `kanban-app`（React 19 + Vite + TypeScript）里，作为第二块看板。货舱看板的时钟、引擎、快照与页面保持原样。

本文用简体。界面词条用繁中 / EN，前缀 `mb.`。

---

## 0. 怎么用这份文件

按 T1 → T8 顺序做。每个 Task 结束时必须满足该节的 **完成标准**，再进入下一个。人数、比率、金额以拷入的 `kpi-at-bookmarks.json` 为准；该文件没有的拆分（航线、费用三段、漏斗层、家庭状态、三类运营缺口、优惠码分码、增量分人群）用 §4 T3 的种子对照表。对照表按种子 `20261111`、`schema_version` `2026-11-11.2` 从 `member-snapshot.json` 重算。静态预览 HTML 只作早期版式参考，数字以运行中的会员看板为准。

未写明的细节用下列默认，并在 PR / 提交说明里标出假设：

| 未写明项 | 默认 |
| --- | --- |
| 看板切换 | App 内 `board: "cargo" \| "members"`。不加 `react-router` |
| 会员时钟 | 只跳书签。不用 `Date.now()`，不跟货舱 LIVE 滴答 |
| 货舱 LIVE | 仅 `board === "cargo"` 时推进 `asOf`。切到会员时冻结货舱时钟，切回保留离开时的时刻 |
| 默认书签 | `P` · `2026-11-10T09:30:00+08:00` |
| 样式 | CSS Modules + 现有 `styles/tokens.css`。不加 Tailwind / CSS-in-JS / 图表库 / 地图库 |
| 版心 | 会员页内容宽约 **1080px**，居中。顶栏与书签条 `position: sticky` |
| 时区 | 全部时间 `Asia/Hong_Kong`。本周 = 该本地日所在周的周一 00:00 |
| 语言键 | 沿用 `localStorage` 键 `plume-light-language`；只认 `zh-Hant` / `en` |
| 动效 | 弧线、漏斗、色带宽度 400ms。`prefers-reduced-motion: reduce` 时直接落到新宽度 |
| 地图 | 只画香港到伦敦一条实线，粗细对应用人数。卡片分学生、家长、商旅三行。没有航线切换 |
| 空值 | 分母为 0 → 比率 `null`，界面「無樣本」，图是空框。分子为 0 且分母 > 0 → 显示 0，不涂 0 的颜色 |
| 精度 | 比率 `round(n / d, 4)`；天数 `round(x, 2)`；金额到分。整数合计可以不写 `.00`，平均数与带分的利润写两位 |

允许依赖：现有 `kanban-app` 已有的 `react`、`react-dom`、`vite`、`typescript`、`@tanstack/react-query`、`vitest`，以及已有的 `HoverTip` / `InfoPopover`。不加 Recharts、ECharts、Leaflet、Mapbox、i18next、react-router。

### 0.1 数据包：用什么、不用什么

包路径：`会员监控看板-数据与模型/member-kanban-data/`。

| 用 | 放到 |
| --- | --- |
| `member-snapshot.json` | `kanban-app/public/data/member-snapshot.json`（原样拷贝，不手改） |
| `kpi-at-bookmarks.json` | `kanban-app/public/data/kpi-at-bookmarks.json`（原样拷贝） |
| `generate_member_snapshot.py` 的 `evaluate`、`link_status`、`current_tier` | 只作口径对照。前端用 TypeScript 重写同等规则，不在浏览器里跑 Python |
| 预览 `member-board-preview.html` 的世界轮廓 `<path>` | 抽成静态轮廓，见 T6。运行时不请求在线底图 |

| 留在数据包、看板不画 | 原因 |
| --- | --- |
| `G3_new_today_vs_yesterday` | 不在 v0.3 的八问里 |
| `G4_cargo_window_member_seat_share`、座位占比 | 同上 |
| `T5_alerts`、临近出发、航班状态 | 同上 |
| 书签 `CARGO`（2026-11-15 05:30） | 货舱核对时刻。会员书签条只有 A B C D P E |
| `display_name`、`member_id`、订单号、`link_id` | 快照里保留，供生成与核对。视图模型在交给组件之前丢掉 |
| `CXFAMILY`、Diamond Plus | 数据包不发放、不分配。界面不出现 |
| 航班运行状态、票号、护照、在线地图、旅客 `localStorage` | Plan §8 |

改口径时先改 Python 与核对 JSON，再重新拷贝。前端不生成会员。

### 0.2 和货舱看板的接缝

- `src/engine/`、`src/types/kanban.ts`、`src/services/dataSource.ts`、货舱页面与货舱词条保持不动。
- 会员计算放在 `src/members/`，用自己的 JSON 与 hook。两套快照不合并进一个 `fetch`。
- 共用：`styles/tokens.css`、`I18nProvider`、`useI18n()`、顶栏 Logo / 员工签 / 繁中 EN、`HoverTip`。
- 顶栏增加「貨艙 / 會員」。员工签仍是界面用途，不是登录。

---

## 1. 质量门（每段代码都过）

### 1.1 五步流向

1. **边界校验** — 快照缺 `members` / `funnel_events` / `family_links` / `service_orders` / `ticket_increment_weekly` / `flights` / `meta`，或书签 id 未知：显式失败。缺字段不当成 0。
2. **标准化** — 转成 `members/types.ts`。时间用 `Asia/Hong_Kong` 解释 ISO 字符串。
3. **纯计算** — `members/engine/` 无副作用：不读 `window`、不碰 DOM、不 `fetch`、不改入参。
4. **I/O** — 只有 `members/services/` 读 JSON。组件不写 `fetch`。
5. **单一职责组件** — 一张图一个组件。`MemberBoardPage` 只按顺序组装，不算比率、不画 SVG 路径。

拆分条件（满足任一即拆）：职责超过一个视觉区域；SVG 坐标与 JSX 挤在一起；同一文件既算业务又渲染。一个连贯函数可以较长。不要为了变短拆成碎片函数。

### 1.2 命名

| 语言 | 变量 / 函数 | 组件 · 型别 | 模块常量 |
| --- | --- | --- | --- |
| TypeScript / React | `camelCase` | `PascalCase` | `UPPER_SNAKE_CASE` |

布尔读起来像条件：`isCostAssumptionLocked`、`hasSample`、`ignoresAudienceFilter`。

领域名与 Plan 对齐：`audience`、`corridor`、`linkedUnauthorized`、`contributionProfitHkd`。线框或预览里的临时缩写不进入正式代码。

`any` 不用。比率用 `{ rate: number | null; numerator: number; denominator: number }`。`rate === null` 才是无样本。

### 1.3 隐私边界

`evaluateMembers` 的返回值是视图模型。其中不得出现：

- `display_name`，以及种子里的四个姓名：`May Chen`、`Lin Chen`、`Alex Chen`、`Emily Chen`
- `member_id`、`order_id`、`link_id`、`inviter_id`、`invitee_id`
- 任何可以点进一个人、一张订单、一个家庭、一个班次的 id

组件没有展开到个人的交互。第 5 块停在周和人群。航线只有伦敦。

### 1.4 筛选作用域

人群筛选：`all` | `students` | `parents` | `business`。对应 `student`、`parent`、`business`。没有第二行。

| 区域 | 人群筛选 | 航线 |
| --- | --- | --- |
| 航线地图 | 忽略，始终这条伦敦线上的全量已支付 | 只有 `HKG-LHR`，不可切换 |
| 第 2、3、6、7 块 | 同一批会员做分母 | 忽略 |
| 第 5 块 | 按周汇总行的 `persona` | 只有 `HKG-LHR`，不可切换 |
| 第 1、4、8 块 | 忽略。角标「全量」 | 忽略 |

未筛选时：学生增量 + 家长增量 + 商旅增量 = 已完成周 + 本周至今。

### 1.5 错误与测试

- 非法快照、未知书签：具名错误（`InvalidMemberSnapshotError`、`UnknownBookmarkError`）。
- 只 catch 能翻译的错误。不写空 `catch`。
- 分母为 0 不是异常，是 `rate: null`。
- 引擎测试不挂 React。`members/engine/` 的 import 图不含 `react` / `react-dom`。
- 单测至少覆盖书签 `A`、`P`、`E`，以及「只筛选家长」。
- 跑：在 `kanban-app/` 执行 `npm test`。未跑不得称通过。

---

## 2. 目录：一档一事

```text
kanban-app/
├── public/data/member-snapshot.json          T1
├── public/data/kpi-at-bookmarks.json         T1
├── public/maps/world-outline.svg             T6  从预览 path 抽出的本地轮廓
├── src/members/
│   ├── types.ts                              T1
│   ├── config/bookmarks.ts                   T1  六个书签的时刻与词条键
│   ├── config/audiences.ts                   T1  人群分组
│   ├── config/presentation.ts                T1  35% 只用于文案；直方图分箱
│   ├── engine/errors.ts                      T3
│   ├── engine/familyStatus.ts                T3  移植 link_status
│   ├── engine/evaluateMembers.ts             T3
│   ├── services/loadMemberSnapshot.ts        T4
│   ├── services/useMemberBoard.ts            T4
│   ├── components/MemberCard.tsx             T5  序号、问题、主数字、角标、旁注
│   ├── components/MemberControlBar.tsx       T5
│   ├── components/RouteMap.tsx               T6
│   ├── components/JoinSpark.tsx              T6  入会小漏斗 + 六书签累计曲线
│   ├── components/ServiceFunnel.tsx          T6
│   ├── components/FamilyFlow.tsx             T6
│   ├── components/familyRibbon.ts            T6  纯函数，返回 SVG path
│   ├── components/RevenueComposition.tsx     T7
│   ├── components/IncrementBars.tsx          T7
│   ├── components/LagRuler.tsx               T7
│   ├── components/TierColumns.tsx            T7
│   ├── components/PromoSplit.tsx             T7
│   └── pages/MemberBoardPage.tsx             T5 起组装，T6/T7 把图填进卡
└── tests/evaluateMembers.test.ts             T3
    tests/familyStatus.test.ts                T3
```

词条加在现有 `src/i18n/dictionary.ts`，键以 `mb.` 开头。两边语言键集合必须一致，漏键在类型上失败（沿用现有 `TranslationKey`）。

竖版顺序（卡片上的序号仍是问题编号，**页面顺序不是 1→8**）：

```text
顶栏（貨艙 / 會員）
书签条 + 人群筛选
航线地图
第 2 块  入会
第 1 块  收入构成
第 3 块  服务漏斗
第 4 块  家庭横向分流
第 5 块  机票增量
第 6 块  首次支付时间尺
第 7 块  等级柱
第 8 块  优惠码
```

---

## 3. 组件边界

页面把 `MemberBoardView` 传下去。组件不解释时间戳，不读快照原文。

| 组件 | 只负责 | 不放进此文件 |
| --- | --- | --- |
| `MemberCard` | 序号、问题原文、主数字、分子/分母、旁注、筛选角标「全量」 | 任何业务加总 |
| `MemberControlBar` | 受控：当前书签、人群、繁中里的短名称。悬停用现有浮层展开数据包原意 | 内部业务 state、切片 |
| `RouteMap` | 本地轮廓、香港到伦敦一条实线、城市点、一张航线卡片（人数 + 学生 / 家长 / 商旅） | 投影以外的请求；航线切换；改第 2/3/6/7 块分母 |
| `JoinSpark` | `reach → start_join → complete_join` 的宽度；六个书签的累计曲线；当前书签竖线；未到的书签变淡 | 服务漏斗三步 |
| `ServiceFunnel` | 了解服务 → 到达结算 → 支付成功；层间流失人数；「含演示對齊」 | 入会漏斗 |
| `FamilyFlow` | 左源、中色带、右状态卡。消费 `familyRibbon` 的 path。带上写人数 | 货舱航班类型；姓名 |
| `familyRibbon.ts` | 由各状态人数生成 path 字符串 | JSX |
| `RevenueComposition` | 三段堆叠条 + 35% 斜纹成本条 | 未支付订单 |
| `IncrementBars` | 学生 / 家长 / 商旅三列；实色 = 已完成周，斜纹 = 本周至今 | 会员、订单、班次入口；航线切换 |
| `LagRuler` | 0 到不少于 P90 的轴、P50/P90 刻度、轴下直方图 | 无样本时涂 0 色 |
| `TierColumns` | 每等级一根柱：柱高 = 人数，柱内填色 = 使用率 | Diamond Plus；2027-01-01 前的 Diamond Exec 占位柱 |
| `PromoSplit` | 家庭码 / 官方学生码两条；可展开到码。ROI 锁形「未鎖定」 | 比率仪表 |
| `MemberBoardPage` | 按 §2 顺序排卡，把回调交给 App | SVG 路径、`evaluateMembers` |

`FamilyFlow` 与货舱 `DeferralFlowChart` 画法同一路数（左源、中带、右卡），组件、类型、数据分开，不 import 货舱航班类型。

---

## 4. 任务

### T1 · 型别、常量、拷入 JSON

**对应** Plan M1 的数据入口。

**产出**

- `public/data/member-snapshot.json`
- `public/data/kpi-at-bookmarks.json`
- `src/members/types.ts`
- `src/members/config/bookmarks.ts`
- `src/members/config/audiences.ts`
- `src/members/config/presentation.ts`

**契约（写在 `types.ts`）**

```ts
type BookmarkId = "A" | "B" | "C" | "D" | "P" | "E";

type Persona = "student" | "parent" | "business";

type AudienceFilter = "all" | "students" | "parents" | "business";

type Corridor = "HKG-LHR";

type FamilyLinkStatus =
  | "cancelled"
  | "declined"
  | "revoked"
  | "authorized"
  | "linked_unauthorized"
  | "pending";

type Ratio = {
  rate: number | null;
  numerator: number;
  denominator: number;
};
```

书签时刻与 `generate_member_snapshot.py` 的 `BOOKMARKS` 一致。条上不写字母。短名称词条键：

| id | 时刻 | 短名称（繁中） | 悬停（繁中） |
| --- | --- | --- | --- |
| A | 2026-06-17 09:30 | 暑假前 6/17 | 暑假前，出發需求處於低位 |
| B | 2026-08-12 09:30 | 行前 8/12 | 赴英出發前需求 |
| C | 2026-09-16 09:30 | 報到 9/16 | 留學生赴英報到 |
| D | 2026-10-21 09:30 | 回落 10/21 | 秋季報到後，需求回落 |
| P | 2026-11-10 09:30 | 演示 11/10 | 與演示時鐘對齊 |
| E | 2027-01-13 09:30 | 返校 1/13 | 一月返校 |

`presentation.ts` 只放展示常量：`LAG_BIN_EDGES_DAYS = [0, 15, 30, 45, 60, 75, 90, 120, 180]`（左闭右开，最后一箱为 180 天以上）、`DIAMOND_EXEC_EFFECTIVE_AT = 2027-01-01T00:00:00+08:00`、演示单价旁注 1200 / 600 / 250。成本比率从快照 `meta.temp_cost_ratio` 读，不在组件里写死 `0.35`。`cost_assumption_locked` 从快照 `meta` 读。

原始快照字段保持数据包蛇形名，在 `loadMemberSnapshot` 的边界收成驼峰。视图模型用驼峰。

**完成标准**：两份 JSON 可被 `JSON.parse`；`meta.generator_seed === 20261111`；`meta.schema_version === "2026-11-11.2"`；`meta.data_class === "simulated"`；六个书签时刻齐全，且类型里没有 `CARGO`、`M`、`S`、`F`。尚未写 UI。

---

### T2 · 词条

**产出**：在现有 `dictionary.ts` 增加 `mb.*`。繁中与 EN 键一一对应。

问题原文（卡片左上角，繁中）：

| 键 | 繁中 | EN |
| --- | --- | --- |
| `mb.q1` | Plume Light 能賺多少錢？每單利潤多少？ | How much can Plume Light earn, and what is the profit per order? |
| `mb.q2` | 服務能否吸引學生或家長加入國泰？ | Does the service bring students or parents into Cathay membership? |
| `mb.q3` | 有多少人了解服務後真正付款購買？ | Of the people who learn about the service, how many actually pay? |
| `mb.q4` | 能否通過一名學生建立更多家庭會員關係？ | Can one student connect more family members? |
| `mb.q5` | 家長是否因探望學生而增加機票消費？ | Do parents book more flights when visiting students? |
| `mb.q6` | 新會員是否很快開始消費？ | How soon after joining does a new member pay? |
| `mb.q7` | Green、Silver、Gold 等會員中，哪些更願意購買？ | Among Green, Silver, Gold and the other tiers, who is more willing to buy? |
| `mb.q8` | 家長機票優惠能否帶來足夠收益？ | Do family fare codes return enough value? |

同时覆盖：顶栏「貨艙 / 會員」、`mb.title` =「會員追蹤」、`mb.simulated` =「模擬數據」、`mb.noSample` =「無樣本」、`mb.scopeAll` =「全量」、`mb.demoAligned` =「含演示對齊」、成本占位句「可變成本按收入 35% 占位，尚未鎖定」、`mb.roiLocked` =「未鎖定」、六个书签的短名称与悬停、人群（全部 / 學生 / 家長 / 商旅）、航线卡三行人数、漏斗三步、家庭六状态、三类缺口（已付未授權 / 已授權未付 / 待處理未入會）、第 5 块观察句（示意縮放值；不能由一筆行李訂單推算一張機票）、第 6 块「入會之後多久發生第一筆支付」、等级名「鑽石行政卡」。词条里不出现赴澳、维州、Victoria、墨尔本、悉尼。

单价旁注写明不是现行官价。不把数据包里的简体标签直接贴进繁中界面。不写「已同步航司」。

**完成标准**：`t("mb.q1")` 在两种语言都有值；新增键两边都有，漏键编译失败。组件字面量里不写中文或英文句子（数据值 `Green`、`HKG-LHR`、货币代码除外）。

---

### T3 · 纯引擎 + 单测

**对应** Plan M1。本任务结束时 M1 的通过条件成立。

**产出**：`engine/errors.ts`、`engine/familyStatus.ts`、`engine/evaluateMembers.ts`、`tests/familyStatus.test.ts`、`tests/evaluateMembers.test.ts`

```ts
function evaluateMembers(
  snapshot: MemberSnapshot,
  tDemo: string,
  filter: { audience: AudienceFilter; corridor: Corridor | "all" },
): MemberBoardView
```

函数按 `tDemo` 切片：入会、漏斗、邀请、支付、等级变更、周汇总都只取时间戳 ≤ `tDemo`。返回值包含地图与八块视图。筛选作用域按 §1.4。家庭状态、当前等级、分位、本周起点在引擎里算完。

**必须与 Python 一致的规则**

| 规则 | 来源 |
| --- | --- |
| 家庭状态顺序 | `link_status`：已取消 → 已拒绝 → 已撤销（曾接受则记为已互联未授权）→ 已授权 → 已互联未授权 → 待处理。支付不改变授权 |
| 当前等级 | `current_tier`。`Diamond Exec` 在 2027-01-01 00:00 HKT 之前不存在。这一档只来自该时刻之后的新入会，`tier_at_join` 就是 `Diamond Exec`，不是 Diamond 升级。未入会没有等级 |
| 分位 | 已入会且已有支付的会员，时长 = 最早 `paid_at − join_at`（天）。下标 `round(p × (n − 1))`，再 `round(_, 2)`。`n = 0` 时 P50/P90 为 `null` |
| 比率 | `d === 0 ? null : round(n / d, 4)` |
| 本周 / 今日 | 周一 00:00 HKT；今日从本地日 00:00 起。周末 ≤ `tDemo` 的周为已完成，当周为「本周至今」 |
| 航线使用中 | 已支付订单按航班 `sector` 对 `member_id` 去重。快照里的航班和会员航线都是 `HKG-LHR` |
| 收入 | 只加已支付订单的 `revenue_hkd`、`contribution_profit_hkd`、`lanes` 三段。未支付订单不进入 |
| 第 5 块 | 只加 `ticket_increment_weekly.incremental_revenue_hkd`。不从服务订单推导 |
| 优惠码 | `proposed_family` 与 `official_hkstudent` 分开。目录没有 `GBASTU`。`CXFAMILY` 不出现。商旅订单不带这两类码 |
| 学生带动 | 已接受且被邀请人是学生的关系数 ÷ 这些关系里的去重学生数 |
| 三类缺口 | 按 Plan §3.4 的三行条件，对全体可见关系计数 |

视图里第 1、4、8 块与地图带 `ignoresAudienceFilter: true`。第 2 块附六个书签的累计已入会（各用该签时刻重切 `join_at`，供曲线使用；**曲线跟随当前人群筛选**，未筛选时等于下表）。

**P · 2026-11-10 09:30，未筛选（与 `kpi-at-bookmarks.json` 的 `P` 对齐）**

| 块 | 值 |
| --- | --- |
| 地图 | 只有 LHR 154（学生 87，家长 42，商旅 25）。等于已支付会员人数 |
| 1 | 收入 283400；利润 184210；订单 154；均单收入 1840.26；均单利润 1196.17。取送 184800、超额 75600、Cargo 23000。`costAssumptionLocked === false` |
| 2 | 累计 182，今日 0，本周 0。完成入会 182/207 = 0.8792；开始入会 190/207。学生 102/114，家长 52/59，商旅 28/34。六签累计：14、73、140、173、182、213 |
| 3 | 154/182 = 0.8462。了解后付款 154/157。漏斗 157 → 155 → 154，流失 2、1 |
| 4 | 发出 38。状态：已授权 18、已互联未授权 11、待处理 1、已拒绝 7、已取消 1、已撤销 0。互联率 0.7632，成功率 0.6207，已发出中的授权率 0.4737。学生带动 29/29。缺口：已付未授权 9，已授权未付 2，待处理未入会 1 |
| 5 | 已完成周 65300，本周至今 3900。学生 21400 + 1400；家长 18300 + 1300；商旅 25600 + 1200 |
| 6 | P50 40.75，P90 85.67，样本 154。最短 3.22 天，最长 136.48 天。直方图人数：29、33、22、21、22、16、8、3、0（对应 §T1 的分箱） |
| 7 | Green 92 / 0.9457，Silver 44 / 0.7500，Gold 32 / 0.7500，Diamond 14 / 0.7143。没有 Diamond Exec。四档之和 182 |
| 8 | 使用率 0.3052（47/154）。家庭码 24 单、收入 39350：`PLUME-HOLIDAY` 24、`PLUME-ENROL` 0、`PLUME-GRAD` 0。官方学生码 23，全部是 `HKSTUDENT`。ROI `null` |

**A · 暑假前**

- 累计 14，今日 0，本周 3。转化率 14/18 = 0.7778。全周期 214 不得成为当前累计。
- 已支付订单 0。第 3 块转化率 **0**（0/14），是 0 而不是无样本。漏斗人数是 1 → 0 → 0：有一人已了解服务，支付层为空。
- 第 6 块无样本（P50/P90 为 `null`，样本 0）。
- 发出 0，三个家庭率为 `null`。
- 等级 Green 8、Silver 2、Gold 2、Diamond 2，使用率都是 0。没有 Diamond Exec。

**E · 2027-01-13 09:30**

- 累计 213。服务预订转化率 0.8451（180/213）。收入 327950，利润 213167.50，已支付订单 180。
- 等级出现 Diamond Exec **8**，使用率 0.6250。Green 103、Silver 54、Gold 33、Diamond 15。五档之和 213。
- 这 8 人全是商旅，入会日都在 2027-01-01 之后，`tier_changes` 为空。学生筛选下没有这一档。
- 发出 51；互联率 0.7647；成功率 0.6410。

**只筛选家长，时钟仍为 P（AC-12）**

| 块 | 应变 | 保持不动 |
| --- | --- | --- |
| 2 | 累计 52，转化 52/59 = 0.8814。学生和商旅累计为 0 | |
| 3 | 42/52 = 0.8077。漏斗 42 → 42 → 42 | |
| 5 | 已完成 18300，本周至今 1300。学生和商旅列为 0 | |
| 6 | P50 45.39，P90 82.58，样本 42 | |
| 7 | Green 26 / 0.9231，Silver 16 / 0.6875，Gold 7 / 0.7143，Diamond 3 / 0.6667。之和 52。没有 Diamond Exec | |
| 1、4、8、地图 | | 与未筛选的 P 完全相同，且 `ignoresAudienceFilter === true` |

三条不变量写进测试：

1. 未筛选时，学生累计 + 家长累计 + 商旅累计 = 182（`P`）。
2. 未筛选时，第 5 块三列增量之和 = 65300 + 3900。
3. 第 7 块各等级人数之和 = 当前已入会人数（`P` 为 182，家长筛选为 52，`E` 为 213）。

另：`JSON.stringify(view)` 不含 `May Chen`、`Lin Chen`、`Alex Chen`、`Emily Chen`，也不含 `member_id` 形式的键。

**完成标准**：`npm test` 全绿。测试核对快照结构（没有 MEL、SYD、赴澳、维州；家庭链接只有家长指向学生；`P` 没有行政卡；`E` 的行政卡使用率是分数；行政卡入会日都在 2027-01-01 之后），并让 `A` / `P` / `E` 的主数字对齐 `kpi-at-bookmarks.json`。`members/engine/` 不 import React。货舱原有测试仍然通过。

---

### T4 · 读取快照

**产出**：`services/loadMemberSnapshot.ts`、`services/useMemberBoard.ts`

- `loadMemberSnapshot` 读 `/data/member-snapshot.json`，校验 §1.1 的必填键，收成 `MemberSnapshot`。失败带缺了哪一键。
- `useMemberBoard(tDemo, filter)` 用 React Query 取快照，在客户端调用 `evaluateMembers`。组件只消费 `viewModel`。
- 不读旅客 `localStorage`。不把会员快照写回浏览器。不把这份 JSON 并进货舱 `JsonDataSource`。

**完成标准**：UI 文件没有 `fetch(`。hook 在书签或筛选变化时返回新的视图，不改快照对象。

---

### T5 · 壳、书签、八张数字卡

**对应** Plan M2。

**产出**：`MemberControlBar`、`MemberCard`、`MemberBoardPage`、顶栏「貨艙 / 會員」、`mb.*` 接到真实组件。

`App` 增加 `board`。货舱分支保持现在的 `ControlBar` + 总览/详情。会员分支渲染 `MemberBoardPage`，默认书签 `P`、人群 `all`、航线 `all`。

此阶段每张卡只有：序号、问题原文、主数字、分子/分母或对照、旁注。图先留空位。第 1、4、8 块在人群不是「全部」时显示「全量」。

今日为 0、本周为 0 时照样显示 0。第 6 块在 `A` 显示「無樣本」。第 8 块 ROI 显示「未鎖定」，不显示一个算出来的比率。

**完成标准**

- 顶栏能在货舱与会员之间切换；回到货舱时航班、`asOf`、LIVE 暂停点与离开前一致。
- 拨六个书签，八个主数字同一次变化，无需整页刷新。
- `A`：累计 14；第 6 块无样本；第 3 块转化率 0；界面不出现 214 这个当前累计。
- `P`：累计 182，今日 0，本周 0；页面有「模擬數據」。
- 只筛选家长：第 2 块累计变为 52；第 1 块仍是 HK$283,400，并标明全量。
- 繁中 / EN 切换后八个问题都变。
- `MemberBoardPage` 不含业务公式。

---

### T6 · 地图、入会图、服务漏斗、家庭分流

**对应** Plan M3。M3 结束时可以用地图、漏斗和分流讲完：人在哪条航线、付费走到哪一层、家庭关系卡在哪一段。

**产出**：`world-outline.svg`、`RouteMap`、`JoinSpark`、`ServiceFunnel`、`FamilyFlow`、`familyRibbon.ts`

地图：

- 轮廓来自预览 HTML 的世界 `<path>`，放进 `public/maps/`。运行时不请求瓦片、不地理编码。
- 香港和伦敦用固定经纬度投到这块轮廓上：伦敦在香港左上方。人数写在航线卡片上，不压在国界上。
- 弧线从香港连到伦敦，实线，线宽按使用中人数。学生、家长、商旅三行人数写在同一张卡片上。地图不能切换航线。

入会图：小漏斗三层宽度是去重人数。累计曲线横轴六个书签，当前书签一根竖线；已走过为实线，未到的点变淡。9 月 16 日的点只标留学生赴英报到。

服务漏斗：三层 + 层间流失。`A` 的支付层为空，转化率是 0。`P` 旁注「含演示對齊」。主数字下方同时看得见 154/182 与 154/157。

家庭分流：

1. 左：实色源，已发出 38（在 `P`）。
2. 中：色带宽度 = 关系数，接到细的分流条。已接受最粗。六状态按 `familyStatus` 的顺序排。人数为 0 的状态写出 0，不铺一条有颜色的带。
3. 右：白底卡只从「已接受」分出。已授权绿签，已互联未授权金色签。卡上是人数和比率。
4. 图下三枚计数：9、2、1（`P`）。文案说明支付和授权是两条线。

`familyRibbon` 有单测：人数都为正时 path 非空且以 `M` 开头；某一状态为 0 时不为该状态生成有面积的带。

**完成标准**（浏览器里能指认，数字与 T3 一致）

- `P`：只有 LHR 154，卡片上有学生、家长、商旅三行。
- 漏斗顺序为了解服务 → 到达结算 → 支付成功。
- 分流图能读出发出 38、已接受 29、已授权 18、已互联未授权 11，以及三类缺口。页面上没有演示姓名。
- 系统开启减少动态效果时，拨钟不播放 400ms 过渡。

---

### T7 · 其余五张图

**对应** Plan M4。

**产出**：`RevenueComposition`、`IncrementBars`、`LagRuler`、`TierColumns`、`PromoSplit`

| 图 | `P` 上必须能读到 |
| --- | --- |
| 构成条 | 三段相加 = 283400。第二行斜纹为收入的 35%，实色为贡献利润。斜纹上写占位句。未支付订单不在条上 |
| 增量 | 学生、家长、商旅分列。实色已完成周，斜纹本周至今。没有航线切换。单位注明演示缩放值。没有会员 / 订单 / 班次链接 |
| 时间尺 | 轴从 0 拉到不少于 85.67。P50、P90 各一枚刻度。直方图在轴下，不替代刻度。文案是「入会之后多久发生第一笔支付」。`A` 整条轴空着，写「無樣本」 |
| 等级柱 | 四根柱，柱高是人数，填色比例是使用率。`P` 没有 Diamond Exec 的空柱。拨到 `E` 后出现第五根，人数 8，使用率不是 100%，名称是「鑽石行政卡」 |
| 优惠码 | 使用率 0.3052。家庭码 24 单与官方学生码 23 单分列，可展开到 `HKSTUDENT` 和三个家庭码（`PLUME-ENROL`、`PLUME-GRAD` 在 `P` 为 0）。ROI 是锁，不是仪表 |

**完成标准**：AC-1 至 AC-12 的数字在图上和 T5 的主数字一致。筛选家长时第 1、4、8 块图形不改变，第 5 块只剩家长行，第 7 块人数之和为 52。

---

### T8 · 组装与演示走查

**产出**：`App.tsx` 接上会员分支；确认 `npm run dev` 与 `npm test`。

讲解人只拨书签。四张图的学期节奏与 Plan §4 一致：

| 书签 | 应看到 |
| --- | --- |
| `A` | 伦敦线上使用中为 0；累计 14；支付层为空、转化率 0；邀请尚未发出；第 6 块无样本 |
| `C` | 伦敦线使用中 49；这一跳只代表留学生赴英报到；累计 140 |
| `P` | 累计 182，今日 0、本周 0；154/182；38 → 29 → 18；三类缺口 9 / 2 / 1；第 5 块本周至今 3900；没有钻石行政卡 |
| `E` | 累计 213；第 7 块多出钻石行政卡 8 人，使用率 0.6250 |

**完成标准**

- `npm run dev` 打开会员看板；默认 `P`；拨到 `A` 与 `E` 后上表成立。
- `npm test` 全绿。
- 货舱总览仍能打开，点进一班详情再返回。货舱词条与引擎文件无行为变化。
- 1920×1080 下，1080px 版心里八块按 §2 的顺序接在地图下面，数字能读完，不把八块挤进一屏横图。
- 顶栏、书签、八块、地图、浮层里都没有会员姓名、`member_id`、订单号。
- 文案没有把 35% 写成已确认成本，没有算出 ROI，没有「已同步航司 / 零超载」。

---

## 5. 总完成标准

1. **模块**：`members/engine/` 无 React；页面文件无比率公式；地图、漏斗、分流、五张图分文件。
2. **口径**：`A` / `P` / `E` 与 `kpi-at-bookmarks.json` 一致；T3 对照表里多出来的拆分有测试。全周期 214 只存在于快照，不作为当前累计。`E` 的累计是 213。
3. **筛选**：家长筛选改第 2、3、5、6、7 块；第 1、4、8 块与地图保持全量并标明。三条不变量成立。
4. **隐私**：视图模型与 DOM 文本都不含四个演示姓名和会员 id。
5. **双语文案**：`mb.*` 漏键编译失败。问题原文是繁中。
6. **动态**：拨书签一次重算八块。减少动态效果时宽度直接跳变。
7. **测试已跑**：`kanban-app` 内 `npm test` 通过。
8. **范围**：无邀请、无改等级、无催付、无退款、无在线地图、无旅客端写入、无 G3/G4/T5、无 `CARGO` 书签、无 `CXFAMILY`、无 Diamond Plus。

---

*实现时以 Plan 与种子快照为准。预览 HTML 只定版式。本文的对照数字是种子 `20261111` 的切片，不代表国泰实际会员或票款。*
