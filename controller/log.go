package controller

import (
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/go-fuego/fuego"
)

func GetAllLogs(c fuego.ContextWithParams[dto.GetAllLogsParams]) (*dto.Response[dto.PageData[*model.Log]], error) {
	pageInfo := dto.PageInfo(c)
	p, _ := dto.ParseParams[dto.GetAllLogsParams](c)
	logs, total, err := model.GetAllLogs(p.Type, p.StartTimestamp, p.EndTimestamp, p.ModelName, p.Username, p.TokenName, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), p.Channel, p.Group, p.RequestID)
	if err != nil {
		return dto.FailPage[*model.Log](err.Error())
	}
	return dto.OkPage(pageInfo, logs, int(total))
}

func GetUserLogs(c fuego.ContextWithParams[dto.GetUserLogsParams]) (*dto.Response[dto.PageData[*model.Log]], error) {
	pageInfo := dto.PageInfo(c)
	userId := dto.UserID(c)
	p, _ := dto.ParseParams[dto.GetUserLogsParams](c)
	logs, total, err := model.GetUserLogs(userId, p.Type, p.StartTimestamp, p.EndTimestamp, p.ModelName, p.TokenName, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), p.Group, p.RequestID)
	if err != nil {
		return dto.FailPage[*model.Log](err.Error())
	}
	return dto.OkPage(pageInfo, logs, int(total))
}

// Deprecated: SearchAllLogs 已废弃，前端未使用该接口。
func SearchAllLogs(c fuego.ContextNoBody) (dto.MessageResponse, error) {
	return dto.FailMsg("该接口已废弃")
}

// Deprecated: SearchUserLogs 已废弃，前端未使用该接口。
func SearchUserLogs(c fuego.ContextNoBody) (dto.MessageResponse, error) {
	return dto.FailMsg("该接口已废弃")
}

func GetLogByKey(c fuego.ContextNoBody) (*dto.Response[[]*model.Log], error) {
	tokenId := dto.TokenID(c)
	if tokenId == 0 {
		return dto.Fail[[]*model.Log]("无效的令牌")
	}
	logs, err := model.GetLogByTokenId(tokenId)
	if err != nil {
		return dto.Fail[[]*model.Log](err.Error())
	}
	return dto.Ok(logs)
}

func GetLogsStat(c fuego.ContextWithParams[dto.LogStatParams]) (*dto.Response[dto.LogStatData], error) {
	p, _ := dto.ParseParams[dto.LogStatParams](c)
	stat, err := model.SumUsedQuota(p.Type, p.StartTimestamp, p.EndTimestamp, p.ModelName, p.Username, p.TokenName, p.Channel, p.Group)
	if err != nil {
		return dto.Fail[dto.LogStatData](err.Error())
	}
	return dto.Ok(dto.LogStatData{
		Quota: int64(stat.Quota),
		RPM:   stat.Rpm,
		TPM:   stat.Tpm,
	})
}

func GetLogsSelfStat(c fuego.ContextWithParams[dto.LogSelfStatParams]) (*dto.Response[dto.LogStatData], error) {
	username := dto.GinCtx(c).GetString("username")
	p, _ := dto.ParseParams[dto.LogSelfStatParams](c)
	quotaNum, err := model.SumUsedQuota(p.Type, p.StartTimestamp, p.EndTimestamp, p.ModelName, username, p.TokenName, p.Channel, p.Group)
	if err != nil {
		return dto.Fail[dto.LogStatData](err.Error())
	}
	return dto.Ok(dto.LogStatData{
		Quota: int64(quotaNum.Quota),
		RPM:   quotaNum.Rpm,
		TPM:   quotaNum.Tpm,
	})
}

func DeleteHistoryLogs(c fuego.ContextWithParams[dto.DeleteHistoryLogsParams]) (*dto.Response[int64], error) {
	p, _ := dto.ParseParams[dto.DeleteHistoryLogsParams](c)
	if p.TargetTimestamp == 0 {
		return dto.Fail[int64]("target timestamp is required")
	}
	count, err := model.DeleteOldLog(c.Request().Context(), p.TargetTimestamp, 100)
	if err != nil {
		return dto.Fail[int64](err.Error())
	}
	return dto.Ok(count)
}
