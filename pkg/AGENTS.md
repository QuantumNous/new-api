<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-06-08 -->

# pkg

## Purpose
内部工具包集合，每个子包封装一个独立的基础设施能力，供业务层按需引用。当前包含：API 格式兼容转换（apicompat）、计费表达式引擎（billingexpr）、混合缓存（cachex）、IO.NET 云 GPU 客户端（ionet）、性能指标采集（perf_metrics）。

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `apicompat/` | OpenAI Chat Completions ↔ Responses API 双向转换层：类型定义、请求/响应转换、流式事件转换 |
| `billingexpr/` | **Rule 6 核心**：基于表达式语言的动态计费引擎，支持分级定价、多 token 维度、版本化。详见子目录 AGENTS.md 和 `expr.md` |
| `cachex/` | 混合缓存抽象层：Redis 可用时走 Redis，否则降级到 in-memory hot cache，提供命名空间隔离 |
| `ionet/` | IO.NET CaaS（Container as a Service）API 客户端，用于管理云 GPU 容器部署 |
| `perf_metrics/` | 基于原子计数器的性能指标采集：延迟、TTFT、TPS、成功率，按时间桶聚合后持久化 |

## For AI Agents

### Working In This Directory
- `pkg/` 下每个子包职责独立，修改时只需关注对应子目录。
- `billingexpr` 受 **Rule 6** 保护，修改前必须阅读 `pkg/billingexpr/expr.md`。
- 此目录本身无 Go 源文件，不需要在根级别编写代码。

### Testing Requirements
- 各子包独立测试：`go test ./pkg/...`

## Dependencies

### Internal
- 各子包按需引用 `common`、`model`、`relay/common`、`setting/` 等

### External
- 各子包依赖详见子目录 AGENTS.md

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
