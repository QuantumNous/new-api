<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-05-18 -->

# billingexpr

## Purpose
**在修改此目录任何文件之前，必须先阅读 [`expr.md`](./expr.md)（Rule 7）。**

基于表达式语言的动态计费引擎。一条表达式字符串完整定义一个模型的计费规则——输入/输出 token 定价、缓存分级、图片/音频差异化、时间折扣、上下文长度分级——均由单一表达式驱动，无隐式规则。

`expr.md` 是本子系统的权威文档，记录了：设计哲学、表达式语法（变量、内置函数）、token 自动排除机制、系统架构（编辑→存储→预消费→结算→日志展示）、配额换算公式、版本机制。**代码变更必须与该文档保持一致。**

## Key Files
| File | Description |
|------|-------------|
| **`expr.md`** | **最重要的入口文档**（Rule 7）。完整描述表达式语言、变量体系、内置函数、token 归一化、配额换算、版本控制等所有设计细节。修改代码前必读 |
| `types.go` | 核心类型：`TokenParams`（所有 token 维度）、`BillingSnapshot`（预消费时冻结的计费快照）、`TieredResult`（结算结果）、`TraceResult`（tier 函数副作用捕获）、`ExprHashString` |
| `compile.go` | 表达式编译与缓存：将表达式字符串编译为可执行程序，内置 AST introspection 推断 token 自动排除集合 |
| `run.go` | 表达式运行时求值：构造求值环境（变量绑定、内置函数注入），执行编译后程序，返回 cost |
| `settle.go` | 结算逻辑：对比预消费快照与真实 token 数，计算实际扣费配额，处理跨 tier 场景 |
| `round.go` | 配额四舍五入与精度处理工具函数 |
| `billingexpr_test.go` | 表达式引擎集成测试，覆盖各种定价场景 |

## For AI Agents

### Working In This Directory
- **Rule 7 强制**：任何修改前必须阅读 `expr.md`，确保改动符合文档描述的设计哲学和架构约束。
- 表达式变量（`p`、`c`、`len`、`cr`、`cc`、`cc1h`、`img`、`img_o`、`ai`、`ao`）的语义和自动排除机制在 `expr.md` 中有详细说明，修改时严格遵循。
- `BillingSnapshot` 是预消费阶段序列化保存的状态，字段变更需考虑向后兼容性（已存储的快照需能正常反序列化）。
- `compile.go` 的 AST introspection 负责推断哪些 token 子类别被单独定价，从而决定 `p`/`c` 的自动排除范围——这是整个引擎的核心机制，修改须谨慎。
- 表达式版本（`v1:` 前缀）控制编译环境和 token 归一化逻辑，新增版本时需在 `compile.go` 注册对应编译环境。
- **Rule 1**：涉及序列化时使用 `common.Marshal`/`common.Unmarshal`。

### Testing Requirements
- `billingexpr_test.go` 包含完整的端到端场景测试，修改 `compile.go`、`run.go`、`settle.go` 后必须运行。
- 运行命令：`go test ./pkg/billingexpr/...`
- 新增表达式功能时，必须在测试文件中补充对应场景的测试用例。

### Common Patterns
- 预消费：调用 `compile` + `run` 得到估算 cost，序列化为 `BillingSnapshot` 存入日志。
- 结算：从日志取出 `BillingSnapshot`，调用 `settle` 传入真实 token 数，得到 `TieredResult`。
- `tier()` 函数通过 `TraceResult` 副作用捕获当前匹配的定价档位名称，供日志展示。

## Dependencies

### Internal
- `common` — JSON 工具、日志

### External
- `github.com/expr-lang/expr` — 表达式编译与求值引擎
- `github.com/tidwall/gjson` — `param()` 内置函数的 JSON path 读取

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
