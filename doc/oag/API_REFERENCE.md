# OAG API 接口文档

适用项目：Plume Light / Cathay Hackathon  
整理日期：2026-11-10  
验证依据：本项目 2026-11-09 起保存的真实请求响应，以及 OAG 官方 OpenAPI。每个样例的精确查询时间见 `checkedAtUtc`。

本文列出当前三个 key 已验证可以访问的 **6 个 GET 端点**。航班状态、座位容量、货运筛选是端点的参数能力，不是独立端点。示例日期用于复现实测，实际使用时应换成旅客行程日期。没有验证的参数会明确标注；接口可用不代表任意航班都具备全部字段。

## 1. 接口清单

| 编号 | 方法与路径 | 版本 | 使用的 key | 用途 | 验证结果 |
| --- | --- | --- | --- | --- | --- |
| 1 | `GET /flight-instances/` | v2 | Flight Info | 按航班号、航线、机场、日期查询班表与状态 | 200，非空 |
| 2 | `GET /flight-instances/{DepartureDate}/{ScheduleInstanceKey}` | v2 | Flight Info | 按实例标识查询单个航班 | 200，非空 |
| 3 | `GET /flight-connections/` | v1 | Connections | 查询两段航班组成的中转方案 | 200，客运和货运查询均非空 |
| 4 | `GET /locations/` | v1 | Master Data | 机场、城市、坐标和时区资料 | 200，HKG |
| 5 | `GET /carriers/` | v1 | Master Data | 航司代码、名称、联盟等资料 | 200，CX |
| 6 | `GET /equipment/` | v1 | Master Data | 机型代码、名称、发动机等资料 | 200，351 |

本项目只判断上飞机后的中转时间，主要使用 **1 + 3**，需要精确刷新已选航班时使用 **2**。其余三个端点用于补充展示信息。

## 2. 通用约定

### 2.1 地址和认证

```http
GET https://api.oag.com/{path}?version={version}
Subscription-Key: <对应产品的 API key>
Accept: application/json
```

| 产品 | 本机密钥文件 | 查询工具支持的环境变量 |
| --- | --- | --- |
| Flight Info | `~/Desktop/flightinfo.txt` | `OAG_FLIGHTINFO_KEY` |
| Connections | `~/Desktop/connection.txt` | `OAG_CONNECTION_KEY` |
| Master Data | `~/Desktop/master.txt` | `OAG_MASTER_KEY` |

这些环境变量由本项目脚本读取，并非 OAG 指定的变量名。密钥只放在服务端请求头中，本文和样例不含密钥。不要从网页前端直接携带 key 调用。

### 2.2 返回格式

五个列表端点使用如下结构，以下为结构示意：

```json
{
  "data": [],
  "paging": {
    "limit": 1,
    "totalCount": 0,
    "totalPages": 0,
    "next": ""
  }
}
```

单航班详情端点直接返回航班对象，**没有 `data` 数组或 `paging` 包装**。

仓库样例额外包含 `checkedAtUtc`、`product`、`url`、`httpStatus` 和 `response`；其中只有 `response` 是 OAG 原始响应正文，其余是本地记录的元数据。

Connections 实测返回 gzip 数据，客户端必须支持解压。Python 查询工具已经处理；curl 示例使用 `--compressed`。

### 2.3 分页

| 端点 | 翻页参数 |
| --- | --- |
| Flight Info 列表、Locations、Carriers、Equipment | `After` |
| Connections | `Cursor` |

`Limit` 在公开规范中为整数 1–1000；订阅可施加更小上限。本项目工具默认 1，限制最多 10，不自动分页。使用后续游标时保留原筛选条件；如果处理 `paging.next`，只允许 HTTPS 的 `api.oag.com`，不要把带密钥的请求发给其他域名。

本轮未验证翻页行为。不能把 `totalCount` 解释成可购票的唯一方案数，或在只取首条时宣称结果最优。

## 3. 航班列表、状态和容量

```http
GET /flight-instances/?version=v2
```

