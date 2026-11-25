# Steam 与三平台构建

根目录是唯一源码。普通 Windows 的 Electron、Android 的 Capacitor 和 Steam 使用同一套 `src/`。不要编辑 `steam/work` 或 `steam/runs` 内的源码；这些目录仅为构建快照。

前提：根目录 `npm ci`，Node 22+，已安装 Electron 运行时，JDK 21、Android SDK 36，以及既有 `steam/sdk/tools/ContentBuilder/builder/steamcmd.exe`。沿用现有 App 5595750、Depot 5595751、VDF 相对映射与 SDK，不迁移或删除 SDK。

```powershell
npm run steam:build      # Windows NSIS + Android debug APK + Steam x64；全部自动回归
npm run steam:preflight  # 对当前成功产物重新检查，不能复用失败构建之前的 ready
npm run steam:preview    # 官方 SteamPipe Preview；认证由开发者在 SteamCMD 输入
# Preview 通过、报告结果且开发者明确批准 Upload 后：
npm run steam:upload -- -UploadAuthorized
```

单独构建普通平台仍用 `npm run package:win`、`npm run android:apk`。Android 沿用原 debug 签名，不是商店正式签名包；构建与模拟触摸测试不等于 Android 真机测试。

每次 Steam 构建创建 `steam/runs/<UTC时间-进程号>/`。`logs/source-record.json` 记录 HEAD、dirty 状态、完整实际文件清单和 SHA-256、工具版本；工作区未提交时明确记录，不声称只对应 commit。按 Git 跟踪与非忽略文件清单生成干净源码，依赖版本须匹配 lockfile。生成器、60关、模式、存档和语言共用；仅 ID 对应节点和 Steam 窗口适配经过构建变换，其他 `src/` 文件逐字节比对。

裁剪沿用 TypeScript AST / PostCSS AST，节点数量变动立即失败。删除 ID 模块、原生设备读取/哈希/请求/缓存/重试、IPC、preload、设置及翻译/CSS；并对源码、最终目录、ASAR 解包逐一扫描。发行包仅包括 Electron、压缩后的 Web 运行文件、3个原生入口及图标，不携带 SDK、凭据、源码、测试或依赖目录。

Steam 原生窗口使用 `frame:false`、默认 `fullscreen:true`，不使用 kiosk。F11、Alt+Enter 和设置中显示模式可切换；设置提供退出，Alt+F4 仍为系统退出。显示选择和窗口位置存在独立 `steam-display.json`，恢复时限制到当前显示器可见区域；窗口模式可拖动现有顶部按钮外的空白。游戏顶部必要按钮和主菜单品牌图保留。窗口适配只复制到 Steam 构建，不修改普通 Electron 或 Android；游戏存档键、协议 origin、appId 与格式不变。Steam Overlay 和多显示器硬件效果须实际客户端验收。

先在独立候选目录完成单元、UI、APK 资源比对、PE/DLL/ASAR、实际 EXE 三次启动与离线/恢复检查。通过后持有排他锁，用同盘目录 rename 切换 `content`；旧目录保留到本次 `previous-content`，失败回滚。目录切换有极短间隙，并非文件系统提供的双目录交换；上传与构建共用锁，因此不会读取半成品。`current-attempt.json` 非 passed 时上传门禁拒绝旧 ready；不会删除旧可玩包或切换任何线上 Build。

记录与产物：

- `steam/logs/current-attempt.json`：最近构建状态，包括失败。
- `steam/logs/ready-to-upload.json`：完整成功门禁，绑定 source、ASAR 与发行清单 SHA-256。
- `steam/runs/<id>/work/standard-release/`：普通 NSIS 和目录包。
- `steam/runs/<id>/work/wildgrid-android-debug.apk`：本次 Android 副本。
- `steam/content/`：最新完整通过的 Steam 目录。
- 每次 `logs/`：源码与成品清单、共享源码比对、APK 比对、测试日志、实际 EXE 冒烟及截图。

Preview 成功须解析本次官方完成日志，并逐个比较 Preview manifest 的路径、大小、SHA-1 与本地发行文件；不能只用退出码或旧日志。Upload 必须有同一发行摘要的 Preview，另需用户明确授权。记录新的 Build ID 后再由开发者批准/操作内部测试分支。脚本不含 `SetLive`，不更改 default、不提交审核、不公开发行。SteamCMD 保持官方交互认证；不要传密码、录制认证终端或提交认证缓存。

参考：[Electron BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window)、[SteamPipe 官方上传说明](https://partner.steamgames.com/doc/sdk/uploading?l=english)。
