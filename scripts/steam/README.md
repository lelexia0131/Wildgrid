# Steam 标准开发、测试与发布流程

返回[项目 README](../../README.md) / [开发指南](../../docs/DEVELOPMENT.md)。**当前 Build、Manifest、分支、验收与回滚版本只维护在 [RELEASE_STATUS.md](RELEASE_STATUS.md)**；本页维护稳定流程，不复制动态状态。

## 环境与入口

工作目录为根 Git 仓库 `D:\Wildgrid`。Node.js 22+，依赖来自 `npm ci` 和 package-lock；需要已安装的 Electron 运行时、JDK 21、Android SDK 36，以及现有 `steam/sdk/tools/ContentBuilder/builder/steamcmd.exe`。App/Depot 固定配置见 [steam-config.json](steam-config.json)，不改既有 SDK、账号认证缓存或 Depot 映射。

| 命令（从根目录执行） | 实际作用 |
| --- | --- |
| `npm run steam:build` | 普通 Windows NSIS、Android debug APK、Steam x64、自动测试和发行校验 |
| `npm run steam:preflight` | 重验已通过构建的成品和 ready 绑定；不启动 SteamCMD |
| `npm run steam:preview` | 预检后执行官方 SteamPipe Preview；不上传 |
| `npm run steam:upload -- -UploadAuthorized` | 相同成品 Preview 通过并获本人本次授权后执行 Upload |

这些命令调用本目录 PowerShell 入口。`steam/build-steam.ps1`、`steam/upload-steam.ps1`、`steam/verify-steam.ps1` 只是旧本机命令兼容入口，分别转发正式构建、发布和静态预检；日常使用上表 npm 命令。不调用已归档的旧 `steam/` 顶层辅助实现。

## 1. 日常开发与候选构建

只修改根目录正式源码。三平台共享引擎、关卡、生成器、模式、存档与语言，保留普通 Windows 的窗口和 ID、Android 的触摸/安全区/原生功能。完成必要测试后生成 Steam 候选：

```powershell
npm run steam:build
```

流水线自动生成 `steam/runs/<UTC时间-进程号>/`：

1. 按 Git 跟踪和非忽略文件清单生成干净源码副本，记录 commit、dirty、实际文件摘要、构建时间及工具版本；依赖版本须匹配 lockfile。
2. 验证普通版 TypeScript/Vite、单元、关卡、窗口与 UI；构建 NSIS 和 Android APK，比对 APK/普通 ASAR 资源并确认原 ID 保留。
3. 使用 TypeScript AST/PostCSS AST 物理删除 ID 模块、设备读取/哈希/网络请求、持久化/重试/状态、IPC、preload/bridge、设置、翻译及 CSS；结构匹配数量变化即失败。Steam 不包含原 ID 专用依赖。
4. 注入 `runtime/` 中的 Steam 窗口适配和设置；其他共享源码逐文件核对，执行 Steam 编译、单元和 UI 回归。
5. 构建 x64 目录包，验证 PE/DLL、完整依赖、发行 allowlist、ASAR 与 ID 字节；运行实际 EXE 的启动/退出/重启、模式/存档/中英文/模拟断网及布局测试。
6. 全部通过后，以排他锁、同盘目录 rename 和失败回滚更新 `steam/content/`，保留原 content 到本 run 的 `previous-content/`。

Windows 下不是双目录原子交换；切换有极短间隙，正式构建/上传共用锁，避免使用半成品。`current-attempt.json` 非 passed 或与 ready 不一致时必须拒绝旧包；失败不能被“目录里还有 EXE”当作成功。

存在未提交内容时，来源为 commit **加工作区实际快照**，不能声称只对应该 commit。Preflight 只验证既有成品，不证明它已同步后续源码修改；源码变更后应重新构建候选。

## 2. Steam 专属行为与成品证据

Steam 使用 `frame:false`，首次默认全屏，不使用 kiosk；F11/Alt+Enter、设置中的显示模式与退出保留。`steam-display.json` 独立保存模式和窗口位置，恢复到可见显示器范围。只去除原生标题栏，保留游戏内部导航和品牌图。普通 Windows/Android 不加载这套生成适配。