### 3.1 请求参数

以下参数均位于 query。日期参数在 OpenAPI 中分别标为可选，但业务上至少需要 `DepartureDateTime`、`ArrivalDateTime` 之一。

| 参数 | 类型 | 说明 / 示例 |
| --- | --- | --- |
| `DepartureDateTime` | string | 起飞机场当地出发日期/时间；`2026-11-15`，或 `2026-11-15/2026-11-16`；范围最多 31 天 |
| `ArrivalDateTime` | string | 到达机场当地日期/时间，格式及范围同上 |
| `CarrierCode` | string | 航司代码，例如 `CX`；支持逗号分隔 |
| `FlightNumber` | integer | 1–9999，仅数字部分，例如 `331`，不是 `CX331` |
| `DepartureAirport` | string | 出发机场代码，例如 `PEK`；支持逗号分隔 |
| `ArrivalAirport` | string | 到达机场代码，例如 `HKG`；支持逗号分隔 |
| `CodeType` | string | 使用航司/机场代码筛选时传入；`IATA`、`ICAO`，机场另支持 `FAA`；可逗号分隔 |
| `Content` | string | 附加内容，见下表；可逗号分隔，组合请求未单独实测 |
| `DepartureCountryCode` | string | 出发国家/地区的两字母代码 |
| `ArrivalCountryCode` | string | 到达国家/地区的两字母代码 |
| `AircraftRegistrationNumber` | string | 飞机注册号/机尾号 |
| `FlightType` | string | `Scheduled`、`Unscheduled`、`GA`；可逗号分隔 |
| `ServiceType` | string | `Passenger` / `Cargo` 分组，或 `J` / `F` 等 IATA 服务类型代码；不可将分组名与单项代码混用 |
| `Codeshare` | string | `Operating`、`Marketing`；可逗号分隔 |
| `IncludeDiverted` | boolean | 包含备降到目标机场的航班；需要单个 `ArrivalAirport` 和 `Content=Status` |
| `Limit` | integer | 单页条数；探索建议 1 |
| `After` | string | 后续页游标 |

日期、航班号、航司/机场、IATA、Cargo 及下列 Content 已实测；国家、机尾号、代码共享、备降和其他高级过滤本轮未逐项验证。枚举及格式的完整定义以官方 OpenAPI 为准。

| `Content` 值 | 附加返回字段 | 实测情况 |
| --- | --- | --- |
| 不传 | 班表、航站楼、机型、航程、实例标识等 | 已取得 |
| `Status` | `statusDetails[]`：状态、预计/实际时间、登机口等 | CX257 有状态；未来 CX331/CX237 返回空数组 |
| `Seats` | `seatingCapacity.predicted` | CX257 总座位数 334 |
| `ActualSeats` | `seatingCapacity.actual` | CX257 总座位数 334 |
| `ExtendedSchedules` | `bookingClasses`、`inFlightServices` 等 | 有数据，`onTimePerformance` 本例为空对象 |

座位容量不等于余票、已订人数或登机人数。`cargoTonnage` 不是剩余货舱。附加内容权限和费用取决于订阅。

### 3.2 请求示例

```bash
# 环境变量应预先在服务端设置；示例不包含真实 key
curl --compressed --get 'https://api.oag.com/flight-instances/' \
  --header "Subscription-Key: ${OAG_FLIGHTINFO_KEY}" \
  --header 'Accept: application/json' \
  --data-urlencode 'version=v2' \
  --data-urlencode 'DepartureDateTime=2026-11-15' \
  --data-urlencode 'CarrierCode=CX' \
  --data-urlencode 'FlightNumber=331' \
  --data-urlencode 'CodeType=IATA' \
  --data-urlencode 'Content=Status' \
  --data-urlencode 'Limit=1'
```

亦可用本地工具：

```bash
python3 tools/oag_probe.py flights DepartureDateTime=2026-11-15 CarrierCode=CX FlightNumber=331 CodeType=IATA Content=Status
```

### 3.3 核心返回字段

