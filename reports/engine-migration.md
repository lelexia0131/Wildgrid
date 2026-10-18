# Wildgrid Engine 迁移与验证报告

日期：2026-10-18。全项目只读审计完成后，已完成最小必要引擎建设及三种模式接入。没有通用引擎、巨型Engine类或新状态框架；主要复用原有纯实现。没有提交、推送、发布、Git reset/clean或删除无关文件。

## A. 审计交付

[全项目审计与分级遗留清单](engine-audit.md)记录201个正式维护文件、97个JS/TS源码文件及额外历史维护脚本的范围，列出原文件/行号、调用证据和P0–P3结论。[逐文件职责清单](engine-file-inventory.md)提供全部201行文件与迁移路径。无有充分证据的P0；无法证明安全无用的文件仅作为候选申报。

## B. 引擎结构与公共契约

实际模块、完整API表、示例、状态所有权、数据流及平台边界见 [ARCHITECTURE.md](../ARCHITECTURE.md)。入口为`src/engine/index.ts`，三模式和两Worker均通过该入口消费能力。

| 核心能力 | 唯一权威实现及最终调用证据 | 停用旧入口与防重复方式 |
|---|---|---|
| 对局/棋盘/历史 | `engine/session.ts:23,27,31,35`；`useGameHistory.ts:9,26`仅调用createSession/dispatch；`useGamePlacement.ts:43,50,57,65,70`派发命令 | App.commit、Hook内棋盘追加/过滤/旋转/地形变更移除；Snapshot定义归types.ts:11 |
| 几何、规则、通关 | `engine/rules.ts:18,27,48,54,55,59,69`；Session和Solver直接复用 | 原game/rules物理迁移，不保留转发实现；UI几何仅绘图/命中与预览 |
| 设施冲突与搜索 | `engine/solver.ts:37,74`从facilityConflict编译forbidden mask；最终解仍evaluate复核 | 移除tower/tower、fire/picnic独立剪枝规则；保留同类排序、预算、搜索顺序 |
| 地形禁令与生成 | `engine/rules.ts:27`的terrainConflict；`survivalGenerator.ts:127`森林预筛调用它 | 移除森林/篝火距离副本，保留原forest-only过滤、随机调用与参数 |
| 关卡/蓝图 | `engine/levels.ts:5–13`读取原JSON；`sandbox.ts:84,97,112`自检/WG1 | 旧game核心模块迁走；author-levels.mjs使用公共occupied，不另存形状定义 |
| 冒险进度/解锁 | `engine/adventure.ts:10,14,18,28,33–38`；`useAdventureProgress.ts:12,15` | storage仅IO；App/CampDiary不再从storage读取业务规则 |
| 求生状态/经验 | `engine/survival.ts:7–37,39,48,89,95,102,117–130` | Hook替换/放弃/重开/收藏调用纯API；game适配器只读最新、调用结算并单次写入 |
| 本地地图/权限 | `engine/localMaps.ts:24,44,51,56,70–88` | parse显式接收SurvivalSave；adapter获取快照，没有隐式引擎→平台读取 |

`tests/engine-boundaries.test.ts`检查引擎平台/外部/反向依赖、私有实现路径导入及循环。新增Session/模式测试与既有规则测试约束行为；约定新增玩法只在权威模块实现，不能靠架构检查自动证明任意未来业务代码的语义唯一。

UI导航/选择/悬停/未落子方向/反馈仍由React管理；唯一可操作棋盘和历史来自Engine Session。存档为持久化投影。UI中的完成effect负责选择对应存储/庆祝操作，完成判定、解锁、经验和账本变更全部由引擎提供。

## C. 文件与函数迁移

### 物理迁移并停用的10个旧文件

以下全部从`src/game/<name>.ts`迁入`src/engine/<name>.ts`，旧路径不保留重复实现或转发：

