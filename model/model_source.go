package model

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// ============================================================
// ModelSource / ModelSourceConfig
// ============================================================

// ModelSource 对应六平台中的一条"平台账号/配置"。
// 每条记录代表管理员在某个平台上注册的一个凭据（API Key / Token / Cookie）。
type ModelSource struct {
	Id         int    `json:"id"`
	SourceType string `json:"source_type" gorm:"size:32;not null;uniqueIndex:uk_source_type_label,priority:1"` // huggingface / modelscope / paddlehub / modelers / openi / moark
	Label      string `json:"label" gorm:"size:128;not null;uniqueIndex:uk_source_type_label,priority:2"`      // 管理员给的显示名称，如 "我的 HF 账号"

	// Credential 加密存储平台凭据（json 序列化后存入 Config，明文不落库）
	Config    string         `json:"config,omitempty" gorm:"type:text"` // JSON: {api_key/token/cookie...}
	Enabled   bool           `json:"enabled" gorm:"default:true"`
	Remark    string         `json:"remark,omitempty" gorm:"type:varchar(255)"`
	CreatedAt int64          `json:"created_at" gorm:"autoCreateTime;column:created_at"`
	UpdatedAt int64          `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
}

func (ModelSource) TableName() string {
	return "model_sources"
}

// DecodeConfig 反序列化 Config 字段到目标结构体。
func (ms ModelSource) DecodeConfig(dst interface{}) error {
	if strings.TrimSpace(ms.Config) == "" {
		return fmt.Errorf("source config is empty for id=%d", ms.Id)
	}
	return json.Unmarshal([]byte(ms.Config), dst)
}

// SaveConfig 将结构体序列化后存入 Config 字段。
func (ms *ModelSource) SaveConfig(v interface{}) error {
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	ms.Config = string(b)
	return nil
}

// SourceType constants
const (
	SourceTypeHuggingFace = "huggingface"
	SourceTypeModelScope  = "modelscope"
	SourceTypePaddleHub   = "paddlehub"
	SourceTypeModelers    = "modelers"
	SourceTypeOpenI       = "openi"
	SourceTypeMoArk       = "moark"
)

// AllSourceTypes 返回所有支持的平台类型。
func AllSourceTypes() []string {
	return []string{
		SourceTypeHuggingFace,
		SourceTypeModelScope,
		SourceTypePaddleHub,
		SourceTypeModelers,
		SourceTypeOpenI,
		SourceTypeMoArk,
	}
}

// ============================================================
// ============================================================
// DeployedModel — 通用模型部署记录
// ============================================================

// DeployedModel 记录从任意平台（HF Hub / 魔搭 / PaddleHub / 魔乐 / OpenI / 模力方舟）
// 拉取并部署到本地推理引擎的模型。SourceType 区分平台。
type DeployedModel struct {
	Id         int    `json:"id"`
	SourceId   int    `json:"source_id" gorm:"index;not null"`     // 关联 ModelSource
	SourceType string `json:"source_type" gorm:"size:32;index;not null;default:'huggingface'"` // huggingface / modelscope / paddlehub / modelers / openi / moark
	RepoId     string `json:"repo_id" gorm:"size:256;not null"`    // 仓库/模型 ID，如 \"gpt2\" / \"Qwen/Qwen2.5-7B-Instruct\"
	FileName   string `json:"file_name" gorm:"size:512"`           // 权重文件名，如 \"pytorch_model.bin\"
	Task       string `json:"task" gorm:"size:64"`                 // 推理任务：text-generation / text2text-generation 等

	// LocalPath 本地存储路径（相对于 data/models/）
	LocalPath string `json:"local_path" gorm:"size:512"`

	// DeploymentStatus 部署状态
	DeploymentStatus string `json:"deployment_status" gorm:"size:32;default:'idle'"` // idle / pulling / deploying / running / stopped / error
	StatusMessage    string `json:"status_message,omitempty" gorm:"type:text"`
	ErrorDetail      string `json:"error_detail,omitempty" gorm:"type:text"`

	// Port 本地推理端口，0 表示未分配
	Port     int    `json:"port" gorm:"default:0"`
	GpuIds   string `json:"gpu_ids,omitempty" gorm:"size:128"` // 使用的 GPU ID 列表，逗号分隔
	MaxConcurrency int   `json:"max_concurrency" gorm:"default:1"`

	// SizeBytes / Sha256 文件信息
	SizeBytes int64 `json:"size_bytes,omitempty"`
	Sha256    string `json:"sha256,omitempty" gorm:"size:128"`

	Enabled   bool           `json:"enabled" gorm:"default:true"`
	CreatedAt int64          `json:"created_at" gorm:"autoCreateTime;column:created_at"`
	UpdatedAt int64          `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
}

// HuggingFaceModel 是 DeployedModel 的向后兼容别名（早期实现专用于 HF，
// 现已泛化为六平台通用的部署表）。
type HuggingFaceModel = DeployedModel

func (DeployedModel) TableName() string {
	return "model_deployments"
}

