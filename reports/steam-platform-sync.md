# Wildgrid 三平台同步与 Steam 发布验收

更新：2026-11-15（Asia/Shanghai）。App **5595750**，Depot **5595751**。本次本地构建、官方 Preview 与经用户明确授权的 Upload 均通过；新 **Build ID 26683708**，Depot Manifest **8156473827417933700**。已在 Steamworks 页面交叉核实新构建存在，default 仍为 **26683036**。内部测试分支尚未创建/部署，审核和公开发行未变更。

## 源码与架构

根目录 `D:\Wildgrid` 是唯一 Git 仓库。审查开始时工作区干净，HEAD 为 `936e74b80223686dc2c9fe7968d54531b0039002`。普通 Windows 以 Electron 加载 `wildgrid://game`，Android 以 Capacitor 封装同一份 Web 游戏；Steam 原先依赖忽略目录中的一次性裁剪副本。

对比旧 Steam 副本发现 6 个生成相关模块落后：`facilityConstruction.ts`、`generationBudget.ts`、`generationConfig.ts`、`generationRefinement.ts`、`mapGeneration.ts`、`terrainLayout.ts`。新构建已全部使用根目录版本。旧版本已有 60 关；本次不声称增加了原已存在的关卡。

正式构建入口现在位于受版本管理的 `scripts/steam/`。每次按根 Git 跟踪/非忽略文件清单生成独立快照，用现有 TypeScript AST / PostCSS 裁剪 ID，再注入 Steam 窗口适配。核心玩法、关卡、存档和操作代码没有为本次需求重构。除 5 个预期删除/裁剪的 `src` 文件外，**302 个共享源码文件逐字节相同**。Steam 新增显示组件和窗口模块仅存在于生成副本中。

`steam/` 继续全目录忽略。SDK、SteamCMD、缓存、历史日志、临时源码和成品未加入 Git。旧命令兼容入口转发到根目录脚本，原脚本及旧文档保存于 `steam/logs/architecture-baseline/`。App/Depot、SteamCMD 位置、`../content` 映射及无 `SetLive` 的上传策略保持。

## 实际检查与修改

审查了根 README、ARCHITECTURE、测试说明、Git 状态和历史、package/lock、Vite、TypeScript、Electron Builder、Capacitor、Android Gradle/Manifest/原生插件、Electron main/preload、平台 ID/运行环境、App/设置/语言/视口布局；读取旧 Steam README/状态、全部既有构建/裁剪/验证/打包/上传脚本、VDF、官方 Preview/Upload 日志，并核实本机 Steam 安装记录。

受 Git 管理的修改范围：

| 文件 | 作用 |
| --- | --- |
| `README.md`、`ARCHITECTURE.md`、`package.json` | 三平台说明和四个 Steam 命令 |
| `scripts/steam/README.md` | 构建、验证、认证、上传及后续操作说明 |
| `build-steam.ps1`、`common.ps1`、`build.mjs` | 排他锁、27 个构建门禁、失败记录及目录切换 |
| `paths.mjs`、`source-record.mjs` | 工作目录约束、Git/dirty/源文件摘要和工具链版本 |
| `prepare-source.mjs`、`scan-source.mjs` | 复用既有 AST 裁剪、注入适配、源码一致性与 ID 扫描 |
| `package-game.mjs`、`electron-builder.cjs` | 普通 NSIS 和 Steam x64 目录包 |
| `verify-platforms.mjs`、`verify-content.mjs` | APK/普通 ASAR 资源比对、发行 allowlist、PE/DLL/ASAR 检查 |
| `smoke-packaged.mjs` | 实际 EXE、三个独立启动、保存/恢复、语言和模拟断网 |
| `preflight.mjs`、`record-steampipe.mjs`、`upload-steam.ps1` | 防止旧产物误用、官方清单解析、Upload 授权门禁 |
| `steam-config.json`、`write-vdf.mjs` | 保留既有 App/Depot 及 SteamPipe 映射 |
| `runtime/steam-window.cjs`、`runtime/steam-preload.cjs` | Steam 专属窗口和受校验的 IPC |
| `runtime/SteamDisplaySettings.tsx`、`runtime/steam-display.css` | Steam 显示模式、退出及窗口拖动区域 |
| `tests/window.test.cjs`、`tests/window-layout.cjs` | 窗口状态、安全边界及布局回归 |
| `reports/steam-platform-sync.md` | 本报告 |

