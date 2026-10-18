# 第二阶段迁移与交付报告

日期：2026-10-18（Asia/Shanghai）。工作基线为开始时无未提交改动的当前HEAD；第一阶段报告已读取，实际代码优先。未获取FiveRealms源码，未声称逐条复现其内部规范。

## A. 现状差异与实际完成

| 核查项 | 修改前实际状态 | 本轮结果 |
|---|---|---|
| 第一阶段Engine | 已有统一入口、Session命令/80步历史、正式规则、位集合Solver和生成算法 | 全部沿用；几何按职责提取，算法与操作语义保留 |
| 模式/存档边界 | Engine内冒险、求生、地图收藏混合协议与模式业务 | game-modes负责业务；save-system负责协议/恢复/持久化 |
| React接入 | useGameHistory已经只持有Engine Session，非第二套历史 | 改名useGameSession，保留ref/state同对象机制 |
| 状态查询 | Session/Snapshot/Level等暴露可写数组类型 | 递归覆盖棋盘契约的只读字段/数组；保留对象身份和不可变命令 |
| 平台/后台 | src/game混有存档、音频、身份、Worker；Hook创建Worker和计时器 | platform、save-system、workers各自归层；保留取消/超时/过期结果保护 |
| App | 页面协调与棋盘SVG/提示渲染混合 | GameBoard承接棋盘渲染，App保留UI编排 |
| 命名 | 一般storage/sandbox/survival文件语义依赖旧聚集路径 | 使用adventureStorage、mapBlueprint、survivalChallenge等具体名称；固定表/阈值大写 |

未新增依赖、未重写引擎、未建立Manager/Service/Repository类或空目录。紧密关联的规则、自检和WG1逻辑保持聚合。

## B. 完整新旧路径映射

下表覆盖67条迁移映射；加号表示职责拆分，花括号表示同目录内实际文件。旧路径已经移除，未保留两份有效实现。

