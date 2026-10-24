"""从《CX Brand Guidelines.pdf》提取官方横版 CATHAY PACIFIC 标志（Airline brand · English），生成透明 PNG。

PDF 第 5 页「Rest of world」深色底上的白色标志：字标为矢量 + 少量位图碎片，按高倍率渲染；
其中笔翼只是 81×97 的小位图，因此换成第 12 页同一笔翼的高清版本（189×228）贴回原位置。
输出（按品牌规范：浅色底用 Cathay Jade，深色底用白色；笔翼与字标同色、比例不变）：
  ../../assets/cathay-pacific-logo-white.png
  ../../assets/cathay-pacific-logo-jade.png
依赖 PyMuPDF（pip install pymupdf），仅在更新标志素材时运行：
  python3 v2.2/tools/extract_logo.py
"""
import pathlib

import numpy as np
import pymupdf

ROOT = pathlib.Path(__file__).resolve().parents[3]
PDF = ROOT / "CX Brand Guidelines.pdf"
OUT = ROOT / "assets"
ZOOM = 10
JADE = (0x00, 0x5D, 0x63)  # Cathay Jade · PANTONE 323 · R0 G93 B99
LUMA = np.array([0.299, 0.587, 0.114], np.float32)

# 第 5 页 Rest of world 深色版：笔翼位图与整枚标志的范围（PDF 坐标，pt）
WING = pymupdf.Rect(486, 464, 516, 500)
CLIP = pymupdf.Rect(480, 455, 760, 510)


def white_alpha(pix):
    """白色图形压在纯色底上：按亮度换算成白色的不透明度。"""
    rgb = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, pix.n).astype(np.float32)
    lum = rgb @ LUMA
    # 底色取四边亮度的中位数，并截掉 3% 以下的残留，避免贴回的笔翼带出一圈浅色方框
    bg = float(np.median(np.concatenate([lum[0], lum[-1], lum[:, 0], lum[:, -1]])))
    return np.clip((lum - bg) / (255 - bg) * 1.03 - 0.03, 0, 1)


def main():
    doc = pymupdf.open(PDF)
    alpha = white_alpha(doc[4].get_pixmap(matrix=pymupdf.Matrix(ZOOM, ZOOM), clip=CLIP, alpha=False))

    # 抹掉低清笔翼，换上第 12 页高清笔翼，等比缩放后按原位置居中贴回
    x0, y0 = int((WING.x0 - CLIP.x0) * ZOOM), int((WING.y0 - CLIP.y0) * ZOOM)
    x1, y1 = int(np.ceil((WING.x1 - CLIP.x0) * ZOOM)), int(np.ceil((WING.y1 - CLIP.y0) * ZOOM))
    alpha[y0:y1, x0:x1] = 0
    hi = doc[11]
    rect = hi.get_image_rects(hi.get_images()[0][0])[0]
    scale = WING.height * ZOOM / rect.height
    wing = white_alpha(hi.get_pixmap(matrix=pymupdf.Matrix(scale, scale), clip=rect, alpha=False))
    h, w = wing.shape
    cx = (x0 + x1) // 2 - w // 2
    h = min(h, alpha.shape[0] - y0)
    alpha[y0:y0 + h, cx:cx + w] = np.maximum(alpha[y0:y0 + h, cx:cx + w], wing[:h])

    # 裁到标志外框，四周留 0.5x 安全区（x = 笔翼高度）
    ys, xs = np.nonzero(alpha > 0.02)
    pad = int(0.5 * WING.height * ZOOM)
    alpha = np.pad(alpha[ys.min():ys.max() + 1, xs.min():xs.max() + 1], pad)

    a = (alpha * 255).round().astype(np.uint8)
    for name, color in (("white", (255, 255, 255)), ("jade", JADE)):
        img = np.dstack([np.full_like(a, c) for c in color] + [a])
        pix = pymupdf.Pixmap(pymupdf.csRGB, img.shape[1], img.shape[0], img.tobytes(), True)
        pix.shrink(1)  # 对半缩小（盒式平均），抹平字标里位图碎片的锯齿
        path = OUT / f"cathay-pacific-logo-{name}.png"
        pix.save(path)
        print(f"写出 {path.relative_to(ROOT)}（{pix.width}×{pix.height}）")


if __name__ == "__main__":
    main()