表中未写前缀的脚本均位于 `scripts/steam/`。忽略目录内另更新 `steam/README.md`、`steam/STEAM_RELEASE_STATUS.md` 和 3 个兼容 PowerShell 入口，生成 run/logs/content。根 `src/`、`electron/`、Android 原生代码、普通 NSIS 配置、lockfile、ID 后端及 `.gitignore` 无 Git 内容差异。未创建或维护 Steam 独立 Git 分支。

## 三平台一致性与实际验证

| 项目 | 普通 Windows | Android | Steam Windows |
| --- | --- | --- | --- |
| 60 关、双层天空、规则、解法与进度 | 最新共享源码；184 单元测试通过 | 同一共享源码；APK 资源比对通过 | 裁剪后 184 单元测试通过 |
| 生成器、荒野求生、沙盒与本地地图 | 最新生成器；桌面/触摸 UI 回归通过 | 同一游戏 bundle；触摸为 Web 模拟测试 | 最新生成器；真实离线 Worker、保存/导入/游玩/恢复通过 |
| v1 存档、WG1、教程和中英文 | 保留原协议与 origin；兼容测试通过 | 原格式与插件保留 | 原格式与 origin 不变；三次成品启动验证恢复和语言持久化 |
| 原设备 ID | main/preload 逐字节不变；模拟缓存运行验证通过 | Java 插件源码不变；APK DEX 中插件及缓存标识存在 | 从源码和最终发行文件物理移除；动态无 bridge、缓存或请求 |
| 窗口/操作 | 带原生标题栏、默认窗口模式，实测保持 | 原移动端布局和触摸实现保留 | 无边框、默认全屏、显示模式保存、正常退出 |
| 实际构建 | NSIS 成功 | Gradle debug APK 成功，签名验证通过 | x64 完整发行目录成功 |

固定关卡检查验证第 12、14、15、16–60 关唯一解；全 60 关参考解由单元测试覆盖。普通版与 Steam 版的 `ui-smoke` 和连续放置测试均通过，视口为 1280×900、390×844、844×390。Steam 天空沙盒另覆盖编辑/切层/撤销/保存/导出/导入/游玩和投影尺寸。

APK **198 个 Web 文件**全部与根目录本次 `dist` 比对；普通 Windows ASAR 的资源也与同次普通构建比对。普通版和 Android 的时间戳 Service Worker 内容允许不同，其余 Web 资源完全一致。APK 包名 `com.wildgrid.game`，versionName `1.1.0`，versionCode `5`，target SDK 36，v2 签名验证通过，沿用 debug 签名。

**未验证项目**：Android 真机/真实 WebView 操作、干净 Windows VM 安装/升级、此次线上 ID 服务请求、新版本 Steam 客户端下载、Steam Overlay、Steam 客户端离线模式及多显示器硬件。`adb devices -l` 无设备。触摸模拟和 APK 校验不是 Android 真机验证；本地 SteamLibrary 目录复制不是 Steam 下载。普通 Windows ID 运行检查使用隔离的模拟缓存，不声称重新访问了后端。

## ID 与窗口证据

Steam 源码扫描 **124 个代码/样式/JSON 文件**通过；最终发行 **72 个文件和 203 个 ASAR 文件**通过 allowlist、原 ID 标识的 UTF-8/UTF-16 字节扫描。原设备读取、哈希、HTTPS 请求、缓存、重试、状态、IPC、preload、设置、翻译及 CSS 被删除，未采用运行时隐藏。原 ID 专用模块不在包内，未打包 Android、后端、源码或 node_modules。

主入口仅保留剪贴板 IPC；新增窗口模块只接受已验证游戏主 frame 的状态/全屏/退出请求。动态检查没有原 ID bridge、ID UI、`player-id.json`、原服务网络请求或远程游戏资源请求。原生库为 x64，DLL 依赖与随包运行库检查通过。官方 Chromium 二进制本身含通用 `last_backup_android_id` 字符串；该字符串同时存在于未修改的 Electron 发行版，不是原游戏 ID 实现。`ANDROID_ID` 在游戏源码和解包 ASAR 中仍严格禁止。