| 原文件路径 | 新文件路径 | 原职责 | 新职责 | 拆分/迁移/合并原因 |
|---|---|---|---|---|
| src/components/Art.tsx | src/ui/components/Art.tsx | 地形/设施SVG和占格轮廓 | 地形/设施SVG和占格轮廓 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/components/Blueprint.tsx | src/ui/components/Blueprint.tsx | 参考图纸展示 | 参考图纸展示 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/components/CampDiary.tsx | src/ui/screens/CampDiary.tsx | 章节/关卡日记页面 | 章节/关卡日记页面 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/components/CampToolIcon.tsx | src/ui/components/CampToolIcon.tsx | 营地操作图标 | 营地操作图标 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/components/ChapterArtwork.tsx | src/ui/components/ChapterArtwork.tsx | 章节封面插画 | 章节封面插画 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/components/CompletionEmblem.tsx | src/ui/components/CompletionEmblem.tsx | 完成徽章布局 | 完成徽章布局 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/components/GameTitle.tsx | src/ui/components/GameTitle.tsx | 中英文标题SVG字形与入场表现 | 中英文标题SVG字形与入场表现 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/components/HeroArt.tsx | src/ui/components/HeroArt.tsx | 首页动画插画 | 首页动画插画 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/components/journalArt.ts | src/ui/components/journalArt.ts | 章节/关卡封面与调色板定义 | 章节/关卡封面与调色板定义 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/components/JournalChapterBackground.tsx | src/ui/components/JournalChapterBackground.tsx | 章节背景插画 | 章节背景插画 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/components/JournalLevelSceneArt.tsx | src/ui/components/JournalLevelSceneArt.tsx | 关卡场景插画组合 | 关卡场景插画组合 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/components/journalSceneDesigns.ts | src/ui/components/journalSceneDesigns.ts | 45关手绘场景构图数据 | 45关手绘场景构图数据 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/components/JournalSceneObjects.tsx | src/ui/components/JournalSceneObjects.tsx | 场景设施/植物绘制原语 | 场景设施/植物绘制原语 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/components/LevelArtwork.tsx | src/ui/components/JournalLevelSceneArt.tsx（直接复用） | 仅转发同名id到场景组件 | 直接调用实际场景组件 | 无额外行为；静态/动态入口均检查，97组SSR等价验证通过 |
| src/components/Manual.tsx | src/ui/components/Manual.tsx | 手册与规则示例展示 | 手册与规则示例展示 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/components/MenuIcon.tsx | src/ui/components/MenuIcon.tsx | 菜单和地图图标渲染 | 菜单和地图图标渲染 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/components/SandboxArt.tsx | src/ui/components/SandboxArt.tsx | 模式菜单插画 | 模式菜单插画 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/components/SandboxMenu.tsx | src/ui/screens/SandboxMenu.tsx | 沙盒/导入/本地地图菜单与表单 | 沙盒/导入/本地地图菜单与表单 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/components/SurvivalBadge.tsx | src/ui/components/SurvivalBadge.tsx | 求生身份SVG徽章选择 | 求生身份SVG徽章选择 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/components/SurvivalMenu.tsx | src/ui/screens/SurvivalMenu.tsx | 难度/挑战/历史菜单 | 难度/挑战/历史菜单 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/components/tutorial.css | src/ui/styles/tutorial.css | 原有样式/布局/字体引用 | 原有样式/布局/字体引用 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/components/TutorialOverlay.tsx | src/ui/components/TutorialOverlay.tsx | 教学聚焦、箭头和旁白覆盖层 | 教学聚焦、箭头和旁白覆盖层 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/components/TutorialSettings.tsx | src/ui/components/TutorialSettings.tsx | 教学/语言偏好表单 | 教学/语言偏好表单 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/hooks/useAdventureProgress.ts | src/ui/hooks/useAdventureProgress.ts | 主线进度持久化和React适配 | 主线进度持久化和React适配 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/hooks/useBoardFeedback.ts | src/ui/hooks/useBoardFeedback.ts | 放置/拒绝/离场动画 | 放置/拒绝/离场动画 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/hooks/useGameHistory.ts | src/ui/hooks/useGameSession.ts | 纯Session命令结果与React状态连接 | 纯Session命令结果与React状态连接 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/hooks/useGameNavigation.ts | src/ui/hooks/useGameNavigation.ts | 页面和模式导航UI状态 | 页面和模式导航UI状态 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/hooks/useGamePlacement.ts | src/ui/hooks/useGamePlacement.ts | 选择/悬停/预览及Session命令输入 | 选择/悬停/预览及Session命令输入 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/hooks/useHeroMotion.ts | src/ui/hooks/useHeroMotion.ts | 动画可见性与系统减弱动态偏好 | 动画可见性与系统减弱动态偏好 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/hooks/useHomeEntrance.ts | src/ui/hooks/useHomeEntrance.ts | 首页入场生命周期 | 首页入场生命周期 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/hooks/useSandboxEditor.ts | src/ui/hooks/useSandboxEditor.ts | 沙盒交互与地图/任务IO协调 | 沙盒交互与地图/任务IO协调（Worker生命周期交给workers/workerTasks.ts） | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/hooks/useSurvivalChallenge.ts | src/ui/hooks/useSurvivalChallenge.ts | 求生交互与账本/任务IO协调 | 求生交互与账本/任务IO协调（Worker生命周期交给workers/workerTasks.ts） | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/hooks/useTutorial.ts | src/ui/hooks/useTutorial.ts | 教学UI和偏好订阅/交互协调 | 教学UI和偏好订阅/交互协调 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/i18n/context.tsx | src/localization/LanguageContext.tsx | 语言上下文和参数化翻译 | 语言上下文和参数化翻译 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/i18n/dateTime.ts | src/localization/dateTime.ts | 日期/时间本地化 | 日期/时间本地化 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/i18n/feedback.ts | src/localization/feedback.ts | 规则/系统反馈英文表 | 规则/系统反馈英文表 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/i18n/index.ts | src/localization/index.ts | 双语课程与设施说明字典 | 双语课程与设施说明字典 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/i18n/manual.ts | src/localization/manual.ts | 手册英文表 | 手册英文表 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/i18n/ui.ts | src/localization/ui.ts | UI双语翻译与覆盖 | UI双语翻译与覆盖 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/completion.css | src/ui/styles/completion.css | 原有样式/布局/字体引用 | 原有样式/布局/字体引用 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/fonts.css | src/ui/styles/fonts.css | 原有样式/布局/字体引用 | 原有样式/布局/字体引用 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/hero.css | src/ui/styles/hero.css | 原有样式/布局/字体引用 | 原有样式/布局/字体引用 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/notebook.css | src/ui/styles/notebook.css | 原有样式/布局/字体引用 | 原有样式/布局/字体引用 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/sandbox.css | src/ui/styles/sandbox.css | 原有样式/布局/字体引用 | 原有样式/布局/字体引用 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/styles.css | src/ui/styles/styles.css | 原有样式/布局/字体引用 | 原有样式/布局/字体引用 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/survival.css | src/ui/styles/survival.css | 原有样式/布局/字体引用 | 原有样式/布局/字体引用 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/viewport.css | src/ui/styles/viewport.css | 原有样式/布局/字体引用 | 原有样式/布局/字体引用 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/App.tsx | src/ui/App.tsx + src/ui/components/GameBoard.tsx（运行环境判断至platform/runtime.ts） | 页面、棋盘渲染、UI交互协调 | App协调页面，GameBoard仅渲染和转发输入 | 按表现层职责提取棋盘，保留DOM/布局/事件顺序 |
| src/game/audio.ts | src/platform/audio/WildernessAudio.ts | Web Audio播放与生命周期 | Web Audio播放与生命周期 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/game/clipboard.ts | src/platform/clipboard.ts | Web/Electron/Android剪贴板适配 | Web/Electron/Android剪贴板适配 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/game/playerId.ts | src/platform/playerId.ts | 匿名设备身份原生桥与超时 | 匿名设备身份原生桥与超时 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/game/storage.ts | src/save-system/adventureStorage.ts | 主线存档读写与失败保护 | 主线存档读写与失败保护 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/game/localMaps.ts | src/save-system/localMapStorage.ts | 本地地图持久化协调 | 本地地图持久化协调 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/game/survival.ts | src/save-system/survivalStorage.ts | 求生持久化与最新账本结算协调 | 求生持久化与最新账本结算协调 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/game/tutorial.ts | src/ui/tutorial/tutorialLessons.ts + src/save-system/tutorialStorage.ts | 教学课程、UI目标与偏好存储混合 | UI课程/事件与偏好恢复/持久化分离 | 存档系统不依赖DOM/React课程 |
| src/game/sandbox.worker.ts | src/workers/sandbox.worker.ts | 后台计算消息入口 | 后台计算消息入口 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/game/survival.worker.ts | src/workers/survival.worker.ts | 后台计算消息入口 | 后台计算消息入口 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/engine/adventure.ts | src/game-modes/adventure/adventureProgress.ts + src/save-system/adventureSaveCodec.ts | 主线业务和存档格式混合 | 模式负责解锁/进度，Codec负责v1解析与保护 | 消除Engine中的模式/存档职责 |
| src/engine/survival.ts | src/game-modes/survival/{survivalChallenge,survivalDifficulty}.ts + src/save-system/survivalSaveCodec.ts | 求生模型、难度、流程、协议混合 | 模式处理挑战/XP；Codec处理账本/历史格式 | 分离模式决策和数据恢复；指纹归Engine内部 |
| src/engine/localMaps.ts | src/game-modes/sandbox/localMapCollection.ts + src/save-system/localMapSaveCodec.ts | 地图收藏业务和v1协议混合 | 收藏/权限纯变更与协议解析分别归属 | 显式使用求生快照，保留保护策略 |
| src/engine/mapIcons.ts | src/game-modes/sandbox/mapIcons.ts | 本地地图稳定图标ID与校验 | 本地地图稳定图标ID与校验 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/engine/session.ts | src/engine/gameSession.ts | 纯Session命令、历史和查询 | 纯Session命令、历史和查询 | 按真实职责归层；同步导入、资源或构建/测试引用 |
| src/engine/rules.ts | src/engine/placementRules.ts + src/engine/boardGeometry.ts | 正式规则及通用几何 | 正式规则和独立可复用棋盘几何 | Solver/渲染/Session共用同一几何，正式约束唯一 |
| src/engine/sandbox.ts | src/engine/mapBlueprint.ts | 通用蓝图、规范化、自检和WG1 | 同一通用地图数据契约 | 名称表达实际跨模式职责，不再误认为只服务沙盒 |
| src/engine/survivalGenerator.ts | src/engine/mapGeneration.ts + game-modes/survival/survivalChallenge.ts的generateSurvival入口 | 随机搜索、难度表/求生模型依赖 | Engine保留算法；模式选规格并返回挑战 | 去除Engine向模式业务的反向依赖，不改预算/搜索 |
| src/data/levels.json | src/game-data/levels.json | 45关固定数据 | 45关固定数据 | 按固定游戏数据归类，内容不变 |
| src/data/solutions.json | src/game-data/solutions.json | 45关参考答案 | 45关参考答案 | 按固定游戏数据归类，内容不变 |

