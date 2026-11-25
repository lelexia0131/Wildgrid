# Steam 发布状态

更新：2026-11-15（Asia/Shanghai）。这是当前发布状态的唯一维护入口；[发布流程](README.md)不复制动态 Build 状态。每次更新注明来源、时间、Build/Manifest、证据和未完成项目。

## 当前状态

| 项目 | 当前值 | 依据 |
| --- | --- | --- |
| App ID / Depot ID | **5595750 / 5595751** | 正式配置及官方上传日志 |
| 已验证旧稳定 Build | **26683036** | 此前官方日志、Steam 安装核对与用户游玩确认 |
| internal-test Build | **26683708** | 用户本次明确确认已部署；本机客户端记录一致 |
| internal-test Depot Manifest | **8156473827417933700** | 官方 Upload 日志与本机 appmanifest 一致 |
| default Build | **26683036** | 用户本次明确确认；本轮未操作后台分支 |
| Steam 客户端 | 已解锁并选择 `internal-test`；本机安装记录显示对应 Build/Manifest | 用户确认，且只读核对 `appmanifest_5595750.acf` 的 Build/Manifest/BetaKey |
| 新版完整功能验收 | **未完成记录，尚不能批准 default 更新** | 选中分支/匹配安装记录不等于全项功能验收 |
| default 批准 / 审核 / 公开发行 | 本轮无授权、无操作；不声称已满足首次发售条件 | 本次任务范围 |

本轮未重新执行 Steam 客户端功能测试，也未重新进入 Steamworks 验证部署操作；分支已部署以用户明确提供的状态为准。客户端记录仅证明安装元数据匹配，不能替代文件完整性和实际游玩验证。

## 已上传构建的来源与证据

- 本地构建记录：`20261115T150801Z-48868`，2026-11-15 23:08 开始，23:14 ready，23:15 Preview 成功，23:18:28 经用户明确授权的 Upload 成功。
- Git 父提交：`936e74b80223686dc2c9fe7968d54531b0039002`，**dirty=true**；是父提交加当时工作区快照，不是纯 commit 构建。
- 源码清单 SHA-256：`6ae7ea2b1f145fdc9249c368a30a50e993a7e4ae625f4f23cc462b669de5c076`。
- 成品清单 SHA-256：`578103169f0d6c47d2cba2a56074e14a68a68bd1acc64ea3cfe7b3784fab8ccc`。
- ASAR SHA-256：`deb6bbcc4550d38f513202a274b9048fa283d62fa5249b97fa96e0d2ae62a087`。
- Steam：72 个文件，404,274,982 字节（385.55 MiB），ASAR 203 个运行文件。Preview 另含 2 个目录条目，72 个文件的路径/大小/SHA-1 全部匹配。
- 原始证据：`steam/runs/20261115T150801Z-48868/logs/` 的 source/build/content/packaged-smoke 记录、preview/upload-result 及 `official-preview/`、`official-upload/`。旧日志中的分支字段保留为当时快照，不覆盖为后来状态。
- 固定构建验收摘要：[历史构建记录](../../reports/steam-platform-sync.md)。后续文档整理没有重新构建或改变此包。

已完成的本地构建验收：27 个流水线阶段；普通版与 Steam 各 184 项单元、5 项窗口单元、关卡唯一解、平台 UI、六种桌面布局、实际 EXE 三次启动/退出/存档恢复/语言/模拟离线、源码和最终 ASAR 的 ID 扫描，以及 Android APK 资源/签名检查。302 个共享源码文件逐字节匹配根源码。

## internal-test 剩余验收

下表是 **Steam 客户端实际下载安装后的验收**；本地 EXE 测试不自动填为通过。任一必要项失败或未完成，保持 default 不变。每项补充测试人、设备、日期和证据。

| 检查 | 结果 |
| --- | --- |
| 客户端解锁并选择 internal-test，安装元数据匹配 | 已确认；不代表以下功能已验收 |
| Steam 验证游戏完整性、下载文件摘要匹配 | 待记录 |
| 从 Steam 启动、退出、再次启动 | 待记录 |
| 首次全屏、原生标题栏移除、分辨率布局 | 待记录 |
| F11/Alt+Enter、显示模式保存与恢复、系统焦点切换 | 待记录 |
| 关卡与天空层、荒野求生、沙盒/本地地图 | 待记录 |
| 旧版存档兼容、重启恢复 | 待记录 |
| 中文/English 与语言持久化 | 待记录 |
| Steam 客户端离线模式 | 待记录 |
| Steam Overlay（如适用，否则说明原因） | 待记录 |
| 下载包 ID 静态/动态复核 | 待记录 |

Android 真机、干净 Windows VM 安装/升级及多显示器硬件测试仍无通过记录。未把构建或触摸模拟记为真机验收。

## 稳定版与回滚保留

上一稳定 Build **26683036**，Depot Manifest **1526212740176029482**；旧 ASAR SHA-256 为 `55cf49603a62e1efdec5a156c4e923ee83dc64d93b5e591f29502546a371a3ea`。

保留目录：`steam/runs/20261115T150801Z-48868/previous-content/`；原官方日志和对比证据在 `steam/logs/architecture-baseline/`，早期来源与诊断在 `steam/work/source/`、`steam/logs/`。这些资料不能按普通缓存删除。回滚操作按[标准流程](README.md)重新指派已保存的稳定 Build，仍需本人明确授权。

下一步是完成并记录上述内测验收，再请求本人是否批准将 **同一个已验收的 26683708** 指派到 default；若有代码修复，则另建候选重走流程。不得仅凭本状态文件执行上传、分支切换、审核或公开发行。
