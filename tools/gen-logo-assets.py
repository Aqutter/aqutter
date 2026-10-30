#!/usr/bin/env python3
"""由 docs/assets/aqutter-logo.webp（白底）產生各平台 App 圖示與啟動畫面。

用法：python tools/gen-logo-assets.py <app 根目錄> [--nuxt]
  <app 根目錄> 是含 android/ ios/ macos/ windows/ 的 Flutter App（如 aqutter-cli/template/app）。
  --nuxt 另外輸出 aqutter-nuxt-app 的 app/assets 與 public/favicon.ico（參數改給 nuxt 專案根目錄，
  Flutter 部分取其 aqutter/）。
"""
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

SRC = Path(__file__).resolve().parent.parent / "docs" / "assets" / "aqutter-logo.webp"
SURFACE = (0xF4, 0xFB, 0xFA)


def transparent_logo() -> Image.Image:
    """白底轉透明（color-to-alpha），裁到內容邊界。"""
    src = Image.open(SRC).convert("RGBA")
    flat = Image.new("RGBA", src.size, (255, 255, 255, 255))
    flat.alpha_composite(src)  # 來源可能帶 alpha，先壓到白底
    a = np.asarray(flat.convert("RGB")).astype(np.float64) / 255
    alpha = np.clip((1 - a).max(axis=2), 0, 1)
    safe = np.where(alpha > 1e-6, alpha, 1)[..., None]
    rgb = np.clip((a - (1 - alpha[..., None])) / safe, 0, 1)
    rgba = np.dstack([rgb, alpha])
    img = Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), "RGBA")
    return img.crop(img.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox())


LOGO = transparent_logo()


