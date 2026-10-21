# 仓库代码与文件审查

审查日期：2026-10-21（Asia/Shanghai）。审查基于当前工作区，起始提交 `30130f6`，起始 Git 工作区干净。本轮未修改业务代码、测试、配置，也未删除文件。

结论：分层总体明确，TypeScript 严格构建通过；存在公共 API 边界被绕过、生成与提示预算问题、测试契约失配和过时架构说明。未发现可以直接认定为整文件死代码的源码模块，也没有证据表明仓库存在大量垃圾源码或无用依赖。本地累积产物较多，但均在忽略规则内。

## 已确认问题

### 1. [P2] 新增提示、徽章代码绕过 Engine 唯一公共入口

`ARCHITECTURE.md:164` 附近约定外部只能导入 `engine` 或 `engine/index`，类型依赖同样受约束。实际有 **7 个文件、13 条导入声明**直接访问 Engine 内部：

- `src/game-modes/adventure/adventureBadges.ts:1`、`:2`
- `src/ui/components/AdventureHintPanel.tsx:3`、`:4`、`:5`
- `src/ui/components/HintBoardOverlay.tsx:2`、`:3`
- `src/ui/hooks/useAdventureHintAccess.ts:6`
- `src/ui/hooks/useAdventureHints.ts:3`、`:4`
- `src/workers/hint.worker.ts:1`、`:2`
- `src/workers/workerTasks.ts:5`

`tests/engine-boundaries.test.ts` 在第一条违规导入处失败，后续边界检查因此没有执行完。另行扫描全部 104 个 TS/TSX 文件的静态导入与重导出，未发现模块循环或其他层级反向依赖。应从 `engine/index.ts` 显式公开需要的提示 API 和类型，再统一调用入口，保留边界测试。

### 2. [P2] 10 难固定种子仍可能耗尽生成预算

`tests/day31.test.ts:117` 使用的 10 难种子为 `20261019`。完整测试、定向测试和脱离测试并发的单独调用均失败；单独调用 `generateMap(10, 20261019, 'audit-isolated', [])` 用时约 7602ms，返回 `MapGenerationSearchError`，约 60 次主构造后仍未找到可接受地图。

生产任务在 `src/workers/workerTasks.ts` 内会更换种子继续尝试，因此这不是已证明的 UI 最终生成失败；实际风险是等待时间不可预测，以及当前固定种子回归无法通过。应检查该种子对应的搜索和修复退化，不应只通过删除样本或放宽唯一性验收使测试变绿。

### 3. [P2] 第 28 关空棋盘提示存在预算敏感性

`src/engine/adventureHints.ts:31` 将逻辑演绎、寻找完整解及必要性证明共用 2500ms 截止时间。完整测试和定向测试均在第 28 关空棋盘返回 `unknown`，使“所有冒险关卡均可提供提示”的测试失败。单独调用可返回 `ready`，耗时恰好约 2500ms。

这是已观察到的时限敏感问题，不能断言第 28 关永远无法提示。应先测量各阶段消耗，为找到第一条可行提示保留预算；必要性证明耗尽时仍可使用已经找到的可行提示。UI 当前提供重试，未知结果不会作为有效提示收费。

### 4. [P2] 日记和美术测试没有跟随组件契约更新

- `tests/chapter-navigation.test.ts:17` 创建 `CampDiary` 时遗漏新增的必需参数 `badges`。SSR 加载返回动态模块，绕过了参数类型检查；三个测试均因读取 `badges[id]` 抛错。应补齐测试输入并保留组件 Props 的类型约束。
- `tests/levelArtwork.test.ts:5` 直接在 Node/tsx 中加载引用 `import.meta.glob` 的组件，运行时抛出 `glob is not a function`。同时 `:22`、`:23` 仍断言旧版内联 SVG 属性，而组件现在返回 `<img>`。应采用已有 Vite SSR 加载方式，并按当前外部图片契约验证资源、替代文本和关卡映射。
- `tests/localMaps.test.ts:41` 仍要求保存时自动丢弃损坏条目，但 `src/save-system/localMapSaveCodec.ts:33` 明确阻止这种覆盖；与现有存档保护测试的意图冲突。另有两个测试仅因“无法读取本地地图”与“本地地图无法读取”的错误文案语序不同而失败。应按当前防覆盖合同更新测试，不应撤销存档保护。

这些失配会让默认测试长期报错，掩盖新的功能回归。

### 5. [P2] 生成验收与难度复核使用不同推理预算

`src/engine/mapGeneration.ts:123` 对高难生成使用最多 64 次假设、2 层深度、96 个未解决候选阈值，并共享本轮生成截止时间。`:32` 的 `generationDifficulty` 默认重新推理却使用 24 次假设、200ms，并采用 `reasonLevel` 的默认未解决阈值。

`tests/survival-rework.test.ts:82` 使用后者复核，完整测试在 `:83` 的逻辑可解/评分断言失败。因此同一函数目前兼有“根据已完成推理计分”和“另起一个更短预算重新推理”两种语义，复核结果并不保证与生成时一致。这不能直接证明输出地图不合法或不唯一。应明确复核标准并使用一致预算，或者显式区分推理未完成与不满足难度标准。

### 6. [P2] 历史关卡保持性校验与当前数据不一致