以下路径以单个 `data[]` 对象为根，未列出的字段见完整响应样例。

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `carrier.iata` / `flightNumber` | string / number | 航司和航班号 |
| `departure.airport.iata` / `arrival.airport.iata` | string | 出发/到达机场 |
| `departure.terminal` / `arrival.terminal` | string | 计划航站楼 |
| `departure.date.local` / `departure.time.local` | string | 当地计划出发日期/时间 |
| `departure.date.utc` / `departure.time.utc` | string | UTC 计划出发日期/时间 |
| `arrival.date.*` / `arrival.time.*` | string | 对应的到达时间字段 |
| `elapsedTime` | number | 航程分钟数 |
| `aircraftType.iata` / `.icao` | string | 机型代码 |
| `segmentInfo.numberOfStops` | number | 经停次数 |
| `segmentInfo.intermediateAirports` | object | 经停机场信息 |
| `scheduleInstanceKey` | string | 航班实例标识；详情查询使用 |
| `statusKey` | string | 状态关联标识；不是认证密钥，也不用于本篇详情路径 |
| `statusDetails` | array | 状态记录，可能为空；不要假定有且仅有一项 |

`statusDetails[]` 内的常用字段：

| 字段 | 含义 |
| --- | --- |
| `state` | 当前/记录中的航班状态，例如 `Scheduled`、`OutGate`、`InAir`、`Landed`、`InGate`、`Canceled` |
| `updatedAt` | 状态更新时间，保留源值 |
| `departure.estimatedTime.outGate.utc` | 预计离开机位时间 |
| `departure.actualTime.outGate.utc` | 实际离开机位时间 |
| `departure.actualTime.offGround.utc` | 实际起飞时间，不与机位时间混用 |
| `arrival.estimatedTime.inGate.utc` | 预计进入机位时间 |
| `arrival.actualTime.inGate.utc` | 实际进入机位时间 |
| `arrival.actualTime.onGround.utc` | 实际落地时间 |
| `departure.gate` / `departure.checkInCounter` | 登机口 / 值机柜台 |
| `arrival.baggage` | 行李转盘，不是逐件行李跟踪记录 |

对多个状态记录，应按目标航段及更新时间选择适用记录，不能无条件读取第一项。字段缺失表示未知，不能补成准点或零延误。

样例：[真实状态](samples/flight_status.json)、[预测座位](samples/flight_seats.json)、[实际配置座位](samples/flight_actual_seats.json)、[扩展班表](samples/flight_extended.json)、[货运班表](samples/flights_cargo.json)。

## 4. 单航班详情

```http
GET /flight-instances/{DepartureDate}/{ScheduleInstanceKey}?version=v2
```

| 参数 | 位置 | 必填 | 说明 |
| --- | --- | --- | --- |
| `DepartureDate` | path | 是 | 出发机场当地日期，`YYYY-MM-DD` |
| `ScheduleInstanceKey` | path | 是 | 列表返回的 `scheduleInstanceKey` |
| `version` | query | 本文固定传入 | `v2` |

```bash
# SCHEDULE_INSTANCE_KEY 使用列表响应中的值；日期必须与该实例匹配
curl --compressed \
  "https://api.oag.com/flight-instances/2026-11-15/${SCHEDULE_INSTANCE_KEY}?version=v2" \
  --header "Subscription-Key: ${OAG_FLIGHTINFO_KEY}" \
  --header 'Accept: application/json'
```

实测以 CX331 的实例 key 返回 200。响应直接是航班对象，字段与上节航班对象对应；本例包含空 `statusDetails`。公开规范没有为此操作列出 `Content` 等列表筛选参数，不应假定可照搬。

[完整详情样例](samples/flight_detail.json)。本地 `oag_probe.py` 尚未封装这个详情操作，上述 HTTP 请求可直接使用。

## 5. 中转连接

```http
GET /flight-connections/?version=v1
```

### 5.1 请求参数