// IsRunnable 返回模型是否处于可运行状态。
func (m DeployedModel) IsRunnable() bool {
	return m.Enabled && m.DeploymentStatus == "running"
}

// UpdateStatus 更新部署状态并写日志。
func (m *DeployedModel) UpdateStatus(status, message string) {
	m.DeploymentStatus = status
	m.StatusMessage = message
	m.UpdatedAt = time.Now().Unix()
	if status == "error" {
		RecordLog(0, LogTypeSystem,
			fmt.Sprintf("[%s] 模型 %s 状态变更: %s — %s", m.SourceType, m.RepoId, status, message))
	}
}

// ============================================================
// Helper CRUD
// ============================================================

// GetAllModelSources 获取所有未被软删除的平台配置。
func GetAllModelSources() ([]ModelSource, error) {
	var list []ModelSource
	err := DB.Where("deleted_at IS NULL OR deleted_at = 0").Order("id DESC").Find(&list).Error
	return list, err
}

// GetModelSourceById 根据 ID 查询平台配置。
func GetModelSourceById(id int) (*ModelSource, error) {
	var ms ModelSource
	err := DB.First(&ms, id).Error
	if err != nil {
		return nil, err
	}
	if ms.DeletedAt.Valid {
		return nil, gorm.ErrRecordNotFound
	}
	return &ms, nil
}

// UpdateModelSourceConfig 更新平台配置的 Config 字段。
func UpdateModelSourceConfig(id int, config string) error {
	return DB.Model(&ModelSource{}).Where("id = ?", id).Update("config", config).Error
}

// ============================================================
// DeployedModel CRUD
// 以下方法同时提供带 SourceType 过滤的通用版本，
// 以及不带过滤的旧版（等价于 sourceType="" 查询全部）。
// ============================================================

// GetAllDeployedModels 按 sourceType 获取模型列表；sourceType 为空则返回全部。
func GetAllDeployedModels(sourceType string) ([]DeployedModel, error) {
	var list []DeployedModel
	q := DB.Order("id DESC")
	if sourceType != "" {
		q = q.Where("source_type = ?", sourceType)
	}
	err := q.Find(&list).Error
	return list, err
}

// GetAllHuggingFaceModels 保留向后兼容：获取全部（含六平台）部署模型。
func GetAllHuggingFaceModels() ([]HuggingFaceModel, error) {
	return GetAllDeployedModels("")
}

// GetHuggingFaceModelById 按 ID 查询部署模型。
func GetHuggingFaceModelById(id int) (*HuggingFaceModel, error) {
	var m HuggingFaceModel
	err := DB.First(&m, id).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// SaveHuggingFaceModel 保存（创建或更新）部署模型记录。
func SaveHuggingFaceModel(m *HuggingFaceModel) error {
	if m.Id == 0 {
		return DB.Create(m).Error
	}
	return DB.Save(m).Error
}

// GetHuggingFaceModelByRepoId 按 RepoId + SourceId 查询（唯一）。
func GetHuggingFaceModelByRepoId(sourceId int, repoId string) (*HuggingFaceModel, error) {
	var m HuggingFaceModel
	err := DB.Where("source_id = ? AND repo_id = ?", sourceId, repoId).First(&m).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// GetDeployedModelByRepoId 按 sourceType + sourceId + repoId 查询（唯一）。
func GetDeployedModelByRepoId(sourceType string, sourceId int, repoId string) (*DeployedModel, error) {
	var m DeployedModel
	err := DB.Where("source_type = ? AND source_id = ? AND repo_id = ?", sourceType, sourceId, repoId).First(&m).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// DeleteHuggingFaceModel 软删除部署模型记录。
func DeleteHuggingFaceModel(id int) error {
	now := time.Now().Unix()
	return DB.Model(&DeployedModel{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"deleted_at":        now,
			"enabled":           false,
			"deployment_status": "stopped",
			"updated_at":        now,
		}).Error
}

// GetRunningHuggingFaceModels 获取所有运行中的模型。
func GetRunningHuggingFaceModels() ([]HuggingFaceModel, error) {
	var list []HuggingFaceModel
	err := DB.Where("deployment_status = 'running' AND enabled = true").Find(&list).Error
	return list, err
}

// ============================================================
// AutoMigrate registration
// ============================================================

// InitDefaultModelSources 在数据库迁移后执行，确保至少有一条 HF 配置。
func InitDefaultModelSources() {
	if !common.RedisEnabled {
		return
	}
	var count int64
	if err := DB.Model(&ModelSource{}).Count(&count).Error; err != nil {
		common.SysLog(fmt.Sprintf("InitDefaultModelSources count error: %v", err))
		return
	}
	if count > 0 {
		return
	}
	// 插入一条示例 HF 配置（空 API Key，管理员须在管理台补充）
	_ = DB.Create(&ModelSource{
		SourceType: SourceTypeHuggingFace,
		Label:      "Hugging Face（示例）",
		Enabled:    false,
		Remark:     "请到管理台 → 模型来源 → 配置真实的 HF Token",
	}).Error
	common.SysLog("inserted default HuggingFace model source placeholder")
}
