# Wildgrid（野格）

原创露营主题逻辑益智游戏，使用 React、TypeScript 与 Vite。包含 60 个固定冒险关卡、云海双层地图、10 档荒野求生挑战，以及沙盒创造、地图导入/导出和本地收藏；支持中英文、教程、撤销/重做和离线资源。版本以 [package.json](package.json) 为准。

## 平台支持

| 平台 | 构建形式 | 平台行为 |
| --- | --- | --- |
| 普通 Windows | Electron Windows x64 / NSIS | 保留原窗口、系统标题栏、鼠标键盘和原设备 ID |
| Android | Capacitor / debug APK | 保留触摸、横竖屏、安全区、剪贴板和原设备 ID |
| Steam Windows | Electron Windows x64 完整目录 | 物理移除原设备 ID；默认无边框全屏，可切换显示模式并正常退出 |

浏览器预览和 PWA 也使用相同核心源码。测试覆盖、当前 Steam 分支和待验收项目只记录在[发布状态](scripts/steam/RELEASE_STATUS.md)；构建成功不等于真机或 Steam 客户端功能验收通过。

## 本地开发

需要 Node.js 22+。从仓库根目录执行：

```powershell
npm ci
npm run dev
```

常用检查和构建：

```powershell
npm test
npm run build
npm run package:win
npm run android:apk
```

普通 Windows 产物输出到 `release/`；Android 需要 JDK 21、Android SDK 36 和对应环境配置，当前输出为 debug 签名 APK。运行入口、UI/关卡检查和平台限制见[开发指南](docs/DEVELOPMENT.md)与[测试说明](tests/README.md)。

## 目录

```text
src/                 共享引擎、模式、关卡、存档、语言、UI、资源和平台适配
public/              本地静态资源、PWA 文件和许可证
electron/            普通 Windows 原生入口与 preload
android/             Android 原生工程与插件
server/              普通 Windows / Android 的原 ID 服务
build/               图标与普通 Windows 安装器资源
scripts/             正式维护、测试和构建脚本
scripts/steam/       Steam 裁剪、窗口适配、构建/上传说明及发布状态
tests/               测试、固定历史基线和视口夹具
docs/                开发与游戏操作说明
reports/             历史审计、测试数据和版本溯源
steam/               忽略的 SDK、SteamCMD、临时源码、发行包和日志
dist/、release/      忽略的本机构建产物
```

## 三平台统一源码规则

`D:\Wildgrid` 根 Git 仓库是唯一可信源码。共同玩法、关卡、生成器、存档和语言只在正式 `src/` 中维护；Windows、Android 和 Steam 从这里构建。平台差异留在配置或适配层，保留各平台原有操作方式。

不要直接修改 `steam/work/`、`steam/runs/` 的临时源码，也不要长期复制三份项目。Steam 构建在一次性副本中裁剪原设备 ID 的读取/生成、请求、缓存/重试、IPC、bridge 和设置入口，并注入专属窗口模块；不能只隐藏 UI，也不能改掉普通 Windows/Android 的 ID。

`steam/` 始终被 Git 忽略；无凭据、可复用脚本在 `scripts/steam/`。不提交 SDK、成品、密码、登录令牌或认证缓存。开发与清理规则见 [AGENTS.md](AGENTS.md)。

## Steam 更新流程

**修改根源码 → 自动测试 → Steam 专用构建与安全检查 → 官方 Preview → 授权 Upload → internal-test → Steam 客户端验收 → 批准 default**

```powershell
npm run steam:build
npm run steam:preview
# 同一成品 Preview 通过，且本人明确授权本次正式上传后：
npm run steam:upload -- -UploadAuthorized
```

`steam:build` 已包含三平台构建及自动化回归。单独复核已验证成品可用 `npm run steam:preflight`。Upload 只生成 Steam Build；内测通过并另获批准后，将同一个 Build ID 指派到 default，不必重建或重新上传。首次公开发行是独立流程。

详细步骤、验收清单、回滚和首次发售要求集中在 [Steam 标准流程](scripts/steam/README.md)，动态结果集中在[发布状态](scripts/steam/RELEASE_STATUS.md)。

## 详细文档

- [开发指南](docs/DEVELOPMENT.md)：平台入口、环境、构建、存档与部署边界。
- [游戏功能与操作](docs/GAMEPLAY.md)：操作、章节、求生、沙盒、存档和语言。
- [架构说明](ARCHITECTURE.md)：模块边界、状态所有权与 Engine API。
- [测试说明](tests/README.md)：按变更范围选择检查及保护历史基线。
- [资源说明](src/assets/README.md)、[音频与许可](src/assets/audio/README.md)、[字体与许可](src/assets/fonts/README.md)。
- [ID 服务说明](server/README.md)：普通 Windows/Android 原有服务。
- [历史报告索引](reports/README.md)：过去结果、失败、来源哈希及整理记录。