最终 ASAR 只允许 Web 运行文件、原生入口、图标和必要包元数据，排除源码、source map、SDK、Android、后端、测试、凭据和 node_modules。原 ID 从源码与成品两层检查，动态检查 bridge、UI、缓存及网络；Steam App/Depot/Build ID 不在禁止范围。

| 记录/产物 | 位置与含义 |
| --- | --- |
| 最新构建尝试 | `steam/logs/current-attempt.json`，包括失败 |
| 成功门禁 | `steam/logs/ready-to-upload.json`，绑定 source、ASAR、成品清单摘要 |
| 独立证据 | 当前 run 的 `logs/`：source-record、build-record、source-pruning、shared-source-parity、platform-parity、content-verification、packaged-smoke、截图与阶段日志 |
| 普通 Windows | 当前 run 的 `work/standard-release/` |
| Android | 当前 run 的 `work/wildgrid-android-debug.apk`；debug 签名 |
| Steam 上传内容 | `steam/content/`，入口 `Wildgrid.exe` |
| 历史 content | 对应 run 的 `previous-content/`；不自动等于线上稳定版，须在发布状态中明确关联 |

当前/上一稳定版的源码记录、哈希、日志和产物不能随意清理。旧工作复制品须逐文件核对替代项后再删。详细格式以实际脚本和 JSON 为准。

## 3. 官方 SteamPipe Preview

```powershell
npm run steam:preview
```

保留现有 ContentRoot `../content`、递归映射和 App/Depot；Preview 为 1，Upload 为 0，两份 VDF 都无 SetLive。认证在官方 SteamCMD 交互终端由本人完成；不传密码参数，不录制认证终端，不把 Guard 或令牌写入脚本/文档。

