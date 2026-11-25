# 营地实景与交互验收

本轮使用项目正式入口在 Windows、Chrome 和 Electron 44.5.1 上验收。Git 基线为 `63403f2bb0260f96997f8780fcd4f20f08ba2a00`，交付包含工作区内的修改。

## 实机对照

| 场景 | 观察与证据 |
| --- | --- |
| 第 39 关 | 通过正常摆放篝火完成关卡。结算前后是同一张 WebGL 画布，原帐篷、泳池、篝火和占格全部保留。[游玩](previews/day39-world.webp) · [结算](previews/day39-completed.webp) · [篝火近景动图](previews/day39-fire.webp) |
| 镜头 | 普通左键拖动到水平，再反向抬高。透视投影波及的格子用同一矩阵拾取。复位、正俯视和预设方位仍可用。[平视](previews/day39-horizon.webp) · [正俯视](previews/day30-overhead.webp) |
| 原封面和图纸 | 首页保留原有居中营地图。第 39 关的通关图纸使用原有平面设施与连体足迹。[封面](previews/home.webp) · [答案图纸](previews/day39-blueprint.webp) |
| 相连水源 | 实际编辑出五格连通水域，并移除、补回内部格。横纵共边的格线不生成，四格交点在水面以下，水色深浅以外岸计算。[相连水域](previews/connected-water.webp) |
| 选中与遮挡 | 在同一机位、固定动画下，检查悬停双格帐篷前后的布面像素。设施的完整外圈贴地绘制并做深度测试。[放置预览](previews/placement-preview.webp) |
| 模型与教学 | 泳池有独立水面、入水台阶、救生圈和木踏台。电塔的桁架一直连到顶帽。第一关在同一盘内真实示范两种视图，再由玩家点击开关。[电塔](previews/pylon-camp.webp) · [转向后的电塔](previews/pylon-quarter-turn.webp) · [视图教学](previews/day1-view-demo.webp) |
| 设施栏 | 收起、展开保留选择，撤销仍可用。[长按实拍](previews/tray-long-press.webp)。关闭名称后，两种视图的已摆设施、系留桩、低云和其他固定地形均隐藏视觉标签。[竖屏收起状态](previews/tray-folded-portrait.webp) |

鼠标与触摸长按都测了 850 ms。修复前，内容高过可视区时，长按卡片得到 `scrollbar-width: thin`，轨道为 `block`。修复后，实际 Windows 包里卡片仍进入按下态，列表确实溢出，滚动条宽度和轨道显示都为 `none`。随后滚轮仍能滚动。浏览器另测了键盘聚焦和竖屏库存的实际横向触摸滑动。

## 功能与资源

| 检查 | 结果 |
| --- | --- |
| `npm run art:3d` | 生成 38 个营地与环境构件、6 个岩石模型、68 张透明视图和 65 张场景插画。营地模型库内含独立火舌、水面与装饰构件。 |
| `npm test` | 189 项通过，包含旋转占格、平视与俯视的拾取投影、连片水域的地形高度与格线检查，以及既有玩法、存档、生成器与求解器回归。 |
| `npm run test:3d` | Playwright 验证冒险、求生、本地地图和沙盒。覆盖三级提示、有效与受阻的旋转、撤销重做、切层、切图、降级、名称开关、教程示范、收起库存、长按、横竖屏和第 39 关的真实结算。 |
| `npm run levels:check`、历史合同脚本 | 现行脚本指定的关卡全部通过参考答案和唯一性检查。45 个历史关卡、779 次判定、完整解集与规范化岩石命名后的历史 WG1 字节摘要匹配。 |
| `node scripts/audit-art.mjs` | 313 张游戏图像、2 个 GLB 库和 20 个平台图标通过核对。 |
| Web 和普通 Windows | 生产构建和 x64 NSIS 打包成功。标准 Electron 界面、连续放置及实包启动通过。实际包通过本地 `wildgrid://` 协议绘制营地，鼠标长按和滚轮在这个包内复核。Vite 仍报告有大于 500 kB 的代码块。 |

首关演示临时切换视图，自动演示不写入玩家偏好。主动点击视图开关才保存选择。旧教程进行中的步号按原步骤含义恢复。艺术方向仍以玩家对实拍的验收为准。Android 暂停同步，触摸验证来自桌面浏览器模拟。此轮未执行 Steam 构建、上传或发布。Windows 安装向导的新装、升级和卸载未在本轮执行。

