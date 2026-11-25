# 本地开发与三平台构建

主入口：[项目说明](../README.md)。实现职责见[架构](../ARCHITECTURE.md)，玩法见[游戏手册](GAMEPLAY.md)，测试分类见[测试说明](../tests/README.md)。

## 唯一源码和平台适配

根 Git 工作区是三平台的唯一来源。React/TypeScript、Engine、模式、Worker、关卡/答案、存档和语言均来自 `src/`；Electron 与 Capacitor 是不同原生容器，不是独立游戏副本。

共同功能只在正式源码中修改。Steam 的 AST 裁剪与窗口注入维护在 `scripts/steam/`，临时源码可重新生成，不能成为开发入口。平台差异必须留在配置或明确适配层中，不复制整套业务长期维护。

| 项目 | 普通 Windows | Android | Steam Windows |
| --- | --- | --- | --- |
| 入口 | `electron/main.cjs` | `android/` + Capacitor | 根 Electron 入口经 Steam 构建变换 |
| 原设备 ID | 保留 | 保留 | 构建时物理移除并扫描最终 ASAR |
| 窗口/输入 | 原生标题栏、原窗口模式、鼠标/键盘 | 触摸、安全区、横竖屏与原生插件 | 默认无边框全屏，F11/Alt+Enter、显示模式保存及退出 |
| 游戏/存档/语言 | 共享 `src/` | 共享 `src/` | 同一源码，仅预期平台变换 |

原 Windows ID 使用本机原生层，Android 保留 `PlayerIdPlugin`；界面适配在 `src/platform/playerId.ts`。缓存与游戏存档分开，服务失败不得阻止游戏。后端契约与历史部署见 [server/README](../server/README.md)。Steam 不调用该服务；App/Depot/Build ID 不属于被移除的原游戏设备 ID。

保持现有 v1 存档键、WG1 和可选天空层兼容。确需格式调整时增加明确兼容/迁移与测试，不改变平台 origin 或包身份来规避兼容问题。

## 日常开发

所有命令从根目录执行。Node.js 22+；使用 lockfile 安装依赖。

```powershell
npm ci
npm run dev
```

Vite 输出本地和局域网访问地址。浏览器预览不申请原生设备身份；原生能力需要相应平台回归。修改后按范围运行：

```powershell
npm test
npm run build
npm run levels:check
npm run test:ui
```

`npm test` 串行运行 TS 测试；后两项分别用于关卡/求解变化与交互变化。`test:ui` 使用已构建的 `dist/`，不是 Android 真机测试。纯文档整理一般只需路径/命令/引用校验，不必重建三个发行包。

关卡数据在 `src/game-data/`，创作脚本为 `scripts/author-levels.mjs`。天空章可先运行 `node scripts/author-levels.mjs --sky --dry-run`；去掉 dry-run 会改数据，执行前确认范围。固定关卡/答案不得为通过测试而批量刷新。

## 普通 Windows

```powershell
npm run desktop
npm run package:win
npm run test:desktop
```

`desktop` 构建并启动 Electron；`package:win` 输出 `release/` 下的 NSIS 安装包和 `win-unpacked/`，版本来自 package.json。`test:desktop` 读取该目录内 ASAR，须先完成打包；仅运行 Web build 不会更新此 ASAR。安装器保留目录选择、快捷方式和原窗口行为，当前未配置发行代码签名证书。

Electron 加载本地 `wildgrid://game` 资源，不需要 Web 服务。用户数据位置与安装目录分离，不清理真实玩家档案进行回归。

## Android

需要 JDK 21、Android SDK 36；设置 `JAVA_HOME` 与 `ANDROID_HOME` / `ANDROID_SDK_ROOT`。现有 Windows 脚本也会寻找 Android Studio 附带 JDK。版本与包配置以 `android/app/build.gradle`、`capacitor.config.ts` 为准。

```powershell
npm run android:sync
npm run android:open
npm run android:apk
```

`android:sync` 自动构建 Web、生成图标并执行 Capacitor sync。`android:apk` 包含 sync，随后用 Gradle wrapper 构建 debug APK，复制到 `release/`；原始输出为 `android/app/build/outputs/apk/debug/app-debug.apk`。沿用已有 debug 签名，不等于商店正式签名包。

有真实设备时可在确认目标设备后运行 `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`，并验证触摸、横竖屏、安全区、原生剪贴板/ID、存档和后台音频。没有设备时如实记录未验证。不要清除用户应用数据、变更包名或签名。

Android 使用本地资源，不注册 Web Service Worker；浏览器 PWA 则在生产 HTTPS/localhost 缓存成功后离线运行。两者不是同一个运行环境。

## Steam 与其他部署

Steam 完整流程只维护在 [scripts/steam/README.md](../scripts/steam/README.md)。`npm run steam:build` 已包含单元、关卡、平台 UI 回归、普通 NSIS、Android APK、Steam 构建和成品校验，输出路径及来源记录见该指南。

`npm run deploy:downloads` 是独立的 VPS 下载站发布动作，不属于 Steam 更新流程，只有用户明确要求更新下载站时执行。它重新构建普通 Windows/Android，经既有 SSH 配置上传到 `/var/www/Wildgrid/`，校验摘要后替换下载文件，并检查 Nginx 与原站点。可用 `WILDGRID_SSH_HOST` 选择已配置的 SSH 别名；不把密钥或凭据写入仓库。相关脚本、服务配置及安装恢复备份不能因 Steam 工作流建立而随意删除。

## 维护规则

- 美术、音频和字体修改遵循 [资源说明](../src/assets/README.md)，保留许可与来源记录。
- 当前分支与验收状态只写[发布状态](../scripts/steam/RELEASE_STATUS.md)，原始日志存放于忽略的 Steam 工作目录。
- `reports/` 保留过去的失败、有限样本和来源哈希；其日期/环境必须随结果一起理解，不能代替当前测试。
- 清理前查引用、摘要、Git 状态及回滚需求；不要动 SDK、SteamCMD、存档恢复备份或未知来源文件。既有暂存内容未经授权不得替换。
