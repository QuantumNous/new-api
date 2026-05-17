package model

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
)

type RequestDetail struct {
	Id              int    `json:"id" gorm:"primaryKey"`
	RequestId       string `json:"request_id" gorm:"index;size:64"`
	UserId          int    `json:"user_id" gorm:"index"`
	CreatedAt       int64  `json:"created_at" gorm:"bigint;index:idx_request_detail_created_at"`
	RequestHeaders  string `json:"request_headers,omitempty" gorm:"type:text"`
	RequestBody     string `json:"request_body,omitempty" gorm:"type:text"`
	ResponseHeaders string `json:"response_headers,omitempty" gorm:"type:text"`
	ResponseBody    string `json:"response_body,omitempty" gorm:"type:text"`
}

type RequestDetailSummary struct {
	Id        int    `json:"id"`
	RequestId string `json:"request_id"`
	UserId    int    `json:"user_id"`
	CreatedAt int64  `json:"created_at"`
}

func RecordRequestDetail(requestId string, userId int, reqHeaders, reqBody, respHeaders, respBody string) {
	detail := &RequestDetail{
		RequestId:       requestId,
		UserId:          userId,
		CreatedAt:       time.Now().Unix(),
		RequestHeaders:  reqHeaders,
		RequestBody:     reqBody,
		ResponseHeaders: respHeaders,
		ResponseBody:    respBody,
	}
	result := LOG_DB.Create(detail)
	if result.Error != nil {
		common.SysError(fmt.Sprintf("failed to record request detail: %s", result.Error.Error()))
	}
}

func GetAllRequestDetails(requestId string, userId int, startTimestamp, endTimestamp int64, startIdx, pageSize int) ([]RequestDetailSummary, int64, error) {
	var total int64
	var details []RequestDetailSummary

	tx := LOG_DB.Model(&RequestDetail{})
	if requestId != "" {
		tx = tx.Where("request_id = ?", requestId)
	}
	if userId > 0 {
		tx = tx.Where("user_id = ?", userId)
	}
	if startTimestamp > 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp > 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}

	err := tx.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}
	err = tx.Select("id, request_id, user_id, created_at").Order("id desc").Offset(startIdx).Limit(pageSize).Find(&details).Error
	return details, total, err
}

func GetUserRequestDetails(userId int, requestId string, startTimestamp, endTimestamp int64, startIdx, pageSize int) ([]RequestDetailSummary, int64, error) {
	var total int64
	var details []RequestDetailSummary

	tx := LOG_DB.Model(&RequestDetail{}).Where("user_id = ?", userId)
	if requestId != "" {
		tx = tx.Where("request_id = ?", requestId)
	}
	if startTimestamp > 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp > 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}

	err := tx.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}
	err = tx.Select("id, request_id, user_id, created_at").Order("id desc").Offset(startIdx).Limit(pageSize).Find(&details).Error
	return details, total, err
}

func GetRequestDetailById(id int) (*RequestDetail, error) {
	var detail RequestDetail
	err := LOG_DB.First(&detail, id).Error
	return &detail, err
}

func GetUserRequestDetailById(userId, id int) (*RequestDetail, error) {
	var detail RequestDetail
	err := LOG_DB.Where("user_id = ?", userId).First(&detail, id).Error
	return &detail, err
}

func DeleteOldRequestDetail(targetTimestamp int64) (int64, error) {
	result := LOG_DB.Where("created_at < ?", targetTimestamp).Delete(&RequestDetail{})
	return result.RowsAffected, result.Error
}

func marshalHeaders(headers map[string][]string) string {
	data, err := common.Marshal(headers)
	if err != nil {
		return "{}"
	}
	return string(data)
}

func MarshalHeaders(headers map[string][]string) string {
	return marshalHeaders(headers)
}