## 渲染测量

在 NVIDIA GeForce RTX 5070 Laptop GPU、ANGLE/D3D11 上，连续缩放 2.2 秒采样浏览器帧间隔。Day 30 高画质、1365×860 的结果为 38 次调用、848,296 个三角形和 502 次采样。低画质触摸模拟、850×412 的结果为 23 次调用、261,690 个三角形和 488 次采样。两组的中位数都是 4.2 ms，P95 都是 4.3 ms。低端显卡和长时间运行的性能仍未实测。

## Windows 成品

本次验收的免安装目录为 `release/camp-world/win-unpacked/`。构建过程曾遇到旧免安装目录中的 DLL 被占用。旧安装包的 SHA-256 为 `b2a2f9f3defd14ca04198131a53058f3c777c101356152916659b01965711009`。已从该包补回 69 个缺失文件，旧目录全部 76 个文件与原包逐个匹配。新版经独立暂存、实包启动与文件校验后才放入交付目录。

| 本次验收时的文件 | 字节 | SHA-256 |
| --- | ---: | --- |
| `release/installers/Wildgrid-Setup-1.1.0-x64.exe` | 130,540,816 | `df2c281d6853096618ed1937bd2bfe5f5e663bd2b5cee3032947d054202c9409` |
| 上述归档安装包内的 `resources/app.asar` | 24,819,407 | `21649a8a1e2002e96b7e974e6de22a8792eea979415fb3886329b5234853e6de` |
| `src/assets/3d/campsite.glb` | 3,912,128 | `4822bf29497eed0e9607d4876e480c7c87318d0eff8302b5cc3c5fd6055cd51c` |
| `src/assets/3d/rocks.glb` | 620,456 | `12146cbdd194b8e9593466eee64433193b8a9fc0f9deeb030fdab812d29eee2c` |

138 个运行资源合计 5,792,826 字节，均在 ASAR 内找到相同内容。生产 Web 包的 278 个文件与 ASAR 内的副本逐字节相同。旧照片远景、参考 ZIP 和制作源均在发行包以外。按正斜杠相对路径排序，对 `src/`、`public/`、`electron/`、`build/` 及根目录 package.json、锁文件、TypeScript/Vite/Electron Builder 配置和 index.html 依次计算路径、NUL、原始字节、NUL，共 484 个输入的 SHA-256 为 `8c5b8e249b115a1d84667418682c4dd385bc0d6eed9de27667b6bfce28c8032d`。

本机复核时，将 `WILDGRID_WINDOWS_OUTPUT` 设为 `D:\Wildgrid\release\camp-world` 后运行 `npm run test:desktop`。原生脚本结果和逐项日志保存在 `.desktop-smoke/review-3d/`。

## 既有 Electron 脚本

本轮执行全部 27 个既有脚本。按逐项重跑的最终结果，16 个通过，11 个未通过。通过项包括标准桌面启动、界面与连续摆放，也包括封面、教程新示范、双语教学插图、天空沙盒和窄屏结算。像素回归在有限动画真正结束后才做比较，保留原来的差异阈值。汇总在 `.desktop-smoke/review-3d/world-ready-native-summary.json`。

以下未通过的脚本在此前保存的改造前对照运行中也未通过。首关视图切换、提示、高低云层、放置和结算另有本轮通过的真实浏览器检查。

| 脚本 | 观察到的失败 |
| --- | --- |
| `adventure-hints-ui`、`chapter-navigation-ui`、`diary-rules-ui`、`interface-ui` | 原生测试进程退出，日志只留下 Crashpad 连接错误。 |
| `art-upgrade-ui`、`survival-ui` | 经验动画或求生数据的历史预期断言失败。 |
| `day31-ui`、`local-maps-ui`、`local-map-preview-ui` | 分别未取得预期的电塔卡片、本地地图页面操作失败、旧视口地图动作可达性断言失败。 |
| `targeted-fixes-ui`、`tutorial-ui` | 前者在 Node 中直接加载 Vite 资源模块时启动失败，后者仍将旧的 board 步骤当作教程首屏。 |