未改路径但做必要适配：engine/index.ts/types.ts/levels.ts/facilityRegistry.ts/solver.ts/placementValidation.ts/placementHints.ts、main.tsx；author-levels.mjs的读写路径改为game-data，check-engine-preservation.ts为本轮等价检查入口；现有测试只改导入、只读夹具构建和边界断言，保留原业务期望。README和字体说明只同步实际路径。完整最终源码职责见 [文件职责清单](phase2-file-inventory.md)，目录与五张图见 [架构文档](../ARCHITECTURE.md)。

## C. API与调用清理

- 核心Session、规则、Solver、蓝图/WG1 API名称及命令语义保持；Engine出口改为显式列举必要函数/类型，不导出内部MutableData或冲突编译细节。
- 第一阶段混入Engine的模式/协议导出迁至对应game-modes和save-system模块；所有仓内调用同步迁移，不保留旧路径包装。核心API保持与“模式/协议API路径迁移”分别记录，不能视为Engine所有旧导出完全不变。
- generateSurvival(difficulty,seed,id,recent?)现在在survivalChallenge中选择难度规格；Engine.generateMap接收同一规格并执行原算法。奖励/解锁/替换只在模式层。原survivalGenerationTimeout收敛到公开MAP_GENERATION_TIMEOUT=25000；无第二个超时实现。
- 几何只有boardGeometry一份；正式约束只有placementRules一份；Solver使用同一约束编译位集合并复核完整解。
- useGameSession统一提交place/remove/rotate/terrain/clear/undo/redo；UI不再暴露可写快照类型、不读写localStorage或new Worker。恢复仍走createSession，不绕过对局API。
- 80步历史共用MAX_HISTORY_STEPS，求生Codec使用同一上限；存档字段和截取顺序保留。
- 模式存档不再经Engine公共出口转发，存储适配器移除域类型重复转发；AdventureSave取代模糊Save类型名。
- 设施、难度、图标、字典、教学和插画固定表规范化；为保持既有核心查询API，levels/solutions/facilities等公开数据名保留，不新增大写/小写双出口。

