# 文档与冗余文件整理记录（2026-11-15）

本轮范围为文档整理与已确认重复工作文件清理，不重新构建，不执行 Preview/Upload、分支变更、Valve 审核或公开发行。原有 28 项暂存修改保留；本轮改动只留在工作区。

## 删除前候选与依据

候选已先盘点并生成逐文件清单，证据保存在 `steam/logs/document-cleanup-20261115/cleanup-plan.json`。下列路径均以仓库根目录为基准。

| 候选 | 清理理由与保留依据 | 引用处理 |
| --- | --- | --- |
| `steam/` 顶层的 `common.ps1`、`electron-builder.cjs`、`migrate-sdk.ps1`、`package-game.mjs`、`prepare-source.mjs`、`record-ready.mjs`、`smoke-packaged.mjs`、`steam-config.json`、`verify-content.mjs`、`write-vdf.mjs` | 10 个旧实现已被正式脚本替代；原文先存为一份 ZIP 归档 | 当前 npm/PowerShell 入口只调用 `scripts/steam/`；保留的 3 个兼容入口也已转发正式脚本 |
| `steam/work/package/`、`steam/work/中文 空格/` | 运行文件逐一匹配保留的稳定版 `previous-content/` | 仅历史记录引用，当前流水线不读取 |
| `steam/runs/20261115T150801Z-48868/work/中文 空格/` | 72 个文件逐一匹配当前 `steam/content/` | 成功冒烟日志保留；清理的是搬迁测试复制品 |
| `steam/runs/20261115T145328Z-25812/work/中文 空格/14008/` | 72 个文件逐一匹配同 run 保留的候选包 | 诊断包、源码和日志仍保留 |
| `steam/work/asar-audit/` | 所有解包字节匹配保留的旧版 ASAR，可重新提取 | 当前 preflight 使用当前 run 下的 audit 目录 |
| `steam/runner 中文 空格/` | 空的一次性路径测试目录 | 无正式调用 |
| 根 `GENERATOR_REWORK.md` | 当前指引与历史数据混杂；原文迁入 `generator-rework-history.md` 后移除根入口 | 两份报告中的旧引用改为归档位置 |

## 保留与待确认

- `.git`、源码、资源、许可证、测试、配置、node_modules、SDK/SteamCMD 和认证缓存全部保留。
- 当前 content、稳定回滚 previous-content、当前成功 run 的源码/普通安装包/APK、全部构建/Preview/Upload/失败日志保留。
- 旧 source 快照及失败候选包有版本追溯用途，本轮不清理；历史记录指向的已删除复制品由本清单说明去向。
- `release/install-recovery-*`、旧普通安装包/APK、`.desktop-smoke/` 中生成器原始样本与实验、`.builder-cache/` 和 `steam/cache/` 仍有恢复/复现/工具复用可能，未确认保留周期，列入待确认项。
- 测试和脚本没有因“未注册到 npm”而被删除。`steam/` 下 3 个旧命令兼容入口保留，避免破坏已有本机调用。

## 执行结果

已按以上精确清单完成：移除 502 个旧路径下的文件，合计 1,636,540,513 字节（约 1.52 GiB，包含迁出的旧文档）；旧脚本压缩归档为 17,209 字节，归档内每个文件均与原 SHA-256 匹配。生成器旧文档在移除前逐字确认历史正文已迁入新位置。完整删除路径、大小、理由和替代位置见本机证据目录的 `cleanup-result.json`、`removed-paths.json`，没有使用无范围限制的 clean/reset/删除。

文档现在分工为：根 README 入口；AGENTS 开发约定；docs/DEVELOPMENT 和 GAMEPLAY；ARCHITECTURE 实现细节；scripts/steam/README 唯一发布流程；scripts/steam/RELEASE_STATUS 唯一动态状态；tests/README 测试说明；reports/README 历史索引。旧 steam README/状态文件仅保留跳转，不再复制正文和状态。

本轮修改/新增的说明包含上述入口、Steam 构建历史摘要、生成器历史归档、5 份历史报告的失效测试/文档路径，以及资源 README 的许可/来源入口。音频说明纠正为已存在的本地 CC0 采样录音；架构 API 中旧的单轮 25000ms 描述按实际源码修正为 8000ms。游戏和构建脚本没有修改。

实际验证：

- Markdown 本地链接、npm 命令和显式脚本路径检查通过；覆盖正式文档及两个本机兼容跳转文件，详情见 `documentation-validation.json`。
- 17 个 JavaScript 构建/测试文件通过 `node --check`，6 个 PowerShell 正式/兼容入口通过语法解析。
- `npm run steam:preflight` 实际执行通过，未启动 SteamCMD；72 个发行文件、203 个 ASAR 文件、原 ID 扫描、依赖和绑定摘要仍通过。成品清单 SHA-256 保持 `578103169f0d6c47d2cba2a56074e14a68a68bd1acc64ea3cfe7b3784fab8ccc`。
- 483 个既有非 Markdown 源码/配置文件逐字节未变；稳定回滚 ASAR 摘要保持原值；SDK、SteamCMD、VDF 与当前/稳定产物保留。
- `/steam/` 忽略规则仍有效，Git 未跟踪 SDK、缓存或成品；`git diff --check` 通过。
- 原有 28 项暂存内容未覆盖、未取消暂存；整个 Git stage 清单 SHA-256 前后均为 `3402bcc2a94d38bb1cf00223ab19b8ca6fcae02aaf9aa5033496da81a59e915c`。本轮文档编辑、新文件和根旧文档删除均未暂存，未 commit/push。

未执行：三平台重新打包、完整游戏单元/UI/真机回归、官方 Preview、Upload、Steam 分支切换、审核或公开发行。仅整理文档与重复中间物，现有游戏/配置摘要未变，因此没有把历史的完整回归结果当成本轮新测试。

当前发布事实采用用户提供状态和本机安装元数据：internal-test 为新候选、default 保持旧稳定版；完整新版功能验收仍待记录。具体 ID 和待办只看[发布状态](../scripts/steam/RELEASE_STATUS.md)。

本机审计目录为 `steam/logs/document-cleanup-20261115/`，包含删除前清单、Git/源码基线、旧脚本 ZIP、删除结果和验证结果；这些是忽略的操作证据，不是第二套正式流程。