顶部“野格”是原生窗口标题栏。Steam 使用 `frame:false` 与首次 `fullscreen:true`；保留游戏自身音量/规则/设置按钮及品牌图，不用 CSS 隐藏整个顶部。设置提供显示模式与退出，F11/Alt+Enter 切换逻辑有回归测试。显示偏好独立存入 `steam-display.json`，窗口位置限制到当前可见显示器；修复切换后立即退出时保存旧全屏状态的问题，5 项窗口单元测试通过。

实际窗口和内容边界均为 1280×800 逻辑像素，屏幕缩放 2 倍。1280×720、1366×768、1920×1080、2560×1440、3440×1440、3840×2160 六种模拟桌面视口的菜单、设置和退出可点击。正式 EXE 的设置切换、窗口模式重启、全屏模式重启、退出按钮和退出码 0 均通过。F11/Alt+Enter 另对早期候选做过真实键盘检查；最终 Steam 客户端仍需复验。Windows 的 `isKiosk()` 实现与 `isFullscreen()` 共用状态，因此不把该 getter 当成 kiosk 判据；使用配置检查与真实可切换/可退出行为验证。[Electron 实现](https://github.com/electron/electron/blob/main/shell/browser/native_window_views.cc)

原生截图调用曾触发 Windows 捕获提示的细黄边，随后已停止捕获并重置工具会话；这不是游戏绘制内容或发行资产。最终布局截图由内部渲染截图生成。

## 本次成品与来源

构建 ID（本地）：`20261115T150801Z-48868`；27 个流水线阶段全部通过。构建开始 23:08:01，ready 生成 23:14:03（Asia/Shanghai）。父提交 `936e74b80223686dc2c9fe7968d54531b0039002`，**dirty=true**，包含本次未提交脚本和文档，不能称为纯 commit 构建。499 个实际源文件的路径/大小/哈希及工具版本位于 `logs/source-record.json`。

| 内容 | 值 |
| --- | --- |
| 源码清单 SHA-256 | `6ae7ea2b1f145fdc9249c368a30a50e993a7e4ae625f4f23cc462b669de5c076` |
| Steam 成品清单 SHA-256 | `578103169f0d6c47d2cba2a56074e14a68a68bd1acc64ea3cfe7b3784fab8ccc` |
| Steam ASAR SHA-256 | `deb6bbcc4550d38f513202a274b9048fa283d62fa5249b97fa96e0d2ae62a087` |
| Steam 文件数/字节数 | 72 文件，404,274,982 字节，385.55 MiB；ASAR 203 文件 |
| 普通 NSIS | 127,586,201 字节；SHA-256 `4ecea227af631c73bc41f3cdd513f5b78807c121033338401ce1fbf62f506a2a` |
| Android APK | 21,762,631 字节；SHA-256 `b276136eb48b13f107b8bb8555229c472630234b644cd43c73e53999a81d83cd` |

证据根：`D:\Wildgrid\steam\runs\20261115T150801Z-48868\logs\`。普通安装包在同 run 的 `work/standard-release/`，APK 副本在 `work/wildgrid-android-debug.apk`，Steam 当前成品在 `D:\Wildgrid\steam\content\`。旧本地成功包完整保留于同 run 的 `previous-content/`。

构建只在全部门禁通过后持有排他锁执行同盘目录 rename；失败回滚。Windows 不提供这里所需的双目录原子交换，故有极短切换间隙，但构建与上传共用锁，不读取半成品。失败尝试会使 `current-attempt.json` 标记 failed，并阻止旧 ready 被当作本次成功；该拒绝行为已实际验证。NSIS 最初受沙箱进程限制而失败，后续在获准执行环境中成功；所有失败记录保留，没有据此发布旧包。

## Preview、Upload 与历史版本

历史 Build **26683036** 已由官方上传日志及本机 Steam `appmanifest` 交叉确认；安装 ASAR 与旧 content 一致。此前状态文件“未上传”的文字已纠正，历史文档已备份。

本次官方 Preview 于 **23:15:16** 成功完成。脚本逐个核对 **72 个文件**的路径、大小和官方 SHA-1；官方清单的 74 条目包括 2 个目录。对比既有 manifest `1526212740176029482`，官方日志显示 **2 个文件变更、0 新增、0 删除，约 4.55 MB 变更块**，变更文件为 `resources/app.asar` 和 `Wildgrid.exe`。本地总大小比旧版增加 5,089 字节；核心变化为最新生成器同步、Steam 无边框全屏/显示设置和可靠的构建门禁，原已移除的 ID 未重新引入。

| 阶段 | 本次状态 |
| --- | --- |
| 本地构建/成品 Preflight | 通过 |
| 官方 SteamPipe Preview | 通过；`logs/preview-result.json` 与当前成品摘要绑定 |
| 正式 Upload | 用户明确授权后通过；23:18:28，官方日志和后台页面双重确认 |
| 新 Steam Build ID / Depot Manifest ID | **26683708 / 8156473827417933700** |
| 内部测试分支 | 尚未创建/部署；当前后台仅有 default |
| default / Valve 审核 / 公开发行 | default 已核实仍为 **26683036**；未提交审核/公开发行 |

`ready-to-upload.json` 的发布布尔字段是打包时快照；后续真实发布状态以同 run 的 `preview-result.json` / `upload-result.json` 和官方日志为准。Preview 不等于上传；本次没有用静态 VDF 校验替代官方 Preview。[SteamPipe 官方说明](https://partner.steamgames.com/doc/sdk/uploading?l=english)

## 后续最少命令与人工环节

```powershell
cd D:\Wildgrid
npm run steam:build
npm run steam:preview
# Preview 通过、报告结果、获得本次正式 Upload 授权后：
npm run steam:upload -- -UploadAuthorized
```

单独普通 Windows / Android 仍用 `npm run package:win`、`npm run android:apk`；仅复核当前 Steam 包用 `npm run steam:preflight`。完整说明见 `scripts/steam/README.md`。

用户已明确授权本次 Upload，并自行完成 SteamCMD 操作；官方日志在 **23:18:28** 确认 Build 26683708 成功，创建 manifest 8156473827417933700，上传 7 个新块。`logs/upload-result.json` 将成功记录与本次成品 SHA-256 绑定；Steamworks 构建页面也显示相同 Build 与 Depot/Manifest。上传没有指派分支。

浏览器标签读取两次超时；原生窗口文字读取随后成功，确认新 Build 和旧 default，以及仅有 1 个分支。继续定位“创建新应用分支”时，Computer Use 返回：`could not determine the current browser URL on Windows with enough confidence to enforce policy`，并强制停止本轮操作。没有用其他界面技术绕过该停止，没有创建分支或提交分支变更。

当前所需人工操作：

1. 打开 [Wildgrid 构建页面](https://partner.steamgames.com/apps/builds/5595750)，刷新并确认 **26683708**。创建 `internal-test` 分支；用于私密测试的访问密码由本人在官方页面设置，不发到聊天或报告。
2. 在 **26683708** 这一行选择 `internal-test`，点击“预览更改”，核对目标分支和 Build 后确认该分支的变更。不要选择 default。
3. 正常退出当前旧版游戏。在 Steam 库 → Wildgrid → 属性 → 测试版选择 `internal-test`，按需输入分支密码，等待 Steam 下载并验证游戏文件完整性。
4. 回复完成后继续核验本机 Build/Manifest/72 个文件摘要，验证从 Steam 启动、默认全屏、F11/Alt+Enter、标题栏、退出、Overlay、焦点切换、存档、中英文及 Steam 离线模式。此轮尚未对新 Build 执行这些真实客户端下载测试。

只有客户端验收成功后才另行请求是否更新 default。当前未请求或取得 default 变更、Valve 审核或公开发行授权。密码、Guard、令牌和认证缓存不写入报告或脚本。

本报告在构建完成后编写，不参与发行包；构建来源以当时的源码清单为准。未提交 Git commit。
