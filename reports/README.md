# 历史报告索引

本目录保存过去的审计、固定样本、失败和构建来源。报告中的“当前”、测试数量、性能和路径描述均受报告日期/提交/环境限制，不是新的执行指令或当前通过结论。

日常入口为[项目 README](../README.md)、[开发指南](../docs/DEVELOPMENT.md)和[测试说明](../tests/README.md)；Steam 稳定流程见[发布指南](../scripts/steam/README.md)，当前分支/验收只看[发布状态](../scripts/steam/RELEASE_STATUS.md)。

| 记录 | 保留价值 |
| --- | --- |
| [仓库审计](repository-audit.md) / [审计修复](audit-fixes.md) | 缺陷依据、修复和历史基线取舍 |
| [生成器重构](generator-refactor.md) / [原根目录重构记录](generator-rework-history.md) | 不同轮次的失败、硬约束、样本与回归来源 |
| [第三轮生成器修复](generator-round3.md) | 活动区域、预算与配对数据 |
| [地形优化](terrain-optimization.md) | 地形约束、有限样本与配图 |
| [生成器性能](generator-performance.md) | 多轮性能对比、失败实验和保留的优化 |
| [Steam 构建验收快照](steam-platform-sync.md) | 已上传候选的源哈希、成品哈希和实际本地验证 |
| [本次文档整理](documentation-cleanup.md) | 删除前候选、引用、替代项、保留清单和实际验证 |

相关 JSON/PNG、`tests/fixtures/` 以及被引用的 `.desktop-smoke/` 原始诊断继续保留。历史报告内单文件测试路径随目录整理修正时，不改变当时的结果数据，也不表示重新运行了这些测试。