必须核对本次官方完成日志、Depot 路径/文件数/大小和 SHA-1 与本地成品一致，并检查当前 run 的 `logs/preview-result.json`。目录项不能被当成普通文件；静态 VDF 校验、旧日志或单独退出码都不等于 Preview 成功。[官方上传说明](https://partner.steamgames.com/doc/sdk/uploading?l=english)

## 4. 正式 Upload

先报告本次变更、实际测试、未验证项、来源和成品摘要，取得本人对**本次成品**的明确授权，再运行：

```powershell
npm run steam:upload -- -UploadAuthorized
```

脚本重做 preflight，要求同一清单摘要的 Preview 成功，解析本次官方完成日志并写 `logs/upload-result.json`。记录 Build ID、Depot Manifest ID、上传结果和授权范围到发布状态；Manifest ID 从官方 Depot 日志/输出核实。保存本次官方日志副本，避免下次 output 覆盖历史。

Upload 不自动指派分支、不公开发行，也不代表普通玩家立即收到更新。ready 文件中的发布布尔字段只是打包时快照；后续事实看 Preview/Upload 结果、官方日志和发布状态。

## 5. internal-test 与客户端验收

在 Steamworks 的 Builds 页面把新 Build 指派到 `internal-test`：选择正确的 Build 行和分支，预览更改，确认目标仅为该测试分支后生效。私密分支密码由本人在官方界面设置和输入，不写入 Git。

Steam 客户端打开 Wildgrid 属性 → 游戏版本和测试版（旧界面“测试版”），解锁并选择 `internal-test`，等待下载完成。记录客户端 Build/Manifest，并验证文件完整性及必要摘要。仅解锁或选中分支不能算验收通过。[官方分支说明](https://partner.steamgames.com/doc/store/application/branches?l=english)

每项记录设备/环境、步骤、结果和证据；失败或未执行必须明确标出：

- 从 Steam 正常启动、退出和再次启动，确认下载的是目标 Build。
- 首次默认全屏、没有系统标题栏；常见分辨率下布局、点击与必要导航正常。
- F11/Alt+Enter、设置中的显示模式、重启恢复、正常退出及系统焦点切换。
- 固定关卡与天空层、荒野求生生成/继续、沙盒编辑/导入/导出/本地地图。
- 旧版本存档兼容和重启恢复；用隔离/备份档案，不清除真实玩家数据。
- 中文与 English、语言设置持久化和资源显示。
- Steam 客户端离线模式下启动和游玩；本地 CDP 模拟断网不能替代它。
- Steam Overlay（如适用）；不适用须说明原因，不能记为已通过。
- 无原设备 ID UI、bridge、缓存创建或请求；下载包 ASAR 与已验证成品一致。

任何必要项目未通过或未完成，都不能更新 default。Android APK/触摸模拟也不能冒充 Android 真机验证。

## 6. default 更新与回滚

internal-test 验收完成后，展示结果和目标 Build ID，另获本人明确批准，再把**同一个已验证 Build ID**设为 default。没有内容变化时不需重建/上传；若修复了问题，应创建新候选并重新走完整流程。

正式发售后，default 是普通玩家默认接收更新的分支；测试版用户仍使用自己选择的分支。[官方 default 说明](https://partner.steamgames.com/doc/store/application/branches?l=english)

切换前在发布状态记录上一稳定 Build/Manifest、证据目录、批准人与时间。出现回归时，经明确授权在 Builds 页面重新将该已保存的稳定 Build 指派到 default，核对 Depot 与变更预览，再确认并让客户端下载验证；不是重新上传旧安装包。不要在客户端首次确认前删除稳定版日志、来源、rollback 副本或相关存档备份。

## 7. 首次公开发行：独立操作

下列步骤分别记录、分别取得需要的授权，不能互相替代：

| 操作 | 作用 |
| --- | --- |
| Steamworks 配置发布 | 使启动项、Depot、语言/平台等后台配置变更生效 |
| 构建分支激活 | 指定某分支的 Build，决定该分支客户端下载内容 |
| 商店/构建提交审核 | 将相应检查清单提交 Valve，等待反馈与批准 |
| Coming Soon / 正式公开发行 | 前者公开预告页面；后者在批准后执行 Release App，开放正式发行 |

发售前逐项核对 Steamworks 当前实际检查清单，不把这份文档视为本应用已经满足要求：

1. 完成合作伙伴入驻、协议、身份/税务/收款及应用费用要求，由本人处理。核实启动配置、支持系统、Depot/许可包包含关系、价格与内容调查等后台必填项。
2. 完成商店素材、可读的标题/Logo、真实游戏截图、准确描述/语言/功能声明与对应内容/分级资料；所声明功能应在待发售构建中实现，所有素材有使用权。商店与构建都需 Valve 审核批准；通常各 3–5 个工作日，至少预留 7 个工作日处理反馈。[官方审核要求](https://partner.steamgames.com/doc/store/review_process?l=english)
3. 先提交商店展示审核，再提交构建审核。官方流程要求近最终构建在 default；仍须先完成本项目内测并获得本人 default 批准，不能以“为了审核”跳过授权。[官方发行流程](https://partner.steamgames.com/doc/store/releasing?l=english)
4. 核对等待期：2026-11-15 查询的官方入驻页面写明首批作品在支付应用费后需等待 **21 天**；公开 Coming Soon 页面至少 **2 周**。发售前重新查官方页面及本应用后台最早可发行日期，不能沿用旧资料或仅按预定日期推算。[入驻要求](https://partner.steamgames.com/doc/gettingstarted/onboarding?l=english)、[Coming Soon](https://partner.steamgames.com/doc/store/coming_soon?l=english)
5. 所有清单、审核、时间与发布权限满足后，由本人明确批准正式公开发行，再执行后台 Release App。上传、内测/default 激活、审核通过和到了计划日期，都不是本项目自动执行公开发行的授权。[官方发行入口](https://partner.steamgames.com/doc/store/releasing?l=english)

官方要求最后核对于 2026-11-15；每次首次发售准备应重新核对上面链接。此文档整理本身不执行任何线上操作。
