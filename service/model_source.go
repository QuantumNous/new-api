package service

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
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
// HF Model Local Deployment
// ============================================================

const (
	HFModelStorageDir = "data/models/huggingface"
)

// DeployHFModel 将 HF Hub 模型"注册"到本地记录表中。
// 实际权重文件拉取由外部 vLLM / llama.cpp 等推理引擎在启动时完成，
// 此处只做元数据登记 + 状态追踪。
func DeployHFModel(sourceId int, req *dto.HFModelDeployRequest) (*model.HuggingFaceModel, error) {
	src, err := model.GetModelSourceById(sourceId)
	if err != nil {
		return nil, fmt.Errorf("model source not found: %w", err)
	}

	repoId := strings.TrimSpace(req.RepoId)
	if repoId == "" {
		return nil, fmt.Errorf("repo_id is required")
	}

	// 检查是否已存在
	existing, _ := model.GetHuggingFaceModelByRepoId(sourceId, repoId)
	if existing != nil {
		if existing.DeploymentStatus == "running" {
			return existing, fmt.Errorf("model %s is already deployed and running", repoId)
		}
		// 重新部署：更新状态
		existing.DeploymentStatus = "idle"
		existing.StatusMessage = "pending deployment"
		existing.SourceId = sourceId
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
	localPath := filepath.Join(HFModelStorageDir, strings.ReplaceAll(repoId, "/", "_"))
	m := &model.HuggingFaceModel{
		SourceId:         sourceId,
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
	if m.Port == 0 {
		m.Port = findFreePort()
	}
	if err := model.SaveHuggingFaceModel(m); err != nil {
		return nil, err
	}

	common.SysLog(fmt.Sprintf("[HF] Registered model %s (source=%d, port=%d)", repoId, sourceId, m.Port))
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
func GetAllHFModels() ([]dto.HFModelResponse, error) {
	models, err := model.GetAllHuggingFaceModels()
	if err != nil {
		return nil, err
	}
	sourceMap := make(map[int]string)
	sources, srcErr := model.GetAllModelSources()
	if srcErr == nil {
		for _, s := range sources {
			sourceMap[s.Id] = s.Label
		}
	}

	result := make([]dto.HFModelResponse, 0, len(models))
	for _, m := range models {
		result = append(result, dto.HFModelResponse{
			Id:               m.Id,
			SourceId:         m.SourceId,
			SourceLabel:      sourceMap[m.SourceId],
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
		})
	}
	return result, nil
}

// GetHFModelDetail 获取单个模型详情
func GetHFModelDetail(id int) (*dto.HFModelResponse, error) {
	m, err := model.GetHuggingFaceModelById(id)
	if err != nil {
		return nil, err
	}
	label := ""
	src, srcErr := model.GetModelSourceById(m.SourceId)
	if srcErr == nil {
		label = src.Label
	}
	return &dto.HFModelResponse{
		Id:               m.Id,
		SourceId:         m.SourceId,
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
	}, nil
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

// EnsureHFModelStorageDir 确保模型存储目录存在
func EnsureHFModelStorageDir() error {
	return os.MkdirAll(HFModelStorageDir, 0755)
}

// InitHuggingFace 启动时初始化 HF 相关目录
func InitHuggingFace() {
	if err := EnsureHFModelStorageDir(); err != nil {
		common.SysLog(fmt.Sprintf("[HF] failed to create storage dir: %v", err))
	}
	common.SysLog("[HF] model storage dir: " + HFModelStorageDir)
}