本项目查询始终提供出发日期、起终点及中转机场。公开规范将下表参数分别标为可选，这不等于空参数查询一定可用；官方更新说明要求至少给出出发、到达或 via 地点之一。

| 参数 | 类型 | 说明 / 示例 |
| --- | --- | --- |
| `DepartureDate` | string | 始发当地日期或 `YYYY-MM-DD/YYYY-MM-DD` 范围；最多 7 天 |
| `DepartureAirport` | string | 始发机场，`PEK` |
| `ArrivalAirport` | string | 最终机场，`LHR` |
| `DepartureCity` / `ArrivalCity` | string | IATA 城市代码，如 `BJS` / `LON`；城市与机场不是同一个概念 |
| `ViaPoint` | string | 中转机场，`HKG`；支持逗号分隔 |
| `Leg1CarrierCode` / `Leg2CarrierCode` | string | 每段航司，例如 `CX`；支持逗号分隔 |
| `Service` | string | `p` 客运，`c` 货运 |
| `ConnectionType` | string | `o` 同航司连接、`i` 联运连接、`n` offline 连接 |
| `MinConnectingTime` | integer | 过滤实际连接间隔不小于指定分钟数的方案；**不是查询或返回官方 MCT** |
| `MaxConnectingTime` | integer | 过滤实际连接间隔不大于指定分钟数的方案 |
| `TotalMaxElapsedTime` | integer | 全程最大分钟数 |
| `Circuity` | integer | 最大绕行度筛选；本轮未验证边界 |
| `InterAirport` | boolean | 跨机场连接相关筛选；公开描述的航段比较存在歧义，本轮未验证，应用须显式检查两段衔接机场 |
| `Limit` | integer | 单页条数 |
| `Cursor` | string | 后续页游标；注意不是 `After` |

已实测日期、起终点、ViaPoint、两段 CX 航司和 `Service=p`；另一个案例验证了 `Service=c`。其他筛选未逐项测试。

### 5.2 北京—香港—伦敦示例

```bash
curl --compressed --get 'https://api.oag.com/flight-connections/' \
  --header "Subscription-Key: ${OAG_CONNECTION_KEY}" \
  --header 'Accept: application/json' \
  --data-urlencode 'version=v1' \
  --data-urlencode 'DepartureDate=2026-11-15' \
  --data-urlencode 'DepartureAirport=PEK' \
  --data-urlencode 'ArrivalAirport=LHR' \
  --data-urlencode 'ViaPoint=HKG' \
  --data-urlencode 'Leg1CarrierCode=CX' \
  --data-urlencode 'Leg2CarrierCode=CX' \
  --data-urlencode 'Service=p' \
  --data-urlencode 'Limit=1'
```

```bash
python3 tools/oag_probe.py connections DepartureDate=2026-11-15 DepartureAirport=PEK ArrivalAirport=LHR ViaPoint=HKG Leg1CarrierCode=CX Leg2CarrierCode=CX Service=p
```

### 5.3 返回字段

以下路径以单个 `data[]` 为根。

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `connectionId` | string | 连接标识 |
| `departure` / `arrival` | object | 整体起终点 |
| `leg1` / `leg2` | object | 第一、第二航段；**实测不是 `legs[]`** |
| `leg1.carrierCode.iata` / `leg1.flightNumber` | string / number | 第一段航司与航班号 |
| `leg1.departure.localTime` / `leg1.arrival.localTime` | string | 第一段当地时刻，只有时刻，不含完整日期和时区 |
| `leg1.departure.terminalCode` / `leg1.arrival.terminalCode` | string | 航站楼，可能缺失 |
| `leg1.connectionTime` | number | 两段之间的中转分钟数，本例 235 |
| `leg1.elapsedTime` / `leg2.elapsedTime` | number | 各段航程分钟数 |
| `elapsedTime` | number | 含中转等待的全程分钟数，本例 1335 |
| `arrivalIntervalDays` | number | 整体到达当地日期相对始发当地日期的间隔；本例为 1 |
| `leg1.arrivalIntervalDays` / `leg2.arrivalIntervalDays` | string | 实测航段内字段为字符串，解析时注意类型 |
| `daysOfOperation` | array | 运营星期 |
| `effectivePeriod.local` | object | 班表有效日期范围 |
| `isSelfConnection` | boolean | 自助连接标志；不等于已确认该旅客的行李直挂权益 |
| `connectionType` | string | 本例返回大写 `O`；请求筛选值使用小写 |
| `leg1.mctStatus` | string | 源值标记，例如 `II`；不是数值 MCT |

