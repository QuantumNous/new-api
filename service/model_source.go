package service

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

// ============================================================
// ModelSource CRUD
// ============================================================

// CreateModelSource 创建新的平台凭据记录
func CreateModelSource(req *dto.ModelSourceCreateRequest) (*model.ModelSource, error) {
	// 序列化凭据
	var credJSON string
	switch req.SourceType {
	case model.SourceTypeHuggingFace:
		if req.HuggingFaceCredential == nil || req.HuggingFaceCredential.APIKey == "" {
			return nil, fmt.Errorf("huggingface credential is required")
		}
		b, _ := json.Marshal(req.HuggingFaceCredential)
		credJSON = string(b)
	case model.SourceTypeModelScope:
		if req.ModelScopeCredential == nil || req.ModelScopeCredential.AccessToken == "" {
			return nil, fmt.Errorf("modelscope credential is required")
		}
		b, _ := json.Marshal(req.ModelScopeCredential)
		credJSON = string(b)
	case model.SourceTypePaddleHub:
		if req.PaddleHubCredential == nil || (req.PaddleHubCredential.AccessToken == "" && req.PaddleHubCredential.AccessKey == "") {
			return nil, fmt.Errorf("paddlehub credential is required")
		}
		b, _ := json.Marshal(req.PaddleHubCredential)
		credJSON = string(b)
	case model.SourceTypeModelers:
		if req.ModelersCredential == nil || req.ModelersCredential.AccessToken == "" {
			return nil, fmt.Errorf("modelers credential is required")
		}
		b, _ := json.Marshal(req.ModelersCredential)
		credJSON = string(b)
	case model.SourceTypeOpenI:
		if req.OpenICredential == nil || req.OpenICredential.AccessToken == "" {
			return nil, fmt.Errorf("openi credential is required")
		}
		b, _ := json.Marshal(req.OpenICredential)
		credJSON = string(b)
	case model.SourceTypeMoArk:
		if req.MoArkCredential == nil || req.MoArkCredential.AccessToken == "" {
			return nil, fmt.Errorf("moark credential is required")
		}
		b, _ := json.Marshal(req.MoArkCredential)
		credJSON = string(b)
	default:
		return nil, fmt.Errorf("unsupported source type: %s", req.SourceType)
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	ms := &model.ModelSource{
		SourceType: req.SourceType,
		Label:      req.Label,
		Config:     credJSON,
		Enabled:    enabled,
		Remark:     req.Remark,
	}
	if err := model.DB.Create(ms).Error; err != nil {
		return nil, err
	}
	return ms, nil
}

// GetAllModelSources 列出所有平台配置（脱敏）
func GetAllModelSources() ([]dto.ModelSourceResponse, error) {
	sources, err := model.GetAllModelSources()
	if err != nil {
		return nil, err
	}
	result := make([]dto.ModelSourceResponse, 0, len(sources))
	for _, s := range sources {
		result = append(result, dto.ModelSourceResponse{
			Id:            s.Id,
			SourceType:    s.SourceType,
			Label:         s.Label,
			Enabled:       s.Enabled,
			Remark:        s.Remark,
			HasCredential: strings.TrimSpace(s.Config) != "",
			CreatedAt:     s.CreatedAt,
			UpdatedAt:     s.UpdatedAt,
		})
	}
	return result, nil
}

// GetModelSourceDetail 获取单个配置详情（含凭据明文，仅管理员接口）
func GetModelSourceDetail(id int) (*dto.ModelSourceDetailResponse, error) {
	src, err := model.GetModelSourceById(id)
	if err != nil {
		return nil, err
	}
	hasCred := strings.TrimSpace(src.Config) != ""
	return &dto.ModelSourceDetailResponse{
		Id:            src.Id,
		SourceType:    src.SourceType,
		Label:         src.Label,
		Enabled:       src.Enabled,
		Remark:        src.Remark,
		HasCredential: hasCred,
		ConfigJSON:    src.Config,
		CreatedAt:     src.CreatedAt,
		UpdatedAt:     src.UpdatedAt,
	}, nil
}

// UpdateModelSource 更新平台配置
func UpdateModelSource(id int, req *dto.ModelSourceCreateRequest) error {
	src, err := model.GetModelSourceById(id)
	if err != nil {
		return err
	}

	// 如果提供了凭据，更新 Config
	if req.HuggingFaceCredential != nil && req.HuggingFaceCredential.APIKey != "" {
		b, _ := json.Marshal(req.HuggingFaceCredential)
		src.Config = string(b)
	} else if req.ModelScopeCredential != nil && req.ModelScopeCredential.AccessToken != "" {
		b, _ := json.Marshal(req.ModelScopeCredential)
		src.Config = string(b)
	} else if req.PaddleHubCredential != nil {
		b, _ := json.Marshal(req.PaddleHubCredential)
		src.Config = string(b)
	} else if req.ModelersCredential != nil && req.ModelersCredential.AccessToken != "" {
		b, _ := json.Marshal(req.ModelersCredential)
		src.Config = string(b)
	} else if req.OpenICredential != nil && req.OpenICredential.AccessToken != "" {
		b, _ := json.Marshal(req.OpenICredential)
		src.Config = string(b)
	} else if req.MoArkCredential != nil && req.MoArkCredential.AccessToken != "" {
		b, _ := json.Marshal(req.MoArkCredential)
		src.Config = string(b)
	}

	if req.Label != "" {
		src.Label = req.Label
	}
	if req.Remark != "" {
		src.Remark = req.Remark
	}
	if req.Enabled != nil {
		src.Enabled = *req.Enabled
	}

	return model.DB.Save(src).Error
}

// DeleteModelSource 软删除平台配置
func DeleteModelSource(id int) error {
	now := time.Now().Unix()
	return model.DB.Model(&model.ModelSource{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"deleted_at": now,
			"enabled":    false,
		}).Error
}

// ============================================================
// HuggingFace Model Search
// ============================================================

// SearchHFHubModels 调用 HF Hub API 搜索公开模型。
// 仅用 HTTP GET，不依赖任何第三方 SDK，保持零依赖。
func SearchHFHubModels(sourceId int, req *dto.HFModelSearchRequest) (*dto.HFHubModelSearchResponse, error) {
	src, err := model.GetModelSourceById(sourceId)
	if err != nil {
		return nil, fmt.Errorf("model source not found: %w", err)
	}
	var cred dto.HuggingFaceCredential
	if err := src.DecodeConfig(&cred); err != nil {
		return nil, fmt.Errorf("invalid source config: %w", err)
	}

	// Build HF Hub search URL
	// https://huggingface.co/api/models?search=xxx&author=xxx&limit=20
	baseURL := "https://huggingface.co/api/models"
	params := []string{}
	if strings.TrimSpace(req.Query) != "" {
		params = append(params, "search="+strings.TrimSpace(req.Query))
	}
	if strings.TrimSpace(req.Author) != "" {
		params = append(params, "author="+strings.TrimSpace(req.Author))
	}
	if req.Limit <= 0 {
		req.Limit = 20
	}
	if req.Limit > 100 {
		req.Limit = 100
	}
	params = append(params, fmt.Sprintf("limit=%d", req.Limit))
	if req.Offset > 0 {
		params = append(params, fmt.Sprintf("offset=%d", req.Offset))
	}

	url := baseURL
	if len(params) > 0 {
		url += "?" + strings.Join(params, "&")
	}

	httpReq, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Authorization", "Bearer "+cred.APIKey)
	httpReq.Header.Set("User-Agent", "New-API-HuggingFace-Client/1.0")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("HF Hub request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("HF Hub returned %d: %s", resp.StatusCode, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	// HF Hub returns a raw JSON array
	var hfModels []dto.HFHubModelInfo
	if err := json.Unmarshal(body, &hfModels); err != nil {
		return nil, fmt.Errorf("failed to parse HF Hub response: %w", err)
	}

	return &dto.HFHubModelSearchResponse{
		Models: hfModels,
		Total:  len(hfModels),
	}, nil
}

// ============================================================
// Generic Hub Search Dispatch
// ============================================================

// SearchHubModels 是六平台 Hub 搜索的统一入口。sourceType 决定调用哪个平台的实现。
func SearchHubModels(sourceId int, sourceType string, req *dto.HFModelSearchRequest) (*dto.HFHubModelSearchResponse, error) {
	switch sourceType {
	case model.SourceTypeHuggingFace:
		return SearchHFHubModels(sourceId, req)
	case model.SourceTypeModelScope:
		return SearchModelScopeHubModels(sourceId, req)
	case model.SourceTypePaddleHub:
		return SearchPaddleHubModels(sourceId, req)
	case model.SourceTypeModelers:
		return SearchModelersHubModels(sourceId, req)
	case model.SourceTypeOpenI:
		return SearchOpenIHubModels(sourceId, req)
	case model.SourceTypeMoArk:
		return SearchMoArkHubModels(sourceId, req)
	default:
		return nil, fmt.Errorf("unsupported source type for hub search: %s", sourceType)
	}
}

// ============================================================
// ModelScope (魔搭社区) Hub Search
// ============================================================

// SearchModelScopeHubModels 调用魔搭社区 API 搜索公开模型。
// 魔搭公开模型列表接口返回 PascalCase 字段，此处做归一化映射到 HFHubModelInfo。
func SearchModelScopeHubModels(sourceId int, req *dto.HFModelSearchRequest) (*dto.HFHubModelSearchResponse, error) {
	if _, err := model.GetModelSourceById(sourceId); err != nil {
		return nil, fmt.Errorf("model source not found: %w", err)
	}

	baseURL := "https://modelscope.cn/api/v1/models"
	params := []string{}
	if strings.TrimSpace(req.Query) != "" {
		params = append(params, "search="+url.QueryEscape(strings.TrimSpace(req.Query)))
	}
	limit := req.Limit
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	params = append(params, fmt.Sprintf("page_size=%d", limit))
	if req.Offset > 0 {
		params = append(params, fmt.Sprintf("page=%d", (req.Offset/limit)+1))
	}

	url := baseURL
	if len(params) > 0 {
		url += "?" + strings.Join(params, "&")
	}

	httpReq, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("User-Agent", "New-API-ModelScope-Client/1.0")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("ModelScope request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ModelScope returned %d: %s", resp.StatusCode, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	// 魔搭返回 PascalCase 字段数组
	var raw []struct {
		Id        string   `json:"Id"`
		Name      string   `json:"Name"`
		Task      string   `json:"Task"`
		Tags      []string `json:"Tags"`
		Downloads int      `json:"Downloads"`
		Likes     int      `json:"Likes"`
		Private   bool     `json:"Private"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("failed to parse ModelScope response: %w", err)
	}

	models := make([]dto.HFHubModelInfo, 0, len(raw))
	for _, m := range raw {
		repoId := m.Id
		if repoId == "" {
			repoId = m.Name
		}
		models = append(models, dto.HFHubModelInfo{
			Id:        repoId,
			Tags:      m.Tags,
			Downloads: m.Downloads,
			Likes:     m.Likes,
			Private:   m.Private,
		})
	}

	return &dto.HFHubModelSearchResponse{Models: models, Total: len(models)}, nil
}

// ============================================================
// 其余四平台 Hub Search（骨架，待平台公开 API 明确后接入）
// ============================================================

// SearchPaddleHubModels 飞桨 PaddleHub 模型搜索。
// PaddleHub 模型中心暂未提供稳定的公开列表 API，当前返回明确错误。
func SearchPaddleHubModels(sourceId int, req *dto.HFModelSearchRequest) (*dto.HFHubModelSearchResponse, error) {
	if _, err := model.GetModelSourceById(sourceId); err != nil {
		return nil, fmt.Errorf("model source not found: %w", err)
	}
	return nil, fmt.Errorf("PaddleHub model search API is not yet integrated; please deploy models via repo_id directly")
}

// SearchModelersHubModels 魔乐 Modelers 模型搜索（待接入）。
func SearchModelersHubModels(sourceId int, req *dto.HFModelSearchRequest) (*dto.HFHubModelSearchResponse, error) {
	if _, err := model.GetModelSourceById(sourceId); err != nil {
		return nil, fmt.Errorf("model source not found: %w", err)
	}
	return nil, fmt.Errorf("Modelers model search API is not yet integrated; please deploy models via repo_id directly")
}

// SearchOpenIHubModels OpenI 启智模型搜索。
// OpenI 提供公开的仓库 API，模型列表端点仍在确认中，当前保留骨架。
func SearchOpenIHubModels(sourceId int, req *dto.HFModelSearchRequest) (*dto.HFHubModelSearchResponse, error) {
	if _, err := model.GetModelSourceById(sourceId); err != nil {
		return nil, fmt.Errorf("model source not found: %w", err)
	}
	return nil, fmt.Errorf("OpenI model search API is not yet integrated; please deploy models via repo_id directly")
}

// SearchMoArkHubModels 模力方舟 MoArk 模型搜索（待接入）。
func SearchMoArkHubModels(sourceId int, req *dto.HFModelSearchRequest) (*dto.HFHubModelSearchResponse, error) {
	if _, err := model.GetModelSourceById(sourceId); err != nil {
		return nil, fmt.Errorf("model source not found: %w", err)
	}
	return nil, fmt.Errorf("MoArk model search API is not yet integrated; please deploy models via repo_id directly")
}

// ============================================================
// Model Local Deployment (通用六平台)
// ============================================================

const (
	// ModelStorageRoot 是所有平台模型本地存储的根目录。
	ModelStorageRoot = "data/models"
)

// HFModelStorageDir 保留向后兼容，指向 HF 平台的存储目录（函数求值见 modelSourceStorageDir）。
var HFModelStorageDir = modelSourceStorageDir(model.SourceTypeHuggingFace)

// modelSourceStorageDir 返回指定平台的模型存储目录。
func modelSourceStorageDir(sourceType string) string {
	if sourceType == "" {
		sourceType = model.SourceTypeHuggingFace
	}
	return filepath.Join(ModelStorageRoot, sourceType)
}

// DeployModel 将指定平台的模型"注册"到本地记录表中（通用六平台）。
// 实际权重文件拉取由外部 vLLM / llama.cpp 等推理引擎在启动时完成，
// 此处只做元数据登记 + 状态追踪。sourceType 为空时从 ModelSource 推断。
func DeployModel(sourceType string, sourceId int, req *dto.HFModelDeployRequest) (*model.DeployedModel, error) {
	return deployModel(sourceType, sourceId, req)
}

// DeployHFModel 保留向后兼容：部署 HF 平台模型。
func DeployHFModel(sourceId int, req *dto.HFModelDeployRequest) (*model.HuggingFaceModel, error) {
	m, err := DeployModel(model.SourceTypeHuggingFace, sourceId, req)
	if err != nil {
		return nil, err
	}
	return m, nil
}

func deployModel(fallbackSourceType string, sourceId int, req *dto.HFModelDeployRequest) (*model.DeployedModel, error) {
	src, err := model.GetModelSourceById(sourceId)
	if err != nil {
		return nil, fmt.Errorf("model source not found: %w", err)
	}
	// 以 ModelSource 的 source_type 为权威；为空时回退到调用方传入值。
	sourceType := strings.ToLower(strings.TrimSpace(src.SourceType))
	if sourceType == "" {
		sourceType = strings.ToLower(strings.TrimSpace(fallbackSourceType))
	}
	if sourceType == "" {
		sourceType = model.SourceTypeHuggingFace
	}

	repoId := strings.TrimSpace(req.RepoId)
	if repoId == "" {
		return nil, fmt.Errorf("repo_id is required")
	}

	// 检查是否已存在（按 source_type + source_id + repo_id）
	existing, _ := model.GetDeployedModelByRepoId(sourceType, sourceId, repoId)
	if existing != nil {
		if existing.DeploymentStatus == "running" {
			return existing, fmt.Errorf("model %s is already deployed and running", repoId)
		}
		// 重新部署：更新状态
		existing.DeploymentStatus = "idle"
		existing.StatusMessage = "pending deployment"
		existing.SourceId = sourceId
		existing.SourceType = sourceType
		existing.RepoId = repoId
		if strings.TrimSpace(req.FileName) != "" {
			existing.FileName = req.FileName
		}
		if strings.TrimSpace(req.Task) != "" {
			existing.Task = req.Task
		}
		if req.Port > 0 {
			existing.Port = req.Port
		}
		if strings.TrimSpace(req.GpuIds) != "" {
			existing.GpuIds = req.GpuIds
		}
		if req.MaxConcurrency > 0 {
			existing.MaxConcurrency = req.MaxConcurrency
		}
		if err := model.SaveHuggingFaceModel(existing); err != nil {
			return nil, err
		}
		return existing, nil
	}

	// 新模型记录
	localPath := filepath.Join(modelSourceStorageDir(sourceType), strings.ReplaceAll(repoId, "/", "_"))
	m := &model.DeployedModel{
		SourceId:         sourceId,
		SourceType:       sourceType,
		RepoId:           repoId,
		FileName:         req.FileName,
		Task:             req.Task,
		LocalPath:        localPath,
		DeploymentStatus: "idle",
		StatusMessage:    "registered, ready for inference engine",
		Port:             req.Port,
		GpuIds:           req.GpuIds,
		MaxConcurrency:   req.MaxConcurrency,
		Enabled:          true,
	}
	if m.MaxConcurrency <= 0 {
		m.MaxConcurrency = 1
	}
	if m.Port == 0 {
		m.Port = findFreePort()
	}
	if err := model.SaveHuggingFaceModel(m); err != nil {
		return nil, err
	}

	common.SysLog(fmt.Sprintf("[%s] Registered model %s (source=%d, port=%d)", sourceType, repoId, sourceId, m.Port))
	return m, nil
}

// ============================================================
// HF Model Lifecycle
// ============================================================

// ToggleHFModel 启用/关闭模型
func ToggleHFModel(id int, enabled bool) (*model.HuggingFaceModel, error) {
	m, err := model.GetHuggingFaceModelById(id)
	if err != nil {
		return nil, err
	}
	m.Enabled = enabled
	if !enabled {
		m.DeploymentStatus = "stopped"
		m.StatusMessage = "disabled by user"
	}
	if err := model.SaveHuggingFaceModel(m); err != nil {
		return nil, err
	}
	return m, nil
}

// DeleteHFModel 删除模型记录（软删除）
func DeleteHFModel(id int) error {
	return model.DeleteHuggingFaceModel(id)
}

// GetAllHFModels 获取所有 HF 模型
// modelSourceLabelMap 构建 source_id -> label 映射。
func modelSourceLabelMap() map[int]string {
	sourceMap := make(map[int]string)
	sources, err := model.GetAllModelSources()
	if err != nil {
		return sourceMap
	}
	for _, s := range sources {
		sourceMap[s.Id] = s.Label
	}
	return sourceMap
}

// toHFModelResponse 将 DeployedModel 转换为响应 DTO。
func toHFModelResponse(m model.DeployedModel, label string) dto.HFModelResponse {
	return dto.HFModelResponse{
		Id:               m.Id,
		SourceId:         m.SourceId,
		SourceType:       m.SourceType,
		SourceLabel:      label,
		RepoId:           m.RepoId,
		FileName:         m.FileName,
		Task:             m.Task,
		LocalPath:        m.LocalPath,
		DeploymentStatus: m.DeploymentStatus,
		StatusMessage:    m.StatusMessage,
		ErrorDetail:      m.ErrorDetail,
		Port:             m.Port,
		GpuIds:           m.GpuIds,
		MaxConcurrency:   m.MaxConcurrency,
		Enabled:          m.Enabled,
		SizeBytes:        m.SizeBytes,
		Sha256:           m.Sha256,
		CreatedAt:        m.CreatedAt,
		UpdatedAt:        m.UpdatedAt,
	}
}

// GetAllDeployedModels 获取指定平台的已部署模型；sourceType 为空则返回全部。
func GetAllDeployedModels(sourceType string) ([]dto.HFModelResponse, error) {
	models, err := model.GetAllDeployedModels(sourceType)
	if err != nil {
		return nil, err
	}
	sourceMap := modelSourceLabelMap()
	result := make([]dto.HFModelResponse, 0, len(models))
	for _, m := range models {
		result = append(result, toHFModelResponse(m, sourceMap[m.SourceId]))
	}
	return result, nil
}

// GetAllHFModels 保留向后兼容：返回全部（六平台）已部署模型。
func GetAllHFModels() ([]dto.HFModelResponse, error) {
	return GetAllDeployedModels("")
}

// GetDeployedModelDetail 获取单个模型详情（带 source_type）。
func GetDeployedModelDetail(id int) (*dto.HFModelResponse, error) {
	m, err := model.GetHuggingFaceModelById(id)
	if err != nil {
		return nil, err
	}
	label := ""
	src, srcErr := model.GetModelSourceById(m.SourceId)
	if srcErr == nil {
		label = src.Label
	}
	resp := toHFModelResponse(*m, label)
	return &resp, nil
}

// GetHFModelDetail 保留向后兼容。
func GetHFModelDetail(id int) (*dto.HFModelResponse, error) {
	return GetDeployedModelDetail(id)
}

// ============================================================
// Utility
// ============================================================

// findFreePort 简单地查找一个空闲端口（1024-65535）
func findFreePort() int {
	// 这里用 0 让操作系统分配，实际使用中由推理引擎自行处理
	// 这里返回 0 表示"由引擎分配"
	return 0
}

// EnsureHFModelStorageDir 确保 HF 模型存储目录存在（兼容）。
func EnsureHFModelStorageDir() error {
	return os.MkdirAll(HFModelStorageDir, 0755)
}

// EnsureModelStorageDir 确保指定平台的模型存储目录存在。
func EnsureModelStorageDir(sourceType string) error {
	return os.MkdirAll(modelSourceStorageDir(sourceType), 0755)
}

// InitHuggingFace 启动时初始化各平台模型存储目录。
func InitHuggingFace() {
	for _, st := range model.AllSourceTypes() {
		if err := EnsureModelStorageDir(st); err != nil {
			common.SysLog(fmt.Sprintf("[model] failed to create storage dir for %s: %v", st, err))
		}
	}
	common.SysLog("[model] storage root: " + ModelStorageRoot)
}
