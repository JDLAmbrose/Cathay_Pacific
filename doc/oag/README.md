# OAG 接口实测：Plume Light Hackathon

按读者选择：[团队能力清单](CAPABILITIES.md) · [前端 Agent 接入说明](FRONTEND_AGENT_GUIDE.md) · [完整接口参考](API_REFERENCE.md)。

开发接入请先看 [OAG API 接口文档](API_REFERENCE.md)：包含 6 个已验证端点、参数、返回字段、错误处理，以及北京经香港到伦敦的中转计算示例。

验证日期：2026-11-09。结论：桌面 `flightinfo.txt`、`connection.txt`、`master.txt` 三个 key 均可调用对应接口，并取得非空数据。此报告区分已实测结果、文档能力和仍待验证事项。

## 已实测能力

全部使用 `GET https://api.oag.com`，认证头为 `Subscription-Key`。每次只请求 1 条，不自动翻页。实际响应及请求参数保存在 [samples](samples)；其中不含 API key。

| 能力 | 路径与主要参数 | 实测结果 | 项目用途 |
| --- | --- | --- | --- |
| 航班时刻 | `/flight-instances/`，`version=v2`、日期、航司、航班号 | CX257，HKG → LHR，计划时间、航站楼、机型、航程 | 行程页自动填充真实航班资料 |
| 航班状态 | 同上，`Content=Status` | `InGate`，实际/预计起降时间、登机口、值机柜台、行李转盘 | 到达提醒、配送排班参考 |
| 预测座位容量 | `Content=Seats` | 商务 46、超经 32、经济 256，总计 334 | 营运看板的容量参考 |
| 实际配置座位容量 | `Content=ActualSeats` | 本例也返回总计 334 | 用实际配置替代默认机型座位数；并非实际乘客数 |
| 扩展班表 | `Content=ExtendedSchedules` | 订座舱位代码、餐食代码、机上服务代码等 | 航班详情扩展；本例准点表现对象为空 |
| 货运航班 | `ServiceType=Cargo`，HKG、CX | CX2023，HKG → MEL，经停 SYD，机型 74N/B748，`cargoTonnage=137.75` | 展示可研究的货运班表路线 |
| 客运中转 | `/flight-connections/`，`version=v1`、`Service=p` | HKG → BRU → LHR，CX291 + BA389，转机 285 分钟，总时长 1210 分钟 | 中转方案和转机时间展示 |
| 货运中转查询 | 同上，`Service=c` | HTTP 200，有数据；首条仍为上述客运航段，见下方限制 | 仅作待核实的货运路径候选 |
| 机场资料 | `/locations/`，`version=v1`、`AirportCode=HKG` | 机场名称、航站楼、城市、国家、坐标、UTC 偏移 | 机场名称、地图、时间展示 |
| 航司资料 | `/carriers/`，`version=v1`、`CarrierCode=CX` | 国泰名称、CX/CPA、ONEWORLD 等 | 将航司代码转换成名称 |
| 机型资料 | `/equipment/`，`version=v1`、`AircraftCode=351` | Airbus A350-1000、宽体、双喷气发动机等 | 将机型代码转换成易读名称 |

接口返回 `200` 只是第一步；上述结论同时核对了响应中的具体字段。这里没有验证其他产品的订阅权限，也没有登录账号核查配额、计费或授权期限。

## 一条真实航班样例

[CX257 状态响应](samples/flight_status.json) 对应 **2026-11-09**，以下为各机场当地时间：

| 项目 | 香港 HKG（UTC+8） | 伦敦 LHR（本例 UTC+0） |
| --- | --- | --- |
| 计划时间 | 08:10 出发 | 15:00 到达 |
| 实际离开/进入机位 | 08:41 离开机位 | 15:03 进入机位 |
| 实际起飞/落地 | 09:00 起飞 | 14:48 落地 |
| 航站楼 | T1 | T3 |
| 其他 | 登机口 50、值机柜台 C | 行李转盘 9 |

返回状态 `InGate`，状态更新时间为 `2026-11-09T15:24:45.994`（源字段原值）。这些是查询快照；不要作为长期固定的航班时间。前端应展示数据更新时间，允许航站楼、登机口、行李转盘等字段缺失。

## 对本项目最有价值的落点

1. **行程页接真实航班信息**：以“出发日期 + CX + 257”查询班表及状态，替换演示航班时间，展示实际到达、航站楼和行李转盘。
2. **配送排班参考**：用预计/实际到达时间辅助安排机场端取件。飞机落地不代表旅客行李已卸载或完成交接，仍需保留当前逐件交接确认流程。
3. **营运看板增加数据来源**：展示实际机型与座位配置，将旅客自行申报的行李重量单独汇总；用容量估算时必须明确假设。
4. **Cargo 方案探索**：可以展示班表路线与经停点；报价、舱位确认、订舱、运单和物流跟踪需要其他服务。

## 不能从这些结果推导的内容