## D. 删除、合并与保留依据

| 分类 | 实际处理与可核实依据 |
|---|---|
| 真正删除的无用组件 | LevelArtwork.tsx仅return JournalLevelSceneArt，无状态/事件/样式；两个产品消费者及测试直接调用实际组件；全src静态/动态导入、脚本/Worker URL核查未发现额外入口，97组SSR输出完全相同 |
| 真正删除的无用导出/表 | facilityRegistry派生查找表在src/tests/scripts无消费者；保留真正使用的facilities/facilityLibrary/name/tips；无命名空间动态读取该表 |
| 合并的实现与入口 | survivalFingerprint归到Engine内部mapFingerprint；原别名/无消费者公开出口移除。Worker生命周期在同一文件共享，两种真实任务使用，计算仍在原Engine |
| 删除的冗余转发 | 原storage/localMaps/survival适配器的域类型re-export、Engine内模式/存档聚集出口；调用者直接使用所有者模块，不建立兼容层 |
| 已移除旧路径 | 上述迁移表中的旧src/game、hooks、components、i18n、data及迁出Engine的文件；这是迁移，非删除玩法/资源 |
| 疑似冗余但保留 | 动态CSS覆盖/旧选择器、历史维护脚本和发布恢复产物：缺少安全删除证据，不删除 |
| 必须保留的历史/资源 | .desktop-smoke维护/恢复脚本、release安装包/备份、reports/day31测试夹具、设计截图、字体/图标/许可证、server和部署脚本 |
| 本轮临时文件 | 根目录.phase2-*辅助脚本/快照及本轮隔离参考目录在交付前删除；测试证据保存在reports，不删除任何既有历史目录 |

