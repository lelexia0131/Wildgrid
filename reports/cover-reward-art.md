# 封面与荒野求生结算美术升级

## 实现

- 封面采用黄色、圆钝、错位的双语卡通 Logo。透明 WebP 保留原始分辨率（中文 1774×887、英文 2172×724），无运行时字体或网络依赖。
- 横屏与竖屏分别使用手绘林地背景，通过 `picture` 按方向选择。背景降低对比，中央营地仍使用原有 SVG；复用原有入场、可见性暂停和减弱动画机制。
- 经验模块只保留小号 `+数值`、当前累计值／下一身份累计门槛和叶片进度条。已有经验为绿色，本次新增为暖金绿色，叶片跟随增长并在结束时亮一次。
- 经验动画延迟 360ms 开始，增长 1200ms。读取结算快照 `xp - earned` 到 `xp`，按 `SURVIVAL_RANKS` 累计门槛拆段，跨级先填满、停留、再切换下一身份。条形使用连续小数插值，数字取整；最高身份保持满条并继续累计数字。
- 动画组件不调用存档或结算 API；关闭、卸载会取消 animation frame，保存不会重启动画，重复打开重新初始化。减弱动画时直接显示最终状态。

## 文件

- `src/ui/App.tsx`：接入背景与经验模块，保留操作回调。
- `src/ui/components/GameTitle.tsx`：中英文 Logo 切换。
- `src/ui/components/MenuLandscapeBackground.tsx`：横竖屏封面背景与少量光点。
- `src/ui/components/HeroArt.tsx`：柔化原营地底部投影。
- `src/ui/components/SurvivalRewardPanel.tsx`：只读动画、经验条、难度／通关 SVG 徽记。
- `src/ui/components/survivalRewardAnimation.ts`：分段与帧计算。
- `src/ui/styles/hero.css`、`menu-landscape.css`、`completion.css`：布局、视觉和轻量动画。
- `src/ui/styles/survival.css`、`viewport.css`：移除本次替换的旧结算样式。
- `src/localization/ui.ts`：双语标签与数值格式。
- `tests/survivalRewardAnimation.test.ts`、`tests/art-upgrade-ui.cjs`、`tests/home-visual-smoke.cjs`：针对性验证。

## 美术资产与提示词

使用内置 `image_gen`，未使用 CLI/API fallback。以下文件均保存在项目中；Logo 无损编码为 WebP，背景以质量 86 编码为 WebP。舍弃的草案不接入项目。

### `src/assets/branding/wildgrid-zh.webp`

最终提示词（对黄色木质草案重设计）：

> Completely REDESIGN the LETTER SHAPES of this Chinese game logo 野格. The user rejects the current conventional calligraphy-looking rigid type. Make it genuinely PLAYFUL CUTE CARTOON GAME LETTERING: squat wide plump blocky strokes with rounded corners, exuberant bouncy irregular silhouette, chunky soft carved toy-like shapes, distinctive funny proportions with different stroke widths and slightly uneven counters. The first character leans a little counterclockwise, the second leans clockwise and sits slightly higher. They should feel lively and cuddly, not formal. DO NOT use Kaishu, regular script, Songti, calligraphy, brush-style tapered long strokes, or standard typesetting with decorative bevels. Preserve exact correct readable Chinese text 野格. Use the same sunny buttery CREAM YELLOW and honey-gold face palette, simple soft shading, cream edging and a restrained short warm-brown bottom layer. Much less bevel depth and much less realistic wood grain than reference, more clean polished 2D cartoon game art. Tiny simple green sprout on top, very small pine twig at one bottom corner. No giant decoration, no signboard, no extra text or subtitle. Tight wide horizontal composition about 2:1, transparent alpha background, no checkerboard. The focus is a newly designed joyful bubbly custom glyph silhouette, not material realism.

### `src/assets/branding/wildgrid-en.webp`

依据最终中文 Logo 生成同系列英文，随后修正为全部大写。最终修正提示词：

> Make one precise typography correction: both dotted lowercase i letters must become uppercase capital I with NO DOT. Exact all-uppercase spelling WILDGRID. The second and seventh letters are capital I: one tall chunky continuous vertical shape with short rounded top and bottom bars, same height as neighboring letters. Preserve every other letter, the playful rounded yellow style, proportions, cream border, brown shallow edge, green decorations, transparency and overall composition unchanged. Remove the detached dots and connect/replace each entire i with a real full-height uppercase I. No background, keep genuine alpha transparency.

### `src/assets/backgrounds/home-woodland.webp`

最终提示词（简化初版手绘背景）：

> Edit this background for a cozy flat 2D cartoon camping puzzle game. Preserve the quiet central clearing and edge framing, but substantially simplify the entire painting into polished cute storybook game illustration with rounded organic shapes and only 3-4 tones per object. It is currently far too realistic and intricate. Make tree trunks simple warm brown with a few gentle bark marks, leaves in larger rounded clusters, ferns and flowers charming stylized shapes, rocks rounded and soft. Use pale sage, warm cream and muted honey palette. Reduce contrast and make the central 60 percent a very softly colored open clearing with few details. Edge foliage remains carefully hand-designed with subtle texture, no realistic tiny leaf rendering, no realistic grass, no huge mountains, no large sun, no tents, no characters, no text, no logo, no UI. Aim for elegant flat indie-game illustration, crisp softly painted edges, modest gouache texture, not generic giant polygon mountains and not photorealistic landscape.

### `src/assets/backgrounds/home-woodland-portrait.webp`

最终提示词：

> Create a PORTRAIT 2:3 mobile screen version of this exact stylized hand-painted woodland clearing background. Recompose rather than cropping: keep both slender tree trunks and leafy branches framing the left and right edges, little ferns, rounded stones and flowers in bottom corners, quiet open warm pale sky at top and quiet clearing in the central 65 percent. Same muted sage, cream and honey palette, same simplified charming flat 2D storybook style and subtle texture. Keep the middle very calm for separately overlaid game logo, isometric campsite and buttons. No campsites, tents, people, logos, lettering, buttons or UI. The forest should frame the center gently and must not dominate it. High resolution vertical image.

## 验证命令

```text
npm run build
node node_modules/tsx/dist/cli.mjs --test tests/survivalRewardAnimation.test.ts
node node_modules/electron/cli.js tests/art-upgrade-ui.cjs
node node_modules/electron/cli.js tests/home-visual-smoke.cjs
```

界面检查覆盖中英文、1280×720、1024×600、390×844、360×640、320×568、844×390，以及手机安全区、保存提示、跨级动画、最高身份、快速关闭、重玩不重复奖励和减弱动画。Android 为 Electron Chromium 的移动视口与 Android UA 模拟，未执行 Android 真机测试。截图位于 `.desktop-smoke/art-upgrade/` 和 `.desktop-smoke/home-visual/`。
