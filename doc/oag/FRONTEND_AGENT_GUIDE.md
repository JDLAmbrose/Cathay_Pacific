# 给前端 coding agent 的 OAG 接入说明

更新：2026-11-10。这是开发交接说明，不是已经部署的前端 API 服务说明。

## 1. 目标和当前状态

实现“北京首都 PEK → 香港 HKG → 伦敦希思罗 LHR”的中转时间展示与风险状态。范围仅为第一段到达中转机场到第二段离开的时间，不增加取件、末端配送、货运订舱或付款流程。

先理解三个事实：

1. OAG 上游 6 个 GET 端点已实测，详见 [接口参考](API_REFERENCE.md)。
2. 本仓库的 `tools/serve.py` 目前没有 OAG 代理路由。本文提出的 `/api/flight-connections` **是待实现的自有后端契约，不是可立即调用的地址**。
3. 可以立即使用 [samples](samples) 的已保存快照做前端开发。快照不是实时数据；不要因它来自真实 API 就标成“实时”。

浏览器不持有 `Subscription-Key`，不直接请求 `api.oag.com`。不要将 OAG key 写入 JS、HTML、localStorage、公开环境变量或前端构建产物。服务器持有 key，浏览器请求自有服务器。

## 2. 交付范围

前端需要完成：

- 查询表单：出发机场、目的机场、中转机场、出发当地日期；初始演示为 PEK / LHR / HKG / 2026-11-15。
- 两段航班卡片：航司及航班号、机场、当地日期时间、航站楼；跨日明确显示日期。
- 中转间隔：分钟数与小时分钟文案；显示“计划”或“预计”等依据。
- 风险区域：数据不足时显示“待确认”，不自动显示绿色可达。
- 加载、无结果、实时状态暂缺、过期、请求失败、航班取消/备降等状态。
- 数据来源和抓取时间：`fixture` 快照、`live` 本次查询、`cached` 缓存；不要把这些来源与“计划/预计/实际时间依据”混为一谈。

本仓库为原生 HTML/CSS/JS 多页应用。接入现有项目时复用当前技术栈和多语言文案机制，不需要为了 OAG 重写前端框架。

## 3. 建议的数据访问边界

UI 依赖一个 `searchConnections(query)` 数据适配器，提供两个明确模式：

| 模式 | 数据来源 | 是否需要后端 |
| --- | --- | --- |
| `fixture` | 下文列出的本地 JSON 快照 | 不需要调用 OAG |
| `live` | 本节建议的自有后端接口 | 需要先实现并配置 |

开发模式可以使用 fixture。正式模式请求失败时不要静默换成快照；应展示失败状态。如果允许用户切换到演示，必须显式显示“快照演示”。

### 待实现的后端请求契约

```http
GET /api/flight-connections?origin=PEK&via=HKG&destination=LHR&departureDate=2026-11-15&limit=1
Accept: application/json
```

| 参数 | 类型 | 必填 | 约束 |
| --- | --- | --- | --- |
| `origin` | string | 是 | 三字母 IATA 机场代码；北京首都为 PEK，大兴为 PKX，不能混用 |
| `via` | string | 是 | 本次中转机场，HKG |
| `destination` | string | 是 | 三字母 IATA 机场代码，LHR |
| `departureDate` | string | 是 | 始发机场当地日期，YYYY-MM-DD；必须验证真实日历日期 |
| `limit` | integer | 否 | 默认 1，范围 1–10；不自动请求全部页 |

后端 MVP 可暂时固定两段为 CX、客运 `Service=p`，但应向用户展示该查询范围；不要暗示结果覆盖所有航司。

### 建议返回类型（草案，供前后端共同实现）

以下 TypeScript 仅用于定义数据结构，不要求迁移项目为 TypeScript。

```ts
type Query = {
  origin: string;
  via: string;
  destination: string;
  departureDate: string;
  limit?: number;
};

type Moment = {
  utc: string;   // 完整 ISO 8601，包含 Z 或 +00:00
  local: string; // 完整 ISO 8601，包含机场当地 UTC 偏移
};

type Leg = {
  id: string; // OAG scheduleInstanceKey
  departureDate: string; // 当地出发日期，详情刷新时使用
  carrier: string;
  flightNumber: number;
  origin: string;
  destination: string;
  departureTerminal: string | null;
  arrivalTerminal: string | null;
  scheduledDeparture: Moment;
  scheduledArrival: Moment;
  estimatedDeparture: Moment | null;
  estimatedArrival: Moment | null;
  actualDeparture: Moment | null;
  actualArrival: Moment | null;
  flightState: string | null;
  statusUpdatedAt: string | null; // 保留源值，不为无时区值擅自添加 Z
};

type Assessment = {
  status: "unknown" | "comfortable" | "tight" | "insufficient" | "disrupted";
  connectionMinutes: number | null;
  arrivalBasis: "scheduled" | "estimated" | "actual" | null;
  departureBasis: "scheduled" | "estimated" | "actual" | null;
  minimumMinutes: number | null;
  bufferMinutes: number | null;
  marginMinutes: number | null;
  ruleSource: string | null;
  ruleVersion: string | null;
  ruleIsDemo: boolean;
  reasonCodes: string[];
};

type Connection = {
  id: string; // OAG connectionId
  legs: [Leg, Leg]; // 我们归一化的结构；OAG 原始返回是 leg1 / leg2
  assessment: Assessment;
};

type SearchResponse = {
  source: "fixture" | "live" | "cached";
  fetchedAt: string; // 最早的相关航班快照抓取时间，不能用页面打开时间冒充
  stale: boolean;   // 按后端约定的有效期计算；历史 fixture 不是当前状态
  query: Query;
  connections: Connection[];
  warnings: string[]; // 稳定代码，由前端映射到多语言文案
};

type ErrorResponse = {
  error: {
    code: "INVALID_QUERY" | "NOT_CONFIGURED" | "RATE_LIMITED" | "UPSTREAM_ERROR";
    message: string;
    retryable: boolean;
  };
};
```

