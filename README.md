# 野格

原创露营主题逻辑益智游戏。React + TypeScript + Vite，无后端、无账户、无外部媒体请求。30 个固定关卡，1–15 关为 6×6，16–30 关为 8×8，支持电脑鼠标和手机点击。

## 运行

需要 Node.js 22 或更新的受支持版本。

```sh
npm install
npm run dev
```

打开终端显示的本地地址。手机与电脑连接同一网络时，可以打开终端显示的 Network 地址；系统防火墙需允许该端口。

```sh
npm test          # 关键规则及全部固定关卡解法验证
npm run build    # TypeScript 检查及生产构建，输出 dist/
npm run preview  # 本地预览生产版（默认 4173 端口）
npm run levels:check # Solver 验证 16–30 关唯一解
npm run test:ui  # 多格插画、实时提示开关和手机触摸回归
```

## 操作

- 选择右侧设施，再点草地放置。多格设施以所点格作为外接矩形的左上角；绿色预览显示实际占格。
- 点击已放设施可拿起。点新位置移动；点待放区的 × 结束选择，设施已回到库存。
- 多格营地、野餐桌和林间木屋使用完整的连体图案，内部不画格线。选中设施后点击营地工具中的“旋转”，或再次点击所选设施卡片旋转；插画按当前占格重绘，门窗、入口和桌腿保持正向。手机无需键盘或右键。
- 已放置的多格营地可右键顺时针旋转，以当前鼠标所在占用格为支点。遇到地形或其他设施时保留原位置并显示“已经被占用”；旋转支持撤销、重做。
- Ctrl/Cmd+Z 撤销；Ctrl/Cmd+Shift+Z 或 Ctrl/Cmd+Y 重做。Esc 取消选择。
- 行、列黄色短杠表示尚需占用的格数。完成显示勾；超出显示红色差额。
- 重叠、越界、覆盖地形会阻止放置。其他规则错误保留在棋盘，显示红框与原因，可以继续调整。
- 篝火缺少营地且仍能补放时显示待满足。营地不要求相邻篝火。瞭望塔之间禁止八方向相邻。
- 重开清空当前棋盘，可以撤销；已完成关卡和解锁进度保留。

## 文件结构

```text
src/game/types.ts       数据类型
src/game/rules.ts       纯规则计算、旋转、占格、三态判定
src/game/storage.ts     版本化本地存档与读取校验
src/game/audio.ts       原创 Web Audio 音乐及交互音效
src/data/levels.json    30 个固定关卡，无运行时随机生成
src/components/Art.tsx  原创 SVG 地形、设施与菜单插画
src/App.tsx             页面、操作历史、棋盘与设置
src/styles.css          桌面与手机布局
public/icon.svg         原创 App 图标
scripts/author-levels.mjs  手工关卡编辑源，生成固定 JSON 与测试解法
tests/solutions.json    仅用于开发验证，不包含在应用构建中
```

关卡 JSON 包含地形、设施清单、行列目标。编辑关卡时可修改 author-levels.mjs 中的固定布局及参考解，再执行 `node scripts/author-levels.mjs`、`npm test` 和 `npm run levels:check`。16–30 关由 Solver 验证唯一解，等价的设施编号和旋转不重复计数。

## 音频与存档

旋律、和声及音效均由项目代码原创合成，无商业采样或旧项目素材。菜单与关卡共享主题旋律，节奏不同。浏览器需要首次用户操作才能启用声音。后台标签页暂停音频。

存档位于当前站点 localStorage 的 `wildgrid-save-v1`，包括已完成/解锁进度、各关棋盘、当前关卡、音量及“设施提示”开关。该开关实时控制游玩界面的动态规则卡，关闭时完全移除并把空间还给设施列表；首页说明书不受影响，旧存档默认开启。不同域名和端口不共享存档。清除站点数据会删除存档；存储被禁用时会显示提示。

## 沙盒模式

首页「开始冒险」进入二级菜单：「继续冒险」恢复原来的冒险进度，「沙盒模式」可以创造或导入地图。

