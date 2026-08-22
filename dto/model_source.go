package dto

// ============================================================
// ModelSource DTOs
// ============================================================

// HuggingFaceCredential HF 平台的凭据结构（加密存入 ModelSource.Config）
type HuggingFaceCredential struct {
	// API Key (read token 即可拉取公开模型，write token 可推私有模型)
	APIKey string `json:"api_key"`
	// 可选：用户名（私有模型需要）
	Username string `json:"username,omitempty"`
}

// ModelScopeCredential 魔搭社区凭据
type ModelScopeCredential struct {
	// 魔搭 API Token，在 https://modelscope.cn/my/myaccesstoken 生成
	AccessToken string `json:"access_token"`
}

// PaddleHubCredential 飞桨 PaddleHub 凭据
type PaddleHubCredential struct {
	// PaddleHub 的 Access Token
	AccessToken string `json:"access_token,omitempty"`
	// 可选：AK/SK（部分接口需要）
	AccessKey string `json:"access_key,omitempty"`
	SecretKey string `json:"secret_key,omitempty"`
}

// ModelersCredential 魔乐 Modelers 凭据
type ModelersCredential struct {
	// Modelers 平台 Access Token
	AccessToken string `json:"access_token"`
}

// OpenICredential OpenI 启智凭据
type OpenICredential struct {
	// OpenI 平台 Access Token
	AccessToken string `json:"access_token"`
}

// MoArkCredential 模力方舟凭据
type MoArkCredential struct {
	// 模力方舟平台 Access Token
	AccessToken string `json:"access_token"`
}

// ============================================================
// API Request / Response DTOs
// ============================================================

// ModelSourceCreateRequest 创建/更新平台凭据的请求
type ModelSourceCreateRequest struct {
	SourceType string `json:"source_type" binding:"required,oneof=huggingface modelscope paddlehub modelers openi moark"`
	Label      string `json:"label" binding:"required,min=1,max=128"`
	// Credential 字段（由各平台填充，根据 source_type 选择对应结构）
	HuggingFaceCredential *HuggingFaceCredential `json:"huggingface_credential,omitempty"`
	ModelScopeCredential  *ModelScopeCredential  `json:"modelscope_credential,omitempty"`
	PaddleHubCredential   *PaddleHubCredential   `json:"paddlehub_credential,omitempty"`
	ModelersCredential    *ModelersCredential    `json:"modelers_credential,omitempty"`
	OpenICredential       *OpenICredential       `json:"openi_credential,omitempty"`
	MoArkCredential       *MoArkCredential       `json:"moark_credential,omitempty"`
	Enabled   *bool   `json:"enabled"`
	Remark    string  `json:"remark"`
}

// ModelSourceResponse 平台凭据列表响应（不返回明文凭据）
type ModelSourceResponse struct {
	Id         int    `json:"id"`
	SourceType string `json:"source_type"`
	Label      string `json:"label"`
	Enabled    bool   `json:"enabled"`
	Remark     string `json:"remark,omitempty"`
	HasCredential bool `json:"has_credential"` // 是否已配置凭据
	CreatedAt  int64  `json:"created_at"`
	UpdatedAt  int64  `json:"updated_at"`
}

// ModelSourceDetailResponse 平台凭据详情（含脱敏后的凭据状态）
type ModelSourceDetailResponse struct {
	Id         int    `json:"id"`
	SourceType string `json:"source_type"`
	Label      string `json:"label"`
	Enabled    bool   `json:"enabled"`
	Remark     string `json:"remark,omitempty"`
	HasCredential bool `json:"has_credential"`
	ConfigJSON string `json:"config_json,omitempty"` // 完整 JSON（仅管理员可见）
	CreatedAt  int64  `json:"created_at"`
	UpdatedAt  int64  `json:"updated_at"`
}

// ============================================================
// HuggingFace Model DTOs
// ============================================================

// HFModelSearchRequest 从 HF Hub 搜索/拉取模型列表
type HFModelSearchRequest struct {
	SourceId    int    `json:"source_id" binding:"required"`
	Query       string `json:"query,omitempty"`       // 搜索关键词
	Task        string `json:"task,omitempty"`        // 按任务过滤：text-generation / text2text-generation 等
	Author      string `json:"author,omitempty"`      // 作者过滤
	Limit       int    `json:"limit,omitempty"`       // 返回数量，默认 20
	Offset      int    `json:"offset,omitempty"`      // 分页偏移
}

// HFHubModelInfo HF Hub API 返回的单条模型信息
type HFHubModelInfo struct {
	Id        string `json:"id"`        // repo_id
	SHA       string `json:"sha"`       // commit sha
	CardData  string `json:"card_data"` // README 内容（JSON 字符串）
	Tags      []string `json:"tags"`
	Gated     bool   `json:"gated"`
	Private   bool   `json:"private"`
	Likes     int    `json:"likes"`
	Downloads int    `json:"downloads"`
}

// HFHubModelSearchResponse HF Hub 搜索接口响应
type HFHubModelSearchResponse struct {
	Models []HFHubModelInfo `json:"models"`
	Total  int               `json:"total"`
}

// HFModelDeployRequest 部署（拉取 + 本地启用）模型请求
type HFModelDeployRequest struct {
	SourceId int    `json:"source_id" binding:"required"`
	RepoId   string `json:"repo_id" binding:"required"`
	FileName  string `json:"file_name,omitempty"` // 权重文件名，空=自动推断
	Task      string `json:"task,omitempty"`      // 推理任务
	Port      int    `json:"port,omitempty"`      // 指定端口，0=自动分配
	GpuIds    string `json:"gpu_ids,omitempty"`   // GPU ID 列表
	MaxConcurrency int `json:"max_concurrency,omitempty"` // 最大并发
}

// HFModelDeployResponse 部署响应
type HFModelDeployResponse struct {
	ModelId   int    `json:"model_id"`
	RepoId    string `json:"repo_id"`
	Status    string `json:"status"` // pulling / deploying / idle
	Message   string `json:"message"`
}

// HFModelToggleRequest 启用/关闭请求
type HFModelToggleRequest struct {
	Enabled *bool `json:"enabled"`
}

// HFModelResponse 模型列表响应（不含敏感字段）
type HFModelResponse struct {
	Id              int    `json:"id"`
	SourceId        int    `json:"source_id"`
	SourceLabel     string `json:"source_label,omitempty"`
	RepoId          string `json:"repo_id"`
	FileName        string `json:"file_name,omitempty"`
	Task            string `json:"task,omitempty"`
	LocalPath       string `json:"local_path,omitempty"`
	DeploymentStatus string `json:"deployment_status"`
	StatusMessage   string `json:"status_message,omitempty"`
	ErrorDetail     string `json:"error_detail,omitempty"`
	Port            int    `json:"port"`
	GpuIds          string `json:"gpu_ids,omitempty"`
	MaxConcurrency  int    `json:"max_concurrency"`
	Enabled         bool   `json:"enabled"`
	SizeBytes       int64  `json:"size_bytes,omitempty"`
	Sha256          string `json:"sha256,omitempty"`
	CreatedAt       int64  `json:"created_at"`
	UpdatedAt       int64  `json:"updated_at"`
}
