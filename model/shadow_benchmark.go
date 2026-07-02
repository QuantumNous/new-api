package model

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type ShadowBenchmarkLog struct {
	Id                    int    `json:"id" gorm:"primaryKey"`
	CreatedAt             int64  `json:"created_at" gorm:"bigint;index"`
	RequestId             string `json:"request_id" gorm:"type:varchar(64);uniqueIndex;not null"`
	ExperimentName        string `json:"experiment_name" gorm:"type:varchar(128);index"`
	ModelName             string `json:"model_name" gorm:"index"`
	RequestPath           string `json:"request_path" gorm:"type:varchar(255);index"`
	ClientType            string `json:"client_type" gorm:"type:varchar(64);index"`
	RelayFormat           string `json:"relay_format" gorm:"type:varchar(64)"`
	IsStream              bool   `json:"is_stream"`
	BodySize              int64  `json:"body_size"`
	BodyHash              string `json:"body_hash" gorm:"type:varchar(64);index"`
	MainSuccess           bool   `json:"main_success" gorm:"index"`
	MainStatusCode        int    `json:"main_status_code" gorm:"index"`
	MainErrorCode         string `json:"main_error_code" gorm:"index"`
	MainTTFTMs            int64  `json:"main_ttft_ms"`
	MainTotalMs           int64  `json:"main_total_ms"`
	MainUseChannel        string `json:"main_use_channel" gorm:"type:text"`
	MainFinalChannelId    int    `json:"main_final_channel_id" gorm:"index"`
	MainFinalChannelName  string `json:"main_final_channel_name"`
	TargetName            string `json:"target_name" gorm:"type:varchar(64);index"`
	TargetChannelId       int    `json:"target_channel_id" gorm:"index"`
	TargetChannelName     string `json:"target_channel_name"`
	TargetStatus          string `json:"target_status" gorm:"type:varchar(32);index"`
	TargetHTTPStatus      int    `json:"target_http_status" gorm:"index"`
	TargetErrorCode       string `json:"target_error_code" gorm:"index"`
	TargetErrorMessage    string `json:"target_error_message" gorm:"type:text"`
	TargetTTFTMs          int64  `json:"target_ttft_ms"`
	TargetTotalMs         int64  `json:"target_total_ms"`
	TargetResponseBytes   int64  `json:"target_response_bytes"`
	TargetFirstChunkBytes int64  `json:"target_first_chunk_bytes"`
}

func (ShadowBenchmarkLog) TableName() string {
	return "shadow_benchmark_logs"
}

func SaveShadowBenchmarkLog(log *ShadowBenchmarkLog) error {
	if log == nil {
		return nil
	}
	log.RequestId = strings.TrimSpace(log.RequestId)
	if log.RequestId == "" {
		return nil
	}
	if log.CreatedAt == 0 {
		log.CreatedAt = common.GetTimestamp()
	}
	return DB.Where("request_id = ?", log.RequestId).
		Assign(log).
		FirstOrCreate(log).Error
}

func CountShadowBenchmarkLogsByModel(experimentName string, modelName string) (int64, error) {
	var count int64
	err := DB.Model(&ShadowBenchmarkLog{}).
		Where("experiment_name = ? and model_name = ?", experimentName, modelName).
		Count(&count).Error
	return count, err
}

func CountShadowBenchmarkLogsByModels(experimentName string, modelNames []string) (map[string]int64, error) {
	rows := make([]struct {
		ModelName string
		Count     int64
	}, 0, len(modelNames))
	err := DB.Model(&ShadowBenchmarkLog{}).
		Select("model_name, count(*) as count").
		Where("experiment_name = ? and model_name IN ?", experimentName, modelNames).
		Group("model_name").
		Scan(&rows).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		return nil, err
	}
	result := make(map[string]int64, len(modelNames))
	for _, row := range rows {
		result[row.ModelName] = row.Count
	}
	return result, nil
}