- **座位容量不是余票、订座人数、上座率或行李重量。** `ActualSeats` 仍是飞机座位配置，不是实际登机人数。
- **`cargoTonnage` 不是剩余可售货舱。** 官方字段说明将它描述为最大货运容量。本例客机返回 `0.0`，货运班表返回 `137.75`；不能用这些值计算实时可用载重，也不能由零值断言客机不运货。
- **没有逐件行李追踪。** `arrival.baggage="9"` 是行李转盘信息，不是某件行李的位置或状态；不能证明“已装机”“已提取”或“已交给物流”。
- **中转是候选班表连接，不保证可购票、可直挂行李或可订货舱。** 本次 `Service=c` 返回的首条两段 `serviceType` 都为 `J`；货运可能涉及客机腹舱，但仅凭响应不能确定纳入规则，不能标作纯货机路线。
- **中转响应有异常日期。** `effectivePeriod.local.startDate` 出现 `1899-12-31`，应标记为异常/待核实，不向用户显示为有效开始日期。中转返回周运营模式及有效期，不是直接带完整日期时区的逐段实时航班实例。
- 本轮没有取得机票价格、额外行李收费、免费托运额度、乘客资料、货运订单或运单。这些不能由上述响应自动生成。

## 复现方法

脚本：[tools/oag_probe.py](../../tools/oag_probe.py)，仅使用 Python 标准库。默认从当前用户桌面读取三个 `.txt` 文件。也可设置 `OAG_FLIGHTINFO_KEY`、`OAG_CONNECTION_KEY`、`OAG_MASTER_KEY`；不需要把密钥复制进代码。

在仓库根目录执行：

```sh
# 航班时刻 + 状态；日期使用起飞机场当地日期
python3 tools/oag_probe.py flights DepartureDateTime=2026-11-09 CarrierCode=CX FlightNumber=257 CodeType=IATA Content=Status

# 实际配置座位容量
python3 tools/oag_probe.py flights DepartureDateTime=2026-11-09 CarrierCode=CX FlightNumber=257 CodeType=IATA Content=ActualSeats

# 香港出发的国泰货运班表
python3 tools/oag_probe.py flights DepartureDateTime=2026-11-10 DepartureAirport=HKG CarrierCode=CX CodeType=IATA ServiceType=Cargo

# 客运中转
python3 tools/oag_probe.py connections DepartureDate=2026-11-10 DepartureAirport=HKG ArrivalAirport=LHR Service=p

# 机场 / 航司 / 机型
python3 tools/oag_probe.py locations AirportCode=HKG CodeType=IATA
python3 tools/oag_probe.py carriers CarrierCode=CX CodeType=IATA
python3 tools/oag_probe.py equipment AircraftCode=351 CodeType=IATA
```

可追加 `--output /private/tmp/oag-result.json` 保存结果；`--key-dir /path/to/keys` 指定密钥目录。默认 `Limit=1`，脚本允许最多 10 条；不重试、不自动分页。脚本已处理 Connections 返回的 gzip 压缩内容。不要把桌面密钥文件复制到仓库或前端；正式接入应经服务端调用。

## 参数、分页和配额注意点

- Flight Info 使用 `/flight-instances/`、`version=v2`、`DepartureDateTime` / `ArrivalDateTime`；航班号只填数字 `257`，航司单独填 `CX`。日期范围最多 31 天，使用代码筛选时带 `CodeType=IATA`。
- Connections 使用 **`/flight-connections/`**、`version=v1`、**`DepartureDate`**，日期范围最多 7 天。不要直接套用示例应用里的 `/api/schedules` 或 `/connections` 路径。
- 中转可按 `ViaPoint`、`Leg1CarrierCode`、`Leg2CarrierCode`、`MinConnectingTime`、`MaxConnectingTime` 等筛选；这些额外筛选本轮未逐项测试。
- Flight Info 和 Master Data 的翻页游标是 `After`；Connections 是 `Cursor`。本次仅取首条，未验证后续页或排序规则。`paging.totalCount` 不应当作已去重的独立航班/可订路线数量。
- 官网列出的免费额度：Flight Info 与 Connections 各 1,000 次/周期、每次最多 10 条；Master Data 100 次/周期、每次最多 1 条，周期为订阅起算的 30 天。**这只是官网免费层说明，不代表已核实这三个 key 的实际套餐或剩余额度。**
- 附加内容的可用性与费用按订阅确定。本轮 `Status`、`Seats`、`ActualSeats`、`ExtendedSchedules` 均取得数据；这不代表未来无额度或费用限制。

## 官方依据

- [Developer Portal：产品、认证示例、免费层说明](https://developers.oag.com/)
- [Flight Info API](https://developers.oag.com/apis/flight-info-v2)
- [Connections API](https://developers.oag.com/apis/flight-info-connections-v1)
- [Master Data](https://developers.oag.com/apis/master-data)
- [附加 Content 参数定义](https://knowledge.oag.com/v1/docs/flight-info-api-content-parameters)
- [Flight Info 字段含义](https://knowledge.oag.com/docs/flight-info-api-response-layout-descriptions)
- [迁移文档：cargoTonnage、参数与限制](https://knowledge.oag.com/docs/flight-info-api-migration-fvxml)
- [公开 OpenAPI：Flight Info](https://subscriptions.oag.com/openapi/flight-info-v2)、[Connections](https://subscriptions.oag.com/openapi/flight-info-connections-v1)、[Locations](https://subscriptions.oag.com/openapi/locations-v1)、[Carriers](https://subscriptions.oag.com/openapi/carriers-v1)、[Equipment](https://subscriptions.oag.com/openapi/equipment-v1)

本轮交付为接口探索、调用工具与响应样例；网站页面尚未接入 OAG。
