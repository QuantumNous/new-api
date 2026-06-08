<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-06-08 -->

# ionet

## Purpose
IO.NET CaaS（Container as a Service）API 客户端封装，提供云 GPU 容器的部署管理能力：创建/查询/更新/删除部署、列出容器与日志、查询硬件信息与可用性、价格估算等。通过 `HTTPClient` 接口解耦底层 HTTP 实现，便于测试与替换。

## Key Files
| File | Description |
|------|-------------|
| `types.go` | 所有请求/响应 DTO：`DeploymentRequest`、`DeploymentResponse`、`DeploymentDetail`、`Container`、`HardwareType`、`Location`、`PriceEstimationRequest`、`PriceEstimationResponse`、`ContainerLogs`、`APIError` 等 20+ 类型 |
| `client.go` | `DefaultHTTPClient` 实现：封装 `net/http.Client`，实现 `HTTPClient` 接口的 `Do` 方法；包含 `DefaultBaseURL`、`DefaultEnterpriseBaseURL`、`DefaultTimeout` 常量 |
| `container.go` | 容器相关 API 方法（列出容器、查询容器详情、获取日志等） |
| `deployment.go` | 部署相关 API 方法（创建、查询、更新、删除、延长时长等） |
| `hardware.go` | 硬件查询 API 方法（列出硬件类型、查询可用性、价格估算等） |
| `jsonutil.go` | 包内 JSON 工具函数 |

## For AI Agents

### Working In This Directory
- **Rule 1**：`jsonutil.go` 及所有序列化调用应使用 `common.Marshal`/`common.Unmarshal`，不直接调用 `encoding/json`（注意 `client.go` 已存在直接引用，修改时注意统一）。
- `HTTPClient` 接口设计允许在测试中注入 mock 实现，新增 API 方法时应通过 `Client` 结构体的方法组织，而非独立函数。
- 企业版和标准版使用不同的 `BaseURL`（`DefaultEnterpriseBaseURL` vs `DefaultBaseURL`），初始化 `Client` 时注意区分。
- `APIError` 实现了 `error` 接口，API 方法返回错误时统一使用此类型。

### Testing Requirements
- 此包目前无独立测试文件。
- 新增方法时建议使用 `HTTPClient` mock 编写单元测试。
- 运行命令：`go test ./pkg/ionet/...`

### Common Patterns
```go
// 客户端初始化
client := &ionet.Client{
    BaseURL:    ionet.DefaultBaseURL,
    APIKey:     apiKey,
    HTTPClient: ionet.NewDefaultHTTPClient(ionet.DefaultTimeout),
}
```

## Dependencies

### Internal
- `common` — JSON 工具（应通过 `jsonutil.go` 统一封装）

### External
- `net/http` — 标准 HTTP 客户端
- `encoding/json` — JSON 序列化（内部使用，应逐步迁移至 `common.*`）

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