`tests/day31.test.ts:54` 的前 30 关哈希与 `tests/fixtures/day31-preservation.json` 不一致；`scripts/check-engine-preservation.ts:11` 的全部关卡哈希也不一致，脚本直接退出。部分现有测试又明确要求第 12、14、15 关唯一解，而架构文档仍称这些关卡在历史基线中有多解。

这是历史验收合同没有统一的证据，不足以直接判断当前关卡内容错误。应核对关卡调整记录，区分需要保留的旧版基线与新版目标；不要直接刷新所有哈希掩盖可能的非预期数据变更。

### 7. [P3] 两处 Hook 每次渲染都创建并丢弃任务对象

`src/ui/hooks/useSurvivalChallenge.ts:38` 的 `useRef(createSurvivalGenerationTask())` 和 `src/ui/hooks/useSandboxEditor.ts:30` 的 `useRef(createSandboxCheckTask())` 都会先执行参数表达式。React 只保留首个 ref 值，之后创建的对象和闭包被丢弃。上层 App 在悬停、选择等操作时重渲染，这些构造也随之重复。

当前工厂直到 `start()` 才创建真正的 Worker，所以没有证据表明这里产生 Worker 泄漏。可采用明确的一次初始化方式，消除重复对象分配。此外，两个提示 Hook 每次渲染均序列化棋盘上下文，即使提示关闭也执行；属于可以后续按性能测量决定是否优化的计算，不认定为死代码。

### 8. [P3] 架构和用户说明存在过时内容

- `ARCHITECTURE.md:261`、`:335` 仍称只有两个任务消费者、25 秒外层超时和 24 秒生成窗口；实际已有提示任务，求生按每轮预算换种子重试，直到成功或取消。
- `README.md:112` 仍描述五档身份，实际 `SURVIVAL_RANKS` 已有 15 档，最高阈值为 80000 XP。
- `ARCHITECTURE.md:337` 的关卡保持性结论与当前校验结果不符。

这些说明不能作为当前实现行为的依据，应与代码和验收标准一起更新。

## 死代码、依赖和文件判断

从 `src/main.tsx` 出发，结合静态导入、重导出、Worker URL 和样式导入检查，未发现完全不可达的源码模块。导出符号也核对了内部使用及测试/脚本使用，未将“仅测试使用”“仅模块内部使用”或类型导出直接当作死代码。

`package.json` 中依赖均有可解释用途：例如 `@capacitor/android` 被 Gradle 使用，`sharp` 被资源构建和审计脚本使用。根目录与 `server` 的两份 lockfile 对应独立应用；Node 与 Python 部署脚本承担本地编排和远端发布两种职责，不能按名称相近判为重复垃圾。

美术审计成功解码 177 个游戏图片和 20 个平台图标。170 个源 SVG 中的 5 个原始求生徽章被运行时资源表明确排除，但由 `scripts/build-survival-badges.mjs` 生成 15 个等级徽章，属于构建源材料。重复哈希主要来自 Android 圆形/普通启动图标及 Web/Windows 共用图标，均有平台路径用途。

本地目录实测（运行检查后的近似值；均被 Git 忽略）：

| 目录 | 文件数 | 大小 | 判断 |
| --- | ---: | ---: | --- |
| `.desktop-smoke/` | 约 2500 | 260 MiB | 截图、测试报告和历史验收证据；可选择归档或清理 |
| `.builder-cache/` | 731 | 26.6 MiB | 可再生成的打包缓存 |
| `dist/` | 194 | 10.8 MiB | 可由构建再生成的当前 Web 产物 |
| `release/` | 313 | 801.6 MiB | 安装包、解包目录、日志及恢复备份；需逐项区分 |

`release/` 中仍有 1.0.0 的 EXE/APK、当前 1.1.0 产物和两个 `install-recovery-*` 目录。旧安装包可以作为清理候选，但恢复备份不能默认当作垃圾删除。`node_modules/`、Android 构建缓存和 `tsconfig.tsbuildinfo` 同样是正常忽略产物。本轮未发现已跟踪的临时日志、安装包、依赖目录或明显垃圾文件。

## 验证记录与边界

- `npm run build`：通过 TypeScript 严格检查及 Vite 构建；仍有 604.63 kB 主 JS 分块提示。这是体积优化提示，不是死代码证据。
- `npm test`：137 项，125 通过、12 失败，约 105 秒。完整记录见 `.desktop-smoke/repository-audit-tests.log`。
- 定向复核提示、日记、Day31、边界和本地地图测试：22 项，12 通过、10 失败。记录见 `.desktop-smoke/repository-audit-targeted.log`。
- `node scripts/audit-art.mjs`：通过；清单见 `.desktop-smoke/art-inventory.json`。
- `tsx scripts/check-engine-preservation.ts`：关卡哈希不一致，失败。
- 独立运行第 28 关空棋盘提示：`ready`，约 2500ms；独立运行 10 难/种子 20261019：7602ms 后失败。

未执行 Electron 交互测试、Android 构建/真机测试、真实身份服务请求或部署操作。TS 配置覆盖 `src`、TS 测试与 `vite.config.ts`，不等于 Electron/服务端 JS、维护脚本和 Android Java 均通过静态类型检查。没有据此给出“全仓库零缺陷”结论。

建议处理顺序：恢复公共入口边界和默认测试的可信度；统一关卡历史合同与推理复核预算；处理固定种子生成退化和提示时限敏感性；最后再做重复构造、文档及本地产物清理。