`types`、`facilityRegistry`、`levels`、`mapIcons`、`rules`、`placementValidation`、`placementHints`、`solver`、`sandbox`、`survivalGenerator`。

### 新建实现及测试

- `src/engine/index.ts`：唯一公共入口和结果类型导出。
- `src/engine/session.ts`：操作、历史、查询、错误和业务事件。
- `src/engine/adventure.ts`：由storage/冒险Hook迁入协议、解锁、重入、进度与完成函数。
- `src/engine/survival.ts`：由原survival/求生Hook迁入纯协议、统计、归档、结算、替换/放弃/重开/更新。
- `src/engine/localMaps.ts`：由原localMaps/求生Hook迁入纯地图业务、严格校验和收藏权限。
- `tests/engine.test.ts`：4条Session关键回归；`engine-modes.test.ts`：2条模式/协议回归；`engine-boundaries.test.ts`：1条架构依赖检查。

### 必要修改

- `src/App.tsx`、`hooks/useGameHistory.ts`、`useGamePlacement.ts`：删除原局面变更路径，接入Session命令/查询/恢复。
- `hooks/useAdventureProgress.ts`、`useSurvivalChallenge.ts`：核心进度和模式状态转移调用Engine；保留React effect、Worker、写盘、提示与弹窗。
- `game/storage.ts`、`survival.ts`、`localMaps.ts`：缩为实际IO、错误处理与事务协调；没有第二份规则或进度计算。
- `scripts/author-levels.mjs`：原node命令保持，经现有tsx加载公共occupied，删除形状旋转副本；`scripts/check-levels.ts`改公共导入。
- 两Worker、audio/tutorial、其余Hook、相关组件/i18n和原单元测试：必要的公共API/共享类型导入迁移；具体完整改动列表见文末。
- `ARCHITECTURE.md`、README的目录/API说明按实际实现更新；新增审计、职责、迁移和等价证据报告。

### 消除重复与保留语义

消除React中的棋盘变更和独立历史实现、App/Hook双路径沙盒归一化、Solver设施冲突副本、Generator森林/火禁令副本、离线创作形状副本，以及Hook/沙盒重复快照类型。原纯规则、solver、WG1和生成器作为现有正确实现迁移，未另写一套并行核心。

保留模式专用逻辑：主线两条解锁链和已解关卡重入重置；editor按实际答案重建目标/设施；普通沙盒不记主线/求生经验；求生生成成功写盘后替换、失败保留旧挑战、放弃解锁收藏且不记完成、结算幂等和原历史/选择/方向恢复。

未迁入引擎的功能及原因：教程是UI步骤与DOM目标；音效/动画/剪贴板/身份/存储IO是平台副作用；Worker创建、取消、crypto/时间获取是任务协调；普通视觉组件/CSS是表现。这些是明确保留的分层职责，不是第二套游戏规则。非引擎遗留只申报，详见审计D部分。

公开状态沿用共享引用契约，不做全树复制/冻结以免改变依赖对象身份的教学和庆祝；消费者必须通过命令更新。非法输入同时遇损坏存储时，适配器可能优先返回存储保护错误（读取/校验顺序已收敛）；合法操作、落盘格式和错误文本保持。

## E. 实际验证