- 创造地图支持 6×6 和 8×8。选择水源、森林或山地后点击空格放置，再次点击同格移除；设施库来自现有全部设施定义，可以重复取用。
- 摆放设施会自动生成行列占格目标。点击设施拿起后可移动、旋转；切换地形画笔可收回。撤销包含地形、添加、收回、移动和旋转，最多保留 80 步。
- 营地自检先检查完整布局，再用正式规则检查唯一解。仅通过唯一解检查后可以导出；任何地图修改或撤销都会禁用导出，需要重新自检。
- 导出会自动复制 `WG1:` 开头的地图代码。它是带 `v:1` 的 UTF-8 JSON 经无填充 Base64URL 编码，保存尺寸、地形、稳定设施类型 ID、位置、旋转和行列目标，仅作为数据解析。
- 导入后从空棋盘游玩，不写入冒险进度。编辑地图暂不自动保存；返回时会确认丢弃修改，请复制地图代码保留作品。

Windows 可运行 `npm run dev` 或 `npm run desktop`，按「开始冒险 → 沙盒模式 → 创造地图」进入。最小示例：6×6 第一行第一格设水源、第二格放单格营地，营地自检通过后导出，再从「导入地图」粘贴并游玩。

Android 需要执行 `npm run android:apk` 重新生成 APK；新增剪贴板使用内置原生插件，无新增 npm 依赖。自检在 Web Worker 中执行，可通过编辑地图或返回取消；复杂地图可能需要较长时间，程序不会将未完成搜索当作唯一解。浏览器读取剪贴板需要系统许可，被拒绝时可直接在输入框粘贴。

## PWA 与后续平台

生产构建生成 manifest 和 Service Worker，首次成功加载并缓存后可离线启动。PWA 需要 HTTPS 或 localhost，开发服务器不注册 Service Worker；安装入口由浏览器提供。首次安装后刷新一次即可由 Service Worker 控制。更新在旧标签页关闭后启用，避免游玩中切换版本。

Windows 桌面版使用 Electron 加载本地 `wildgrid://game` 资源，无需启动 Web 服务。执行 `npm run package:win` 生成 `release/Wildgrid-Setup-0.2.1-x64.exe`；向导支持选择安装目录，并在快捷方式页面勾选或取消桌面快捷方式。开始菜单入口会保留。安装包未配置代码签名证书。

`npm run desktop` 可启动桌面开发构建；`npm run icons` 从 `public/icon.svg` 导出暖色 PNG 与包含 16–256px 尺寸的 `build/icon.ico`。桌面存档保存在 Electron 的用户数据目录，与浏览器存档分别保存。安装位置改变不影响桌面存档。

## Android 测试 APK

Android 使用 Capacitor 8 封装同一份 `dist`，应用名“野格”，包名 `com.wildgrid.game`，versionName `0.2.1`、versionCode `2`。需要 Node.js 22+、JDK 21 和 Android SDK 36；设置 `ANDROID_HOME` / `ANDROID_SDK_ROOT`，`JAVA_HOME` 指向 JDK 21。Windows 构建脚本也会查找 SDK 同级 AndroidStudio 或标准安装目录中的 JDK。

```sh
npm run android:sync # 构建 Web、生成游戏图标、同步 Android
npm run android:open # 在 Android Studio 打开原生容器
npm run android:apk  # 使用 Gradle wrapper 生成签名的 debug APK
```

APK 输出：`release/野格-v0.2.1.apk`，Gradle 原始输出仍位于 `android/app/build/outputs/apk/debug/app-debug.apk`。可以直接安装测试，或执行 `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`。Android 源码保留在仓库，APK、Gradle 缓存和同步的 Web 构建产物均忽略。

手机竖屏采用大棋盘与下方固定高度设施区，横屏采用棋盘与工具并排；列表、关卡选择和说明书各自可滚动。安全区使用 `env(safe-area-inset-*)` 和 Capacitor 的 inset 变量兼容旧 WebView。沿用 localStorage 保存进度和设置，强制退出再启动仍可恢复；清除应用数据或卸载会删除存档。音频仅在第一次用户交互时启动，后台暂停。Android 使用本地打包资源，不注册 Web Service Worker，避免旧缓存覆盖新版 APK。

## 验证范围

核心自动验证覆盖：30 关参考解法、旋转面积、取回后未完成状态、防火斜角距离、塔间斜角距离、边界/地形/重叠、多格行列计数、新设施规则，以及已通关布局重新进入时重置、未完成进度继续恢复。`levels:check` 检查 16–30 关唯一解；`test:ui` 在隔离存档中检查桌面与手机横竖屏、多格四向图案、提示即时关闭与恢复、固定棋盘/工具尺寸及触摸拿起/放置。棋盘上的规则错误持续显示，修正后恢复关卡提示。