`leg2` 的机场、航司、航班、时刻等结构与 `leg1` 对应。样例中某些有效期起始日期为 `1899-12-31`，应作为异常/待核实值处理；不能把它用作真实航班出发日期。

货运查询的首条样例仍含 `serviceType=J` 的客运航段，不能将 `Service=c` 的结果全部标作纯货机航线。

样例：[PEK → HKG → LHR](samples/connections_pek_hkg_lhr.json)、[客运连接](samples/connections_passenger.json)、[货运连接查询](samples/connections_cargo.json)。

## 6. 机场与地点资料

```http
GET /locations/?version=v1
```

全部为可选 query 筛选；本项目使用精确机场代码查询。

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `AirportCode` | string | 机场代码，例如 `HKG`；可逗号分隔 |
| `CodeType` | string | `IATA`、`ICAO`、`FAA`；可逗号分隔 |
| `CountryCode` | string | 两字母国家/地区代码；可逗号分隔 |
| `CityCode` | string | 城市代码；可逗号分隔 |
| `Limit` / `After` | integer / string | 条数与游标 |

```bash
python3 tools/oag_probe.py locations AirportCode=HKG CodeType=IATA
```

等价请求：`GET https://api.oag.com/locations/?version=v1&AirportCode=HKG&CodeType=IATA&Limit=1`，使用 Master Data key。

| 返回字段（`data[]` 内） | 含义 / 实测值 |
| --- | --- |
| `code.iata` / `code.icao` | `HKG` / `VHHH` |
| `type` / `name` | 地点类型和名称 |
| `terminals[]` | 航站楼代码与名称 |
| `place.city` / `place.country` | 城市和国家/地区 |
| `place.latitude.decimalDegrees` | 纬度，22.30888 |
| `place.longitude.decimalDegrees` | 经度，113.91472 |
| `timeZone.standardUtcVariation` | 标准 UTC 偏移，本例 `+0800` |
| `timeZone.daylightSavingTimes` | 夏令时资料，本例空数组 |

不能把标准 UTC 偏移用于所有日期，尤其是伦敦等有夏令时的地点。中转计算优先使用航班实例返回的完整 UTC 日期和时间。[完整样例](samples/location_hkg.json)。

## 7. 航司资料

```http
GET /carriers/?version=v1
```

| 参数 | 类型 | 说明（均为可选 query） |
| --- | --- | --- |
| `CarrierCode` | string | 航司代码，例如 `CX`；可逗号分隔 |
| `CodeType` | string | `IATA`、`ICAO`；可逗号分隔 |
| `CarrierName` | string | 完整或部分航司名称；可逗号分隔 |
| `PublishingCarrier` | boolean | 是否只查可发布商业班表的航司 |
| `Limit` / `After` | integer / string | 条数与游标 |

```bash
python3 tools/oag_probe.py carriers CarrierCode=CX CodeType=IATA
```

等价请求：`GET https://api.oag.com/carriers/?version=v1&CarrierCode=CX&CodeType=IATA&Limit=1`，使用 Master Data key。

| 返回字段（`data[]` 内） | 含义 / 实测值 |
| --- | --- |
| `code.iata` / `code.icao` | `CX` / `CPA` |
| `name` | `CATHAY PACIFIC AIRWAYS` |
| `alternativeName` | 法定名及其他名称 |
| `alliances[]` | `ONEWORLD` |
| `publishingCarrier` | 是否为发布班表的航司 |
| `domicile` | 注册所在地信息 |

