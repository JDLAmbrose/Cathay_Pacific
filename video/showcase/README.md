# Plume Light 前端成果演示影片（90 秒）

面向评委的前端介绍片：1920×1080、30 fps、90 秒，繁中与英文各一版。不设片头介绍，第一帧就进入产品。
成片在上一级目录：

- `video/plume-light-showcase-90s-1080p.mp4`（繁體中文）
- `video/plume-light-showcase-90s-en-1080p.mp4`（English）

界面画面全部来自对真实站点的截图，不是重画的示意图；镜头、光标、字幕与配乐由本目录的代码生成。

## 分镜

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
979 条文案键（`src/config/copy.json`）、151 项测试（根目录 `npm test`）。站点更新后这些数字要跟着改（`film.js` 里搜 `KPIS` 和“文案鍵”）。价格、里数等均为站点自带的演示数据。

## 在浏览器里看

直接用浏览器打开 `index.html`（英文版加 `?lang=en`）。空格播放 / 暂停，左右方向键逐秒跳转，`?t=42` 可停在指定秒数。

## 重新生成

改了站点界面后，按下面的顺序重做（都在 `video/` 目录下执行；首次需要 `npm ci` 和 `npx playwright-core install chromium`）：

```bash
# 1. 在仓库根目录启动站点
PLUME_PORT=8137 node tools/start.mjs --no-open

# 2. 采集截图与元素位置 → shots/<语言>/
node showcase/tools/capture.mjs --lang zh-Hant
node showcase/tools/capture.mjs --lang en

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
- `tools/build_audio.py`：程序合成的原创配乐与界面音效，120 BPM，分镜都切在小节线上。需要 numpy、scipy 与 macOS 自带的 `afconvert`。
- `tools/render.mjs`：多路并行逐帧截图，交给 ffmpeg 编码并混入音轨。
- `assets/plume-light-logo-white.svg`：由仓库 `assets/plume_light_logo_horizontal_reversed.svg` 去掉底色矩形得到。
