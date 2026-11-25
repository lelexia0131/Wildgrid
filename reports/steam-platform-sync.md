# Steam 构建验收快照（2026-11-15）

这是已完成构建的历史证据，不维护当前分支或待办。当前事实以[发布状态](../scripts/steam/RELEASE_STATUS.md)为准；开发、上传、内测与 default 的唯一操作步骤见[Steam 标准流程](../scripts/steam/README.md)。

旧 Steam 副本的 `facilityConstruction.ts`、`generationBudget.ts`、`generationConfig.ts`、`generationRefinement.ts`、`mapGeneration.ts`、`terrainLayout.ts` 与根源码不同，本次已同步。原有 60 关与存档结构保留；Steam 构建仅裁剪设备 ID 和注入窗口适配，未重构共享业务。

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

**该构建验收当时未验证的项目**：Android 真机/真实 WebView 操作、干净 Windows VM 安装/升级、此次线上 ID 服务请求、新版本 Steam 客户端下载、Steam Overlay、Steam 客户端离线模式及多显示器硬件。`adb devices -l` 无设备。触摸模拟和 APK 校验不是 Android 真机验证；本地 SteamLibrary 目录复制不是 Steam 下载。普通 Windows ID 运行检查使用隔离的模拟缓存，不声称重新访问了后端。

## ID 与窗口证据

Steam 源码扫描 **124 个代码/样式/JSON 文件**通过；最终发行 **72 个文件和 203 个 ASAR 文件**通过 allowlist、原 ID 标识的 UTF-8/UTF-16 字节扫描。原设备读取、哈希、HTTPS 请求、缓存、重试、状态、IPC、preload、设置、翻译及 CSS 被删除，未采用运行时隐藏。原 ID 专用模块不在包内，未打包 Android、后端、源码或 node_modules。

主入口仅保留剪贴板 IPC；新增窗口模块只接受已验证游戏主 frame 的状态/全屏/退出请求。动态检查没有原 ID bridge、ID UI、`player-id.json`、原服务网络请求或远程游戏资源请求。原生库为 x64，DLL 依赖与随包运行库检查通过。官方 Chromium 二进制本身含通用 `last_backup_android_id` 字符串；该字符串同时存在于未修改的 Electron 发行版，不是原游戏 ID 实现。`ANDROID_ID` 在游戏源码和解包 ASAR 中仍严格禁止。

顶部“野格”是原生窗口标题栏。Steam 使用 `frame:false` 与首次 `fullscreen:true`；保留游戏自身音量/规则/设置按钮及品牌图，不用 CSS 隐藏整个顶部。设置提供显示模式与退出，F11/Alt+Enter 切换逻辑有回归测试。显示偏好独立存入 `steam-display.json`，窗口位置限制到当前可见显示器；修复切换后立即退出时保存旧全屏状态的问题，5 项窗口单元测试通过。

实际窗口和内容边界均为 1280×800 逻辑像素，屏幕缩放 2 倍。1280×720、1366×768、1920×1080、2560×1440、3440×1440、3840×2160 六种模拟桌面视口的菜单、设置和退出可点击。正式 EXE 的设置切换、窗口模式重启、全屏模式重启、退出按钮和退出码 0 均通过。F11/Alt+Enter 另对早期候选做过真实键盘检查；最终 Steam 客户端仍需复验。Windows 的 `isKiosk()` 实现与 `isFullscreen()` 共用状态，因此不把该 getter 当成 kiosk 判据；使用配置检查与真实可切换/可退出行为验证。[Electron 实现](https://github.com/electron/electron/blob/main/shell/browser/native_window_views.cc)

后续工具排查确认：结束残留截图辅助进程后，用户确认整屏黄框消失。它与截图捕获有关，不是游戏资产或边框；这项工具清理没有改变发行包。

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

## 官方 Preview 与 Upload 历史

官方 Preview 于 23:15:16 成功：72 个文件的路径、大小、SHA-1 全部匹配；74 个条目包含 2 个目录。相对旧 manifest `1526212740176029482`，仅 `resources/app.asar` 和 `Wildgrid.exe` 变更，0 新增/删除，约 4.55 MB 变更块，总大小增加 5,089 字节。

用户明确授权后，官方日志于 23:18:28 确认上传 **Build 26683708**、Depot Manifest **8156473827417933700**，上传 7 个新块；官方页面也交叉确认此构建。Upload 本身没有指派分支。此前稳定 Build **26683036** 的上传、安装 ASAR 和本地包已核对一致。

后续 internal-test/default 状态和客户端验收进度只更新[发布状态](../scripts/steam/RELEASE_STATUS.md)，不改写本次构建来源或冒烟证据。部分已确认重复的搬迁测试目录随后清理，日志保留，替代位置见[清理记录](documentation-cleanup.md)。