| 检查 | 实际结果 |
|---|---|
| 修改前`npm test` | 59项，55通过、4失败；在任何源码迁移前记录基线 |
| 主体迁移后`npm test` | 66项，62通过、4失败，与基线同名；7项新测试全部通过 |
| 最终针对性核心/模式/边界/存档测试 | 27/27通过；最后terrain helper提取后执行 |
| `npm run build` | 最终TypeScript+Vite通过；sandbox/survival两个Worker正常产出。保留已有大chunk告警，未顺带拆包 |
| `npm run levels:check` | 16–45关30/30唯一解检查通过 |
| 最终45关Solver前后对照 | 全部完整输出一致，含解顺序、nodes/candidates/forced与中止状态；[证据和只读复现脚本](engine-equivalence.json) |
| 最终779个evaluate输出对照 | 完整解、逐设施移除、逐设施下移扰动均完全一致；SHA256为`1c91483cb752b4adf6bc5ca172002f15e978012261e0f363740049eddb86b42c` |
| 最终既有低/中/高生成用例 | `day31.test.ts`中的1/5/10难样例通过，均正式规则合法、唯一；原奖励档位保持 |
| 创作脚本新旧对照 | 隔离工作目录执行原/新脚本，两JSON输出逐字节哈希一致，工作区关卡数据未改；[证据](engine-authoring-equivalence.json) |
| `quality-ui.cjs` | 四视口全部原业务/DOM/存档/教程/历史/求生结算断言通过；1280×900 zh、390×844 zh、844×390 en、320×568 en。截图见下方限制 |
| 源码及资源保全 | 关卡、答案、CSS、字体/徽章/图标、原生工程、身份/网络服务无内容改动；旧核心路径没有运行引用 |
| diff空白检查 | 通过（Windows CRLF按cr-at-eol检查） |

四项既有失败：

1. localMaps“损坏条目过滤后仍允许保存”旧期望，与当前防覆盖策略冲突。
2. localMaps删除/重命名读失败的旧错误正则词序不符。
3. localMaps保存读失败的同类旧正则不符。
4. 十档生成测试最高档固定seed=2在原时间预算内未找到地图；迁移前后均超时。另一既有1/5/10档样例正常通过。没有放宽唯一解、延长预算或改动难度来让测试通过。

截图/平台限制：原quality-ui离屏截图返回`UnknownVizError`，随后只在忽略目录临时runner中以内存替换shot helper，保留全部原业务和DOM断言，退出0；原测试和产品代码未改，截图验证没有通过。interface-ui在原生启动阶段退出（Crashpad not connected），未进入JS断言，记为未验证。没有声称完整默认`test:ui`通过。

没有运行Windows安装包/安装升级、Android Gradle/APK/真机、真实设备身份或网络API验证；只验证共享Web构建、静态平台调用路径和上述离屏业务断言。没有发布、修改服务器或玩家数据。

机器可读结果与日志位置见 [engine-validation.json](engine-validation.json)。

## 已修改的原有文件完整清单

- `ARCHITECTURE.md`
- `README.md`
- `scripts/author-levels.mjs`
- `scripts/check-levels.ts`
- `src/App.tsx`
- `src/components/Art.tsx`
- `src/components/Blueprint.tsx`
- `src/components/CampDiary.tsx`
- `src/components/Manual.tsx`
- `src/components/MenuIcon.tsx`
- `src/components/SandboxMenu.tsx`
- `src/components/SurvivalBadge.tsx`
- `src/components/SurvivalMenu.tsx`
- `src/components/journalArt.ts`
- `src/game/audio.ts`
- `src/game/localMaps.ts`
- `src/game/sandbox.worker.ts`
- `src/game/storage.ts`
- `src/game/survival.ts`
- `src/game/survival.worker.ts`
- `src/game/tutorial.ts`
- `src/hooks/useAdventureProgress.ts`
- `src/hooks/useBoardFeedback.ts`
- `src/hooks/useGameHistory.ts`
- `src/hooks/useGameNavigation.ts`
- `src/hooks/useGamePlacement.ts`
- `src/hooks/useSandboxEditor.ts`
- `src/hooks/useSurvivalChallenge.ts`
- `src/hooks/useTutorial.ts`
- `src/i18n/index.ts`
- `tests/audio.test.ts`
- `tests/day31.test.ts`
- `tests/game.test.ts`
- `tests/levelArtwork.test.ts`
- `tests/localMaps.test.ts`
- `tests/placementHints.test.ts`
- `tests/sandbox.test.ts`
- `tests/save-protection.test.ts`
- `tests/survival-records.test.ts`
- `tests/survival.test.ts`
- `tests/tutorial.test.ts`
