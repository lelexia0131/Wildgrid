# Wildgrid 全项目架构审计

审计日期：2026-10-18（Asia/Shanghai）。本报告记录修改前的真实架构；下列原路径/行号对应审计基线 HEAD，迁移后的路径见文件职责清单与迁移报告。先完成全部只读审计，再运行基线验证并开始写入；未执行 Git reset/clean、提交、推送或发布。

## A. 范围、文件职责与调用关系

正式维护基线201文件，其中97个JS/TS源码文件：src 82、tests 27、android 40、public 10、reports 14、scripts 7、server 6、electron 2、build 3、根配置/文档10。逐文件职责见 [engine-file-inventory.md](engine-file-inventory.md)。源码、配置和脚本审查内容、职责与引用；SVG坐标、字体、图标、JSON关卡及翻译按资源映射和数据完整性审查。依赖、生成产物不逐行审计。

额外审查忽略目录：`.desktop-smoke` 14,152文件中的67个非快照自维护脚本候选、39个历史源码快照候选；第三方font-tools 720文件仅检查管理。`release` 845文件为旧安装包、安装恢复快照、注册表备份、截图和复制产物。`node_modules`、Gradle缓存、Capacitor复制资源、dist、安装包和tsbuildinfo检查生成/忽略方式。未读取或输出凭证、未运行临时部署/重置/修复脚本。

关卡数据：45关，1–15为6×6、16–45为8×8；423地形（163水、165森林、95山地）；367设施与367参考放置。每关设施ID与答案ID集合相等，目标行列长度与尺寸一致。全部关卡及答案原文保持。

没有外部FiveRealms源码可供比对；按任务给出的单一实现源、职责明确、最小改动规范执行，没有假设FR内部实现。

### 原始运行入口

- Web/PWA：`index.html` → `src/main.tsx:14` → App；`main.tsx:15–16` 只在生产HTTP(S)且非原生环境注册SW。
- Windows：`package.json:8,27–28` → `electron/main.cjs` → `wildgrid://game` 中的同一dist；preload通过IPC提供身份/剪贴板。
- Android：`capacitor.config.ts` 的dist → Gradle/Manifest → `MainActivity.java` 注册身份与剪贴板插件；游戏核心仍运行同一Web bundle。
- 沙盒：`useSandboxEditor.ts:70` → `new Worker(new URL('../game/sandbox.worker.ts', import.meta.url))` → `checkSandbox` → 完整性、evaluate、solveLevel。
- 荒野：`useSurvivalChallenge.ts:78,96` → survival.worker → generateSurvival → 静态关卡种子、evaluate、solveLevel。
- 离线更新：`vite.config.ts:11–17` 枚举dist/assets生成sw.js；字体、徽章、图标有CSS/数组/manifest/打包引用，不能据普通import缺失认定无用。
- 维护：README:62 → `node scripts/author-levels.mjs`（重建前15关，拼接现有16–45）；`levels:check` → 正式solver。

### 原始核心调用链

```text
App 输入 → useGamePlacement → placementBlock
        → App.commit → withEditorPlacements（仅editor）
        → useGameHistory（React权威快照/80步历史）
        → evaluate → 行列/三态/通关 → App完成路由
主线：useAdventureProgress → storage → localStorage
沙盒：worker → sandbox → placementValidation / rules / solver → localMaps/clipboard
求生：worker → generator → rules / solver / survival（含存储模块）
结算：App → useSurvivalChallenge → completeSurvival → 最新账本 → 单次写盘
```

AST解析静态import/export、require、动态import及Worker URL，基线未发现模块循环；同时人工核查事件回调、CSS import、portal、kind动态组件、资源数组、原生插件注册、构建脚本和测试fixture。未引用export候选多为文件内部实际使用的类型，不是可删除证明；没有正式文件被判为可安全删除。

## 问题清单（原始路径与行号）

P0：未发现有充分证据的P0。