建议空结果为 HTTP 200 + `connections: []`；参数错误为 400，未配置为 503，限流为 429，上游错误为 502。上述错误格式也是建议的自有后端规范，不是 OAG 原始错误格式。

### 前端 live 适配器示意

```js
// 只有后端路由实现后才启用 live 模式。
async function searchLiveConnections(query, signal) {
  const params = new URLSearchParams({
    origin: query.origin,
    via: query.via,
    destination: query.destination,
    departureDate: query.departureDate,
    limit: String(query.limit ?? 1)
  });
  const response = await fetch(`/api/flight-connections?${params}`, {
    headers: { Accept: 'application/json' },
    signal
  });
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) {
    throw new Error('接口未就绪或返回格式错误');
  }
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? '查询失败');
  // 实际接入时按上面的契约验证 body，不接受缺字段的伪成功响应。
  return body;
}
```

表单切换时取消旧请求或通过请求序号避免旧结果覆盖新查询。不要在页面初次打开或组件重渲染时反复调用 OAG。

## 4. 现在就能用的 fixture 数据

至少给 agent 提供以下文件；不能只给它一个本机绝对路径却不提供文件内容：

| 文件 | 用途 |
| --- | --- |
| [connections_pek_hkg_lhr.json](samples/connections_pek_hkg_lhr.json) | PEK → HKG → LHR 中转班表 |
| [flight_pek_hkg.json](samples/flight_pek_hkg.json) | 11 月 15 日 CX331 实例 |
| [flight_hkg_lhr.json](samples/flight_hkg_lhr.json) | 11 月 16 日 CX237 实例 |
| [flight_status.json](samples/flight_status.json) | 另一个航班 CX257 的状态字段参考；不要将其状态套到 CX331/CX237 |

包装结构为 `{ checkedAtUtc, product, url, httpStatus, response }`。读取列表响应应使用 `fixture.response.data`，不是 `fixture.data`。详情样例 [flight_detail.json](samples/flight_detail.json) 的 `response` 直接是单个对象。

本仓库 `tools/serve.py` 不公开 `doc/` 目录，所以不能假设浏览器能 `fetch('/doc/oag/samples/...')`。前端任务中可将所需、确认不含密钥的 fixture 复制到测试目录或专用开发资源目录；只在明确的 fixture 模式加载。不要为了方便公开整个文档或密钥目录。

fixture 只匹配上述固定日期和路线；用户输入其他查询时显示“不支持此演示查询”，不能返回同一份快照冒充结果。

## 5. 字段映射与时间计算

| 归一化字段 | OAG 原始字段 |
| --- | --- |
| 连接 `id` | Connections 的 `connectionId` |
| `legs` | 先读取 Connections 的 `leg1`、`leg2`，再匹配具体 Flight Info 实例 |
| 航段 `id` | Flight Info 的 `scheduleInstanceKey` |
| `carrier` / `flightNumber` | `carrier.iata` / `flightNumber` |
| `origin` / `destination` | `departure.airport.iata` / `arrival.airport.iata` |
| `scheduledDeparture.utc` | `departure.date.utc` + `departure.time.utc`，组装为 UTC ISO 时间 |
| `scheduledArrival.utc` | `arrival.date.utc` + `arrival.time.utc` |
| `estimatedDeparture` / `actualDeparture` | 适用 `statusDetails[]` 中 `departure.estimatedTime.outGate` / `departure.actualTime.outGate` |
| `estimatedArrival` / `actualArrival` | 适用 `statusDetails[]` 中 `arrival.estimatedTime.inGate` / `arrival.actualTime.inGate` |
| `flightState` / `statusUpdatedAt` | 适用状态记录的 `state` / `updatedAt`，为空时返回 null |

后端负责归一化当地完整日期时间；使用正确的机场时区和当天夏令时规则，不采用浏览器时区。示例的北京/香港偏移为 +08:00、11 月伦敦为 +00:00，这不意味着伦敦全年 +00:00。