联盟成员身份不能直接证明某张机票可直挂行李。[完整样例](samples/carrier_cx.json)。

## 8. 机型资料

```http
GET /equipment/?version=v1
```

| 参数 | 类型 | 说明（均为可选 query） |
| --- | --- | --- |
| `AircraftCode` | string | 机型代码，例如 `351`；可逗号分隔 |
| `CodeType` | string | `IATA`、`ICAO`、`FAA`；可逗号分隔 |
| `IataManufacturerName` | string | 完整或部分制造商名称；可逗号分隔 |
| `IataModelName` | string | 完整或部分型号名称；可逗号分隔 |
| `Limit` / `After` | integer / string | 条数与游标 |

```bash
python3 tools/oag_probe.py equipment AircraftCode=351 CodeType=IATA
```

等价请求：`GET https://api.oag.com/equipment/?version=v1&AircraftCode=351&CodeType=IATA&Limit=1`，使用 Master Data key。

| 返回字段（`data[]` 内） | 含义 / 实测值 |
| --- | --- |
| `code.iata` / `code.icao` | `351` / `A35K` |
| `specification.iata.manufacturer.name` | `AIRBUS` |
| `specification.iata.model` | `A350-1000` |
| `engine.type` / `engine.count` | `JET` / 2 |
| `bodyCode` | `W`，宽体 |
| `freightClasses` / `validServiceTypes` | 类型参考信息，不是具体航班的可售货运库存 |

[完整样例](samples/equipment_351.json)。

## 9. 本项目：只计算飞行途中的中转时间

### 9.1 调用顺序

1. Connections 查询 `PEK → LHR`，`ViaPoint=HKG`，得到候选连接。
2. 根据候选确定两段各自的当地出发日期，分别请求 Flight Info；第二段可能跨日，不能机械复用第一段日期。
3. 核对航司、航班号、机场、日期、航段序号，避免把代码共享或经停航班的不同记录混淆。
4. 使用适用状态记录的到达 `inGate.utc` 和出发 `outGate.utc` 计算中转间隔；没有状态时使用计划 UTC 时间，并标记 `scheduled`。
5. 如果有适用且来源明确的最低中转时间，计算时间余量；否则返回待确认，不能自行把连接间隔当作 MCT。

### 9.2 已核实的真实例子

下表时间均为机场当地时间，两段都额外查询了具体航班实例。

| 航段 | 航班 | 出发 | 到达 |
| --- | --- | --- | --- |
| PEK → HKG | CX331 | 2026-11-15 16:45（UTC+8） | 2026-11-15 20:30（UTC+8） |
| HKG → LHR | CX237 | 2026-11-16 00:25（UTC+8） | 2026-11-16 07:00（UTC+0） |

```text
香港到达 UTC = 2026-11-15 12:30Z
香港出发 UTC = 2026-11-15 16:25Z
中转时间 = 16:25 − 12:30 = 235 分钟
```

查询时两个实例的 `statusDetails` 都为空，结果仅代表计划间隔。证据：[CX331](samples/flight_pek_hkg.json)、[CX237](samples/flight_hkg_lhr.json)。

### 9.3 业务计算与接口能力边界

```text
可用中转时间 = 下一段出发机位时间 − 上一段到达机位时间
时间余量 = 可用中转时间 − 适用的最低中转时间
```

- 第一段到达时间按实际、预计、计划取可用值；第二段在预测阶段按预计、计划取值。实际出发后的记录用于回溯，不能证明行李已装上第二段。
- 第二段延误不自动延长行李接收截止时间。航司若提供更早的行李转运截止，应另行纳入业务规则。
- 当前响应没有数值形式的适用 MCT。`MinConnectingTime` 是调用者设置的过滤条件，`connectionTime` 是班表间隔，`mctStatus` 是标记；三者都不能当作已获得的 MCT 规则。
- 只有班表时间且缺少 MCT 时，建议输出“中转 235 分钟；最低时间待确认”，不输出保证可达。
- 如使用演示 MCT 或安全缓冲，保存规则来源、版本并标为假设。取消、备降、机场不匹配、数据过期或缺失时，返回异常/待确认，避免继续显示正常可接续。
- OAG 未提供本次旅客实际行李直挂确认、逐件扫描或装机确认。这里的结果只是时间可行性评估。