| ID/等级 | 文件与证据 | 调用关系、理由与本轮处理 |
|---|---|---|
| A01 P1 | `src/hooks/useGamePlacement.ts:35–83`，`src/App.tsx:241–243` | Hook实施库存选取、拾取、旋转、地形增删、候选追加；App另做编辑归一化。纯操作不能脱离React复用。迁入Engine Session命令，UI保留临时选择/反馈。 |
| A02 P1 | `useGameHistory.ts:4–23`，`App.tsx:255–281` | 核心快照类型、80步历史和模式恢复在UI层，缺少独立对局API。迁入Session；React只持有引擎返回的同一状态值。 |
| A03 P1 | `src/game/rules.ts:102–105,110–112` 与 `solver.ts:73` | tower/tower、fire/picnic八邻域冲突在正式判定和求解剪枝重复。最终evaluate能阻非法解，但过时剪枝可能漏解。合并到facilityConflict，由solver编译位掩码。 |
| A04 P1 | `src/game/storage.ts:9–16`，`App.tsx:23,128–129`，`CampDiary.tsx:9,19–20,30,37` | 主线解锁/重入业务绑定存储模块。纯冒险协议、进度/解锁归Engine，IO留适配器。 |
| A05 P1 | `src/game/survival.ts:7–38,40–95,106–119`，`survivalGenerator.ts:7–8` | 难度/XP/指纹与localStorage及结算混居，生成器因此拉入平台模块。纯模式模型/解析/结算归Engine，最新账本读取和单次写入留平台。 |
| A06 P2 | `useSurvivalChallenge.ts:8,43`，`App.tsx:276–281` | 模式存档导入React Hook的核心历史类型；旧存档past/future投影须双向兼容。统一类型到Engine。 |
| A07 P2 | `App.tsx:242`，`useGamePlacement.ts:76` | 同次editor放置在提交和反馈路径分别构造归一化局面。收敛到命令执行，反馈读取返回状态。 |
| A08 P2 | `useSurvivalChallenge.ts:89–91,101–105,113–115` | 替换、放弃、收藏权限的纯状态变更留在Hook。迁入模式函数；Worker/取消/时钟/存储协调仍保留。 |
| A09 P2 | `src/game/localMaps.ts:25–42`，特别`:30,38` | 名为parseLocalMaps的函数隐式读取整份survival存档，并结合完成/放弃推导图纸解锁。纯解析改显式接收快照，保留原解锁语义。 |
| A10 P2 | `scripts/author-levels.mjs:7–12`，`rules.ts:3–7,39–45` | 活跃创作脚本另定义形状/旋转/占格。改复用公共Engine occupied，保留原node命令和关卡数据。 |
| A11 P3 | `sandbox.ts:7`，`useGameHistory.ts:4` | SandboxDraft/Snapshot重复同结构。Snapshot归公共types，SandboxDraft仅作语义别名。 |
| A12 P2 遗留 | `tests/localMaps.test.ts:41–55,142–143,186` 对比`localMaps.ts:51–53` | 旧测试允许损坏条目过滤后继续写，现实现明确防覆盖；两处错误文案词序不符。保持存档保护，报告已有测试漂移。 |
| A13 P2 遗留 | `continuous-placement-ui.cjs:88,103`、`ui-smoke.cjs:125,132`、`tutorial-ui.cjs:68` | 默认UI测试仍查wide-operation/30关/旧日期，教学期待board而真实先welcome。不是迁移标准，不顺带改UI。 |
| A14 P2 遗留 | `local-maps-ui.cjs:155`、`tutorial-ui.cjs:147` 对比`Blueprint.tsx:12–35`，`interface-ui.cjs:81,116` | 旧测试期待图纸h2；当前组件无h2，另一个测试明确要求无标题。需统一测试契约。 |
| A15 P2 遗留 | `scripts/deploy-downloads.py:80–92` | 顺序替换两份安装包；失败只回滚nginx，可能留下半新发布。与引擎无关，仅申报。 |
| A16 P2 遗留 | `.desktop-smoke/id-hardening/reset.py:21–36`、`switch-443.py:18,30–32` | 忽略目录含暂停服务/删ID表/改数据库和nginx等历史维护脚本，无正式入口。建议单独归档和写清使用边界，不运行/删除。 |
| A17 P3 遗留 | `.desktop-smoke/browser-adapter.cjs:1`、`subset-fonts.py:3` | 用户缓存绝对路径、忽略目录内fontTools依赖使工具不可复现。后续整理工具入口。 |
| A18 P3 遗留 | `styles.css:3,26`、`viewport.css:73–79,309–320`、`fonts.css:40–48`、`survival.css:144–146` | 全局旧工具栏选择器和覆盖较多；动态class/跨屏规则仍需逐项证明，不删除候选CSS。 |
| A19 P3 遗留 | `Manual.tsx:65` 对比`App.tsx:195–202,264–268` | 手册说主线仅首次弹完成；当前重玩会重新庆祝。迁移保持现有行为，文案差异另报。 |
| A20 P3 遗留 | `README.md:62`、`author-levels.mjs:34–38` | 创作脚本实际只编写1–15，16–45直接保留。文档应准确说明，不能重建后30关。 |

## D. 遗留项与后续次序

1. 优先统一本地地图保护和UI测试契约，独立处理最高难度生成预算超时的既有问题；不要通过放宽唯一解或改难度来掩盖失败。
2. 单独处理部署多产物事务/回滚，将高影响临时维护脚本归档并建立可复现入口；不与引擎改动混合。
3. 后续按实际动态引用检查样式残留、重复覆盖和普通命名；视觉/动画模块本轮不拆分。
4. 旧版本安装包、安装恢复快照、`.desktop-smoke/local-baseline` 和日志是历史产物候选；未获删除任务、未做清理。

`reports/day31-baseline.json` 与`day31-preservation.json`由day31测试读取；徽章截图被设计报告引用；字体许可证随包分发。它们不是已证明的垃圾。当前没有可安全确认删除的正式源码/资源或死函数；没有用字符串搜索缺失推断死亡。
