# Plume Light 前端演示影片：分功能片段 + 90 秒完整版

面向评委的前端介绍片：1920×1080、30 fps、90 秒，繁中与英文各一版。不设片头介绍，第一帧就进入产品。
成片在上一级目录：

- `video/plume-light-showcase-90s-1080p.mp4`（繁體中文）
- `video/plume-light-showcase-90s-en-1080p.mp4`（English）

界面画面全部来自对真实站点的截图，不是重画的示意图；镜头、光标、字幕与配乐由本目录的代码生成。

## 分功能片段

每个功能一支 5–15 秒的独立短片（1080p、无配乐、首尾淡入淡出），在 `video/clips/<语言>/`：

| 文件 | 功能 | 时长 |
| --- | --- | --- |
| `01-languages.mp4` | 多语言切换（含阿拉伯语 RTL） | 5.5 秒 |
| `02-stories.mp4` | 旅客故事轮播 | 5.4 秒 |
| `03-deadlines.mp4` | 按地区计算下单截止时间 | 5.4 秒 |
| `04-baggage.mp4` | 逐件行李预报 | 5.5 秒 |
| `05-pricing.mp4` | 拖拽分配泳道、价格即时更新 | 7.1 秒 |
| `06-checkout.mp4` | 现金 / 里数结算 | 5.5 秒 |
| `07-assistant.mp4` | AI 出行助手：线上 OpenAI 助手的流式回复与逐项结论 | 12.8 秒 |
| `08-journey.mp4` | 行程追踪：三个交接、里数入账 | 9.4 秒 |
| `09-family.mp4` | 家庭专区：互联、里程碑、权益表 | 7.6 秒 |
| `10-cargo.mp4` | 货舱看板：超限一览、航班详情与延后建议 | 14.9 秒 |
| `11-members.mp4` | 用户看板：学期书签、家庭关系流向 | 5.9 秒 |

片段不是另做的一套动画，而是从完整版的分镜里各取一段：`film.js` 顶部的 `CLIPS` 表写明每段取哪个分镜、
从第几秒到第几秒、播放速率（`rate` 小于 1 是放慢）。要增删片段或调起止点，改这张表即可。

```bash
node showcase/tools/render.mjs --clips               # 全部片段（繁中），无配乐
node showcase/tools/render.mjs --clips --lang en     # 英文版
node showcase/tools/render.mjs --clip pricing        # 只重导一个
node showcase/tools/render.mjs --clips --with-audio  # 需要配乐时：逐个合成并混入
```

浏览器里预览单个片段：`index.html?clip=pricing`。

## 90 秒完整版的分镜

| 时间 | 内容 |
| --- | --- |
| 0:00–0:12 | 行程首页：五种语言切换（含阿拉伯语 RTL）、旅客故事轮播 |
| 0:12–0:32 | 预约流程：按地区计算截止时间 → 逐件申报 → 拖拽分配泳道、价格即时更新 → 现金 / 里数结算 |
| 0:32–0:44 | AI 出行助手：提问 → 追问规格 → 三层回答 → 确认后回写清单 |
| 0:44–0:52 | 行程追踪：三个关键交接、服务完成后里数入账 |
| 0:52–0:58 | 家庭专区：成员互联、家庭搬运里程碑、会籍权益表 |
| 0:58–1:18 | 营运看板：货舱超限一览 → 航班详情与延后建议 → 重量 / 体积与航段切换 → 用户看板按学期书签回看 |
| 1:18–1:30 | 技术栈与数字、收尾标志 |

转场有两种：分镜之间，上一个窗口向左摇出、下一个窗口同时从右摇入（`film.js` 的 `inOut`）；
同一分镜里换页，旧页停在原滚动位置淡出、新页淡入，镜头连续不跳切（`Win.pages` 里标 `'nav'` 的条目）。
各分镜内部沿用较宽松的原始节奏写时间，由 `scene(id, a, b, span, …)` 等比压缩到实际时长。

片中数字的出处：11 个页面（`src/config/routes.ts` 的 `PAGE_FILES`）、5 种语言（`src/services/i18n.ts` 的 `LOCALES`）、
1,018 条文案键（`src/config/copy.json`）、200 项测试（根目录 `npm test`）。站点更新后这些数字要跟着改（`film.js` 里搜 `KPIS` 和“文案鍵”）。价格、里数等均为站点自带的演示数据。

## 在浏览器里看

直接用浏览器打开 `index.html`（英文版加 `?lang=en`）。空格播放 / 暂停，左右方向键逐秒跳转，`?t=42` 可停在指定秒数。

## 重新生成

改了站点界面后，按下面的顺序重做（都在 `video/` 目录下执行；首次需要 `npm ci` 和 `npx playwright-core install chromium`）：

```bash
# 1. 准备站点：用已部署的线上地址（AI 助手一段需要可用的 OpenAI 后端），
#    或在仓库根目录本地启动（本地没有密钥时，AI 助手一段采不了）
PLUME_PORT=8137 node tools/start.mjs --no-open

# 2. 采集截图与元素位置 → shots/<语言>/
node showcase/tools/capture.mjs --base https://<线上地址>/ --lang zh-Hant
node showcase/tools/capture.mjs --base https://<线上地址>/ --lang en

# 3. 导出音效时刻表并合成配乐 → audio/soundtrack-<语言>.m4a
node showcase/tools/render.mjs --lang zh-Hant --cues && python3 showcase/tools/build_audio.py --lang zh-Hant
node showcase/tools/render.mjs --lang en --cues && python3 showcase/tools/build_audio.py --lang en

# 4. 逐帧导出 MP4（每支约 3 分钟）
node showcase/tools/render.mjs --lang zh-Hant
node showcase/tools/render.mjs --lang en
```

只想看某一刻的画面：`node showcase/tools/render.mjs --stills 20,43,93`，静帧写到 `showcase/.build/stills/`。

## 文件

- `index.html` / `film.css` / `film.js`：影片本体。`render(t)` 是时间的纯函数，同一个 `t` 永远画出同一帧。
- `tools/capture.mjs`：用 Playwright 真实操作站点（切语言、拖拽、支付、交接事件、看板钻取…）并截图。
  AI 助手一段是向线上助手真实提问：生成期间在页面里记录对话区的每次变化，结束后逐个放回再截图，所以每一帧都是应用当时渲染的内容；
  回复内容由模型决定，每次重采都会不同。采集时把对话框展开了（页面里它限高 400px、内部滚动）。
- `tools/build_audio.py`：程序合成的原创配乐与界面音效，120 BPM，分镜都切在小节线上。需要 numpy、scipy 与 macOS 自带的 `afconvert`。
- `tools/render.mjs`：多路并行逐帧截图，交给 ffmpeg 编码并混入音轨。
- `assets/plume-light-logo-white.svg`：由仓库 `assets/plume_light_logo_horizontal_reversed.svg` 去掉底色矩形得到。
