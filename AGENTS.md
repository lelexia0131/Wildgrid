# Wildgrid 开发约定

先读 [README](README.md)、[开发指南](docs/DEVELOPMENT.md)；涉及 Steam 时另读[唯一发布流程](scripts/steam/README.md)与[当前发布状态](scripts/steam/RELEASE_STATUS.md)。`reports/` 是历史证据，不是当前操作指令。

## 实施与验证

- 实施前说明假设、影响范围和可验证目标。存在关键歧义时先澄清；优先最小方案，不进行无关重构。
- 每条改动应对应当前请求。保留已有风格、功能、存档兼容性和测试基线，不通过放宽断言掩盖回归。
- 根据变更范围执行必要测试，报告实际执行、失败及未验证项。构建、模拟触摸、APK 检查不能冒充真机或 Steam 客户端验收。

## 三平台边界

- `D:\Wildgrid` 根 Git 仓库是唯一可信源码；日常修改正式 `src/`、原生适配与受版本管理的脚本。
- Windows、Android、Steam 共用核心游戏逻辑、关卡、生成器、沙盒、荒野求生、存档和语言。保留 Android 触摸/安全区和普通 Windows 窗口行为。
- 不直接编辑 `steam/work/`、`steam/runs/` 内的构建副本，不建立长期 Steam 源码分支。
- 普通 Windows/Android 的原设备 ID 功能必须保留。Steam 必须用构建裁剪物理删除设备读取、生成、持久化、请求、重试、缓存、IPC、preload/bridge、UI 和专用依赖，不能只靠隐藏或运行时开关。
- Steam 默认无边框全屏，去除原生标题栏；保留游戏必要导航、显示模式切换/保存和正常退出。Steam 适配只在生成阶段注入，不外溢到其他平台。
- `steam/` 仅为忽略的 SDK/SteamCMD、工作副本、成品、缓存和证据目录；正式无凭据脚本在 `scripts/steam/`。不提交 SDK、大型产物、密码、Guard、登录令牌或敏感缓存。

## 发布门禁

- 固定顺序：根源码修改 → 自动测试 → Steam 专用构建与成品安全检查 → 官方 Preview → 用户授权 Upload → `internal-test` → Steam 客户端验收 → 用户批准 `default`。
- 构建绑定 commit、dirty 状态、实际源码摘要、时间、版本和成品哈希。失败时不得把旧 content/ready 当成本次成功；保持现有失败门禁和目录切换保护。
- 每次 Upload 必须有相同成品摘要的 Preview，并取得用户对该次上传的明确授权；旧授权不能自动用于另一份构建。认证由用户在官方界面完成。
- 内测全部必要项通过后，另经用户明确批准，把同一个已验证 Build ID 指派到 default；不为切换分支重新构建/上传。保留上一稳定 Build 与回滚证据。
- 不擅自变更 default、提交 Valve 审核或公开发行。动态 Build/Manifest/分支/验收状态只更新 `scripts/steam/RELEASE_STATUS.md`；README 只链接它。

## 文件与 Git

- 先检查 Git 工作区和暂存区，不覆盖、取消暂存或清除用户已有改动。没有明确授权，不 commit、不 push。
- 清理前列出精确候选、用途、替代项和引用，先保存必要历史，再删除确认冗余的文件。禁止无范围限制的 `git clean -fdx`、reset/checkout 丢改动或递归删除。
- 保留 `.git`、正式源码/资源/测试/配置、SDK/SteamCMD、当前与稳定回滚产物及必要日志/来源记录；不确定用途时保留并列入待确认清单。
- 修改文档后核对真实命令、路径和交叉引用；不要把历史报告中的旧测试结果当成当前通过结果。