没有执行服务端、数据库、设备身份、安装恢复、部署或历史备份的删除/运行操作。部署脚本只按引用核查，未修改。

## E. 实际目录与文档

[ARCHITECTURE.md](../ARCHITECTURE.md)含完整主要目录树、模块负责/不负责/公开API/依赖/调用者、五张Mermaid图、全部公共Engine API参数/结果、状态所有权与中文术语。 [文件职责清单](phase2-file-inventory.md)逐个列出最终源码和导出；第一阶段reports/engine-*保留历史，不伪装成最终目录。

## F. 验证、既有失败与风险

| 检查 | 实际结果 |
|---|---|
| 修改前npm test | 66项：62通过、4失败；[原始日志](phase2-baseline-tests.txt) |
| 修改后npm test | 68项：64通过、4个同名既有失败；新增2项Worker测试通过；[原始日志](phase2-final-tests.txt) |
| TypeScript + Vite | npm run build通过；两个Worker正常打包，原大于500kB chunk提示保留 |
| 正式规则/Session/模式/存档/教学 | 全量测试对应项目通过；本地地图3个既有期望漂移单列如下 |
| 分层、循环和只读 | 全src导入/动态导入/require/Worker URL/层级依赖检查通过；嵌套只读契约经tsc验证；最终针对性复查见JSON |
| 45关前后等价 | 完整Solver输出/解顺序/统计、779次规则判定、45个WG1代码均与修改前一致 |
| 唯一解 | npm run levels:check的16–45关30/30通过；对全部45关另外复查，12/14/15在修改前即有多个解，保留现状，其余42关唯一 |
| 插画保全 | 45关场景、44组设施/形状/方向、3种地形、3个章节、2种标题入场状态共97组SSR标记逐字节一致；非浏览器截图验证 |
| CSS/数据/资源/平台保全 | 文本按LF归一比较、二进制按原字节比较；仅字体CSS相对路径调整，其余样式定义不变；关卡、答案、原生/服务端和资源无内容变化，详见JSON |
| Electron quality-ui | 原测试在进入JavaScript断言前原生退出，exit=-2147483645，日志无诊断；不声称UI交互/截图通过，不修改原断言来掩盖失败 |
| 未验证 | Windows安装/升级/实际音频剪贴板与设备身份、Android Gradle/APK/真机、真实ID网络服务、完整浏览器交互/像素布局 |

四个既有失败名称与解释：

1. corrupt entries are ignored while saving keeps valid maps and uses the newest list：旧测试期待过滤损坏地图后覆盖保存，现有写前防覆盖策略拒绝；保持保护。
2. map deletion and renaming surface storage failures without changing the saved maps：期望正则“无法读取本地地图”，现有文案“本地地图无法读取”；不改错误文案或放宽测试。
3. storage failures surface a Chinese error and do not report a successful save：同一既有错误词序差异。
4. ten seeded tiers generate legal unique 8×8 puzzles, including twenty facilities：最高难度seed=2在原预算内未找到合适唯一解地图，前后均超时；不改变难度、唯一解条件或生成预算。既有day31低/中/高生成用例通过。

只读契约是TypeScript边界，不是运行时深冻结；交给Session的输入不得通过旧可写别名继续修改。没有新增运行时复制成本。没有新增未解决的规则/构建/存档失败。未执行Git reset/clean/commit/push，所有实际改动留在工作区供审查。