## 10. 错误处理与调用预算

公开规范列出 `200`、`400`、`401`、`406`、`500`，Flight Info 另列 `404`。本轮成功样例为 200；以下失败处理为客户端实现建议，并非已经逐一触发的测试结论。

| 情况 | 客户端处理建议 |
| --- | --- |
| 200 + 空数组 / 空状态 | 显示“无匹配数据”或“状态暂缺”，不解释为取消或准点 |
| 400 | 检查参数、日期、版本和代码类型；不原样循环重试 |
| 401 / 可能的 403 | 检查 key 与产品权限；不记录密钥 |
| 404 | 核对路径、出发日期与实例 key |
| 406 | 核查服务端错误信息、请求格式及 `Accept`；不要假定是权限错误 |
| 可能的 429 | 停止密集请求，若提供 `Retry-After` 则遵循它 |
| 500 / 网络超时 | 有限次数退避重试；保留旧数据但标记过期 |

建议保存 HTTP 状态及经过脱敏的错误正文；错误正文的实际结构未实测，不应强制假设与成功响应相同。

官网免费层说明为 Flight Info / Connections 各 1,000 次每订阅周期、最多 10 条/次，Master Data 100 次、最多 1 条/次，周期从订阅起算为 30 天。**未登录核查这些 key 的套餐、剩余额度或计费，不能把免费层说明当成账号实际配置。**

缓存机场、航司、机型资料；按预算刷新活跃航班。每分钟轮询两段航班每天会产生 2,880 次请求，不能直接套用到 1,000 次的周期额度。本地查询工具不自动重试或轮询。

## 11. 未验证或未提供的能力

| 能力 | 本轮结论 |
| --- | --- |
| 独立 Schedules API | 未验证当前 key 的权限 |
| Flight Info Alerts 推送 | 未申请/验证，不能假定可用 |
| 数值 MCT / 完整例外规则查询 | 当前已测试响应未提供，不编造端点 |
| 实际已订人数、可售座位、余票价格 | 不能由座位配置响应取得 |
| 可售货舱和订舱 | 未取得 |
| 单件行李位置、转运、装机记录 | 未取得 |

## 12. 工具、样例与官方来源

- [本地 Python 查询工具](../../tools/oag_probe.py)：标准库，无第三方依赖；默认从桌面读取对应 key，也支持环境变量。
- [完整实测报告](README.md)、[响应样例目录](samples)。
- [官方 Developer Portal](https://developers.oag.com/)：认证示例、产品及免费层说明。
- Flight Info：[接口页面](https://developers.oag.com/apis/flight-info-v2)、[OpenAPI](https://subscriptions.oag.com/openapi/flight-info-v2)。
- Connections：[接口页面](https://developers.oag.com/apis/flight-info-connections-v1)、[OpenAPI](https://subscriptions.oag.com/openapi/flight-info-connections-v1)、[更新说明](https://developers.oag.com/whatsnew)。
- Master Data：[接口页面](https://developers.oag.com/apis/master-data)、[Locations OpenAPI](https://subscriptions.oag.com/openapi/locations-v1)、[Carriers OpenAPI](https://subscriptions.oag.com/openapi/carriers-v1)、[Equipment OpenAPI](https://subscriptions.oag.com/openapi/equipment-v1)。
- [Content 参数说明](https://knowledge.oag.com/v1/docs/flight-info-api-content-parameters)、[航班响应字段](https://knowledge.oag.com/docs/flight-info-api-response-layout-descriptions)、[参数约束及迁移说明](https://knowledge.oag.com/docs/flight-info-api-migration-fvxml)。

本文不是公开发布的服务端接口；所有 `/flight-*` 等地址均指 OAG 上游。项目网页尚未因编写本文而接入这些接口。