状态记录要匹配目标航段并按时间选择，不能假定 `statusDetails[0]` 永远是最新或唯一记录。

本例的校验基准：

```text
CX331 香港计划到达 = 2026-11-15T12:30:00Z
CX237 香港计划出发 = 2026-11-15T16:25:00Z
connectionMinutes = (出发毫秒 − 到达毫秒) / 60000 = 235
```

前端可以格式化为“3 小时 55 分钟”，但不应自行改写后端的业务判断。

### 风险判断的约束

- 本例的最低时间未知：`status="unknown"`、`minimumMinutes=null`、`marginMinutes=null`、`ruleSource=null`，原因包含 `MCT_UNAVAILABLE`；没有实时状态另加 `STATUS_UNAVAILABLE`。
- `connectionTime` 是中转间隔；`MinConnectingTime` 是查询过滤条件；`mctStatus="II"` 是标记；都不是已取得的数值 MCT。
- 在有效规则及适用条件齐全时，`marginMinutes = connectionMinutes - minimumMinutes`：小于 0 为 `insufficient`；大于等于 0 但小于配置缓冲为 `tight`；达到缓冲为 `comfortable`。缓冲和规则必须有来源，不得用假设值冒充官方值。
- 活跃航程第一段到达按实际、预计、计划取值；下一段出发按预计、计划取值。保留两个独立的 basis，以表示混合依据。
- 取消/备降或两段机场衔接失效，应优先返回 `disrupted`；数据缺失、过期或规则适用性不明，返回 `unknown`。实际出发后的计算只能用于回溯。
- 第二段航班延误不代表行李接收截止自动延后；无相关规则时不要给出更强保证。
- 不依据 `isSelfConnection=false`、同航司、同联盟等字段自动确认实际行李直挂，不生成“已装机”“保证送达”结果。

## 6. 后端 agent 的最小对接任务

如果当前 agent 仅获授权做前端，完成 fixture 页面与数据适配器，标明 live 接口待接；不要声称实时接入已完成。如果任务也包含后端，按以下顺序实现：

1. 校验查询参数，限定上游域名与允许参数，服务端读取 OAG key。
2. 调用 Connections：`DepartureAirport=origin`、`ArrivalAirport=destination`、`ViaPoint=via`、`DepartureDate=departureDate`、`version=v1`。
3. 获取候选后，根据机场、运营日、跨日关系确定各段当地日期；通过 Flight Info 实例核对日期和时间，发现不一致或无法确定时返回待确认，不能仅拼接 Connections 的 `localTime`。
4. 调用 Flight Info：`CarrierCode`、数字 `FlightNumber`、各段 `DepartureDateTime`、机场筛选、`CodeType=IATA`、`Content=Status`、`version=v2`。代码共享、经停、多段情况须匹配实际所需航段。
5. 支持 gzip；列表读取 `data[]`，单实例详情直接读取对象。唯一标识结合当地出发日期使用。
6. 按契约返回归一化数据，保留缺失值与来源；没有 MCT 时返回 `unknown`。
7. 对重复航班查询去重并缓存，限制候选数量和请求频率；不默认每分钟轮询。只返回前端所需字段，不返回认证头。

航司/机型/机场三个 Master Data 接口是可选补充，不应阻塞主流程。完整上游参数、示例和 key 配置见 [API_REFERENCE.md](API_REFERENCE.md)。

## 7. 验收要求

- 固定样例展示 CX331 + CX237，香港连接 235 分钟，第二段日期是 11 月 16 日。
- 在不同浏览器时区下，机场当地时间及 235 分钟结果不变。
- 固定样例明确标为快照，状态基于计划，风险为待确认；无实时数据不显示“准点”。
- 航班状态、航站楼、规则缺失时不崩溃，不用 0 替代未知值。
- 能展示加载、空结果、失败、过期；旧请求不能覆盖新查询。
- 后端未实现时不调用不存在的 API 并假装成功；live 模式失败不静默回退为演示数据。
- 前端代码、网络请求和构建产物不含 OAG key。
- 提交说明区分“已完成快照页面”和“已完成真实后端联调”，只有验证后者才宣称实时接入完成。

## 8. 可以直接发给 coding agent 的任务描述

> 请先阅读 `doc/oag/FRONTEND_AGENT_GUIDE.md`，再按其中的 fixture 数据实现两段航班时间线、中转间隔和待确认状态。第一版只计算上飞机后的中转时间。OAG 上游已验证，但自有 `/api/flight-connections` 尚未实现；请将 UI 与数据适配器分离，默认使用明确标记的快照，不把密钥放进前端。保持本项目现有技术栈及多语言约定。验收样例是 2026-11-15 CX331 接次日 CX237，中转 235 分钟；最低中转规则未知时不显示保证可达。完成后说明哪些使用快照、哪些已真实联调，以及剩余后端依赖。
