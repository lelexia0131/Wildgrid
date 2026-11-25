# 测试分类与运行方式

所有命令从仓库根目录执行。测试按职责集中组织，文件名保持原样，固定基线不随测试文件移动。

开发环境见[开发指南](../docs/DEVELOPMENT.md)。Steam 完整构建与发行验收只维护在[Steam 流程](../scripts/steam/README.md)；动态结果见[发布状态](../scripts/steam/RELEASE_STATUS.md)。

| 目录 | 职责 |
| --- | --- |
| `engine/` | 正式规则、几何、Session、求解与生成、冒险提示、分层边界 |
| `modes/` | 冒险进度和徽章、固定关卡、沙盒、求生流程与记录 |
| `storage/` | 本地地图存档、格式兼容、防覆盖、教程偏好 |
| `platform/` | 音频及 Worker 创建、取消、暂停、超时、过期回复 |
| `ui/` | React SSR 单元测试及全部 Electron 交互、布局、视觉脚本 |
| `fixtures/` | 历史基线、兼容存档及明确批准的关卡修正数据 |
| `support/` | 共享视口测试页面及其启动脚本 |

完整单元测试与构建：

```sh
npm test
npm run build
```

`npm test`递归发现五类目录内全部`*.test.ts`，串行执行。生成和提示测试会执行有真实截止时间的 CPU 搜索；串行调度避免测试进程相互争抢 CPU，不修改生产搜索预算或验收阈值。

实时三维棋盘另有 `npm run test:3d`。它用本机 Chrome 的隔离浏览器上下文操作正式游戏，生成截图及动效样本。专项用例实际完成 Day 39，检查平视、原平面图纸、设施栏、名称开关、相连水域、选中遮挡和第一关演示。历史摘要中的山地命名在测试侧单独对齐为岩石，原始哈希保持可复核。详见[三维验收](../docs/3d/validation.md)。

分类或定向运行：

```sh
npx tsx --test --test-concurrency=1 tests/engine/*.test.ts
npx tsx --test --test-concurrency=1 tests/modes/*.test.ts
npx tsx --test --test-concurrency=1 tests/storage/*.test.ts
npx tsx --test --test-concurrency=1 tests/platform/*.test.ts
npx tsx --test --test-concurrency=1 tests/ui/*.test.ts
npx tsx --test tests/engine/engine-boundaries.test.ts
npx tsx --test tests/engine/adventure-hints.test.ts
npx tsx scripts/check-engine-preservation.ts
```

Electron Web UI 检查先运行 `npm run build`。原生 `test:desktop` 默认读取 `release/camp-world/win-unpacked/resources/app.asar`，需要更新实包时先运行 `npm run package:win`。再按范围选择：

```sh
npm run test:desktop
npm run test:ui
npx electron tests/ui/adventure-hints-ui.cjs
npx electron tests/ui/chapter-navigation-ui.cjs
```

TS 单元测试成功不代表全部 Electron 脚本、Android 真机和部署验证均已执行。每次报告应说明实际运行范围。

Steam 窗口适配单元可单独运行 `node --test scripts/steam/tests/window.test.cjs`；完整 Steam 成品检查由 `npm run steam:build` 调度，`npm run steam:preflight` 只复核已经成功的成品，不启动 SteamCMD。未注册到 package.json 的独立 UI 脚本需按当前界面契约逐项复核，不把文件存在或历史结果当作本次通过。

## 历史基线的含义

`phase2-engine-baseline.json`和`day31-preservation.json`保留原始内容。提交`7a1a02e`只修正第12、14、15关地形以消除多解；`level-corrections.json`记录精确的修改前后地形。保持性校验先检查当前地形恰好匹配这三项修正，再还原地形并核对原始整体验收合同，防止其他关卡或字段发生意外变化。

后续生成器优化已改变 MRV 搜索顺序、节点统计及结果元数据。`phase2-solver-solutions.json`来自`7ced25a`中的求解器：提取前逐关确认旧求解器输出匹配原始`solverHash`，然后记录穷尽搜索的完整解集。当前校验比较完整解集，不再把搜索访问顺序、对象键顺序或新增`branches`字段作为游戏玩法合同。779次规则判定和45个WG1字节摘要继续使用原始哈希；所有参考答案保持不变。

未来若关卡内容确需调整，应先记录修改依据和精确差异；不能批量刷新基线使测试通过。