def fit(size: int, ratio: float, bg=None, logo: Image.Image = None) -> Image.Image:
    """把 logo 等比縮到最長邊 = size*ratio，置中放在 size 方形畫布。"""
    logo = logo or LOGO
    s = size * ratio / max(logo.size)
    w, h = max(1, round(logo.width * s)), max(1, round(logo.height * s))
    small = logo.resize((w, h), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), bg or (0, 0, 0, 0))
    canvas.alpha_composite(small, ((size - w) // 2, (size - h) // 2))
    return canvas


def mono(logo: Image.Image) -> Image.Image:
    black = Image.new("RGBA", logo.size, (0, 0, 0, 255))
    black.putalpha(logo.getchannel("A"))
    return black


def save(img: Image.Image, path: Path, opaque=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    if opaque:
        img = img.convert("RGB")
    img.save(path)


def resize_existing(dirp: Path, ratio: float, rounded=False):
    """依資料夾內既有 png 的尺寸重畫（iOS / macOS 圖示）。"""
    for p in sorted(dirp.glob("*.png")):
        size = Image.open(p).size[0]
        if rounded:
            card = Image.new("RGBA", (size, size), (0, 0, 0, 0))
            m = round(size * 0.098)
            body = Image.new("RGBA", (size - 2 * m,) * 2, (255, 255, 255, 255))
            from PIL import ImageDraw
            mask = Image.new("L", body.size, 0)
            ImageDraw.Draw(mask).rounded_rectangle([0, 0, *(body.size[0] - 1,) * 2], radius=round(size * 0.18), fill=255)
            card.paste(body, (m, m), mask)
            card.alpha_composite(fit(size, ratio * 0.82), (0, 0))
            save(card, p)
        else:
            save(fit(size, ratio, (255, 255, 255, 255)), p, opaque=True)


def flutter_app(root: Path):
    res = root / "android/app/src/main/res"
    # adaptive icon：108dp 畫布、安全區 66dp 圓 → 內容最長邊約 58%
    dens = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
    for d, k in dens.items():
        save(fit(round(108 * k), 0.58), res / f"mipmap-{d}/ic_launcher_foreground.png")
        save(fit(round(108 * k), 0.58, logo=mono(LOGO)), res / f"mipmap-{d}/ic_launcher_monochrome.png")
        # 舊版（< API 26）：48dp 白底方形圖示
        save(fit(round(48 * k), 0.82, (255, 255, 255, 255)), res / f"mipmap-{d}/ic_launcher.png", opaque=True)
        # 啟動畫面 logo：120dp 寬
        s = 120 * k / LOGO.width
        save(LOGO.resize((round(120 * k), round(LOGO.height * s)), Image.LANCZOS), res / f"drawable-{d}/launch_logo.png")
    (res / "mipmap-anydpi-v26").mkdir(exist_ok=True)
    (res / "mipmap-anydpi-v26/ic_launcher.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@color/ic_launcher_background"/>\n'
        '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
        '    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>\n'
        '</adaptive-icon>\n', encoding="utf-8")
    (res / "values/ic_launcher_background.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        '    <color name="ic_launcher_background">#0E1514</color>\n</resources>\n', encoding="utf-8")
    launch = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<!-- 啟動畫面：底色 + 置中 logo（tools/gen-logo-assets.py 產生 drawable-*/launch_logo.png） -->\n'
        '<layer-list xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <item android:drawable="@color/launch_background" />\n'
        '    <item>\n'
        '        <bitmap android:gravity="center" android:src="@drawable/launch_logo" />\n'
        '    </item>\n'
        '</layer-list>\n')
    # Android 12+ 系統 splash：用單純的 logo drawable，避免被包進 adaptive icon 的圓形底
    for qual, parent in (("values-v31", "Theme.Light.NoTitleBar"), ("values-night-v31", "Theme.Black.NoTitleBar")):
        (res / qual).mkdir(exist_ok=True)
        splash = (
            '        <item name="android:windowSplashScreenBackground">@color/launch_background</item>\n'
            '        <item name="android:windowSplashScreenAnimatedIcon">@mipmap/ic_launcher_foreground</item>\n'
        )
        (res / qual / "styles.xml").write_text(
            '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
            f'    <style name="LaunchTheme" parent="@android:style/{parent}">\n'
            '        <item name="android:windowBackground">@drawable/launch_background</item>\n' + splash +
            '    </style>\n'
            f'    <style name="NormalTheme" parent="@android:style/{parent}">\n'
            '        <item name="android:windowBackground">@color/launch_background</item>\n' + splash +
            '    </style>\n</resources>\n', encoding="utf-8")
    for d in ("drawable", "drawable-v21"):
        (res / d / "launch_background.xml").write_text(launch, encoding="utf-8")

    ios = root / "ios/Runner/Assets.xcassets"
    resize_existing(ios / "AppIcon.appiconset", 0.80)
    h = round(168 * LOGO.height / LOGO.width)
    for name, k in (("LaunchImage.png", 1), ("LaunchImage@2x.png", 2), ("LaunchImage@3x.png", 3)):
        save(LOGO.resize((168 * k, h * k), Image.LANCZOS), ios / "LaunchImage.imageset" / name)
    sb = root / "ios/Runner/Base.lproj/LaunchScreen.storyboard"
    sb.write_text(re.sub(r'(<image name="LaunchImage" width=")\d+(" height=")\d+',
                         rf"\g<1>168\g<2>{h}", sb.read_text(encoding="utf-8")), encoding="utf-8")

    resize_existing(root / "macos/Runner/Assets.xcassets/AppIcon.appiconset", 0.80, rounded=True)

    ico = root / "windows/runner/resources/app_icon.ico"
    base = fit(256, 0.92)
    base.save(ico, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])


def nuxt(root: Path):
    a = root / "app/assets"
    save(fit(512, 0.92), a / "icon.png")
    save(fit(1024, 0.58), a / "icon-foreground.png")
    save(Image.new("RGB", (1024, 1024), (255, 255, 255)), a / "icon-background.png")
    save(fit(1024, 0.50, SURFACE + (255,)), a / "splash.png", opaque=True)
    fit(64, 0.96).save(root / "public/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])


if __name__ == "__main__":
    target = Path(sys.argv[1]).resolve()
    if "--nuxt" in sys.argv:
        nuxt(target)
        flutter_app(target / "aqutter")
    else:
        flutter_app(target)
    print("done", target)
