# 素材与工具来源

## 可发行素材

- 棋盘岩石采用 Kless Gyzen 创作的 **Rock Moss Set 01**。六个不同的扫描轮廓各自减面，重新确定地面原点与占格比例，压缩法线，重新映射岩面和苔藓的颜色。原始 glTF 及四个关联文件通过发布者的 MD5 校验后合并为本地源 GLB，SHA-256 为 `520eb7573bf8154eebc6439fee7debfa7c45c85c5b3b8ed3a1619146ecfa1c39`。Poly Haven 以 CC0 1.0 发布这些模型，允许商业使用与再分发。[作品页](https://polyhaven.com/a/rock_moss_set_01) · [资产许可](https://polyhaven.com/license) · [随包署名](../../public/art-licenses/CREDITS.txt)
- 其余营地设施、树木、云层、草花、营火、地表、水岸与天空设施在本项目内程序化建模。烟、桨叶、旗、风筝、火苗和水波在运行时驱动，所有缩略图都取自模型。[建模工具](../../scripts/art-3d)
- 草地与材料图集来自内置 ImageGen，经过柔化、提亮、裁切并随游戏分发。早期林地远景位图仅保留为过程资料，当前关卡的远景由场景几何实时渲染。[草地源图](meadow-source.png) · [材质源图](material-source.png) · [远景源图](woodland-source.png)
- 用户提供的两张设计图和原 ZIP 只用于内部视觉比对。原 ZIP 的 SHA-256 为 `d4598fe446778ffc1ffcce3961e462fbd9872df5fa24df84194e7842c0c0cee5`（见下方校验命令）。[参考资料](references)

```powershell
Get-FileHash docs/3d/references/Wildgrid_3D_Reference_Pack.zip
Get-FileHash docs/3d/rock-moss-source.glb
```

## 技术与技能

| 工具 | 评估与实际使用 |
| --- | --- |
| Three.js r187，MIT | 使用 WebGL2、正交投影、标准 glTF 金属度与粗糙度材质、实例化、阴影和按需渲染。作为既有 React 棋盘的延迟加载渲染层，共用既有按钮与命令。[项目](https://github.com/mrdoob/three.js) |
| React Three Fiber 与 Drei | 评估了 React 场景树和控件。当前棋盘已持有语义网格、教程定位和状态协调，采用直接投影能继续复用这些入口，也少引入一套指针事件处理。[R3F](https://r3f.docs.pmnd.rs/getting-started/introduction) · [Drei](https://github.com/pmndrs/drei) |
| Three.js 性能技能，MIT | 阅读完整 `threejs-performance/SKILL.md`，实际采用实例化、资源复用、限制像素密度和绘制统计。在真实视口测量，再区分软件与硬件 GPU。[已查阅的版本](https://github.com/emiliodominguez/threejs-skills/blob/ac4464c88ea395fc7df938de8db912b81d18c768/skills/threejs-performance/SKILL.md) |
| 官方 Playwright 技能，Apache-2.0 | 查阅完整技能和 CLI、工作流参考。采用隔离浏览器、实际点击、触摸、逐次截图和对比。回归脚本使用固定版本的 Playwright Core 与本机 Chrome。[技能](https://github.com/openai/skills/tree/49f948faa9258a0c61caceaf225e179651397431/skills/.curated/playwright) · [Playwright](https://github.com/microsoft/playwright) |
| Blender 与 glTF | 评估 Blender 的官方 glTF 进出流程。本机未发现 Blender 可执行程序，建模与离屏出图使用 Three.js、glTF Transform、meshoptimizer 和 Sharp。GLB 可在支持 glTF 的编辑器中查看。[Blender glTF 工具](https://github.com/KhronosGroup/glTF-Blender-IO) · [glTF Transform](https://gltf-transform.dev/modules/core/classes/NodeIO) · [meshoptimizer](https://github.com/zeux/meshoptimizer) |
| 已装技能与插件目录 | 使用本机 ImageGen 技能的材质提示和文件交付流程。使用技能和插件目录检索 Three.js、Blender 与建模能力。外部 AI 建模服务需要独立账号或计费，本次制作采用本地资产管线。 |

运行时增加 Three.js。Playwright、类型定义、glTF Transform、meshoptimizer 与 three-mesh-bvh 属于开发依赖。建模器离线采样半球方向的遮挡，将屋檐、木料接缝和树枝内部的接触阴影写入顶点颜色。版本以 npm 锁文件为准。[three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh)

## ImageGen 提示记录

以下是内置工具实际使用的三条素材提示。

1. Create a square, seamless, orthographic overhead albedo texture for the grass on a handmade miniature camping board. Extremely fine short flocking, soft mossy turf and tiny grass fibers. Meadow sage, olive, warm pale yellow-green tips. Even diffuse light, subtle mottling at two scales. The whole image is the same continuous surface with consistent grain and detail, suited to repeat across a game terrain. No objects, rocks, flowers, grid, borders, horizon, hard shadows, letters, vignette or isolated tufts.
2. A precisely divided 2 by 2 square PBR base color material atlas of four exquisite tactile miniature diorama surfaces, four equal edge-to-edge squares, no gutters, no border, no typography. Top left: rich golden ochre woven canvas tent fabric with very fine interwoven threads, faint natural mottling and absolutely no folds or seams. Top right: rich cinnamon-brown hand-hewn cedar with fine natural horizontal flowing timber grain, very few knots. Bottom left: warm light gray granite, subtle mottled mineral inclusions, very fine pale veinlets, subtle golden lichen flecks, NO entire rocks or landscape. Bottom right: lush dense evergreen needles seen very close, fine texture of overlapping green and sage pine needles, no branches or trees silhouettes. Each quadrant is an evenly diffuse-lit full-bleed seamless square macro texture photographed straight on across its whole extent, lighting flat and shadowless. This is a real-time miniature model surface material atlas only.
3. Photoreal cinematic scenic BACKGROUND PLATE for an original miniature outdoor camping game, wide landscape 3:2. Golden afternoon sun falls from upper left through softly defocused pine and oak woodland. Soft olive-green forest, smoky distant mountain silhouettes towards upper right, buttery amber backlight, atmospheric depth, gently blurred foliage around the far left and right edges, light warm meadow moss and a few out-of-focus white wildflowers near the bottom. The entire central 75 percent is an airy low-contrast defocused field of light greens and creamy gold, with no prominent individual object, intended to sit BEHIND a live rendered tabletop scene. Tilt-shift macro, realistic fine coloration, diffused bokeh, understated luminous summer woodland ambience. Full bleed image. NO tables, boards, squares, tiles, game UI, figures, camping equipment, buildings, numbers, logos or lettering.
