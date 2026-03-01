package controller

import (
	"strings"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/go-fuego/fuego"
)

func GetChannelAffinityCacheStats(c fuego.ContextNoBody) (*dto.Response[service.ChannelAffinityCacheStats], error) {
	stats := service.GetChannelAffinityCacheStats()
	return dto.Ok(stats)
}

func ClearChannelAffinityCache(c fuego.ContextWithParams[dto.ClearChannelAffinityCacheParams]) (*dto.Response[dto.AffinityCacheClearData], error) {
	p, _ := dto.ParseParams[dto.ClearChannelAffinityCacheParams](c)
	all := strings.TrimSpace(p.All)
	ruleName := strings.TrimSpace(p.RuleName)

	if all == "true" {
		deleted := service.ClearChannelAffinityCacheAll()
		return dto.Ok(dto.AffinityCacheClearData{Deleted: deleted})
	}

	if ruleName == "" {
		return dto.Fail[dto.AffinityCacheClearData]("缺少参数：rule_name，或使用 all=true 清空全部")
	}

	deleted, err := service.ClearChannelAffinityCacheByRuleName(ruleName)
	if err != nil {
		return dto.Fail[dto.AffinityCacheClearData](err.Error())
	}

	return dto.Ok(dto.AffinityCacheClearData{Deleted: deleted})
}

func GetChannelAffinityUsageCacheStats(c fuego.ContextWithParams[dto.GetChannelAffinityUsageCacheStatsParams]) (*dto.Response[service.ChannelAffinityUsageCacheStats], error) {
	p, _ := dto.ParseParams[dto.GetChannelAffinityUsageCacheStatsParams](c)
	ruleName := strings.TrimSpace(p.RuleName)
	usingGroup := strings.TrimSpace(p.UsingGroup)
	keyFp := strings.TrimSpace(p.KeyFp)

	if ruleName == "" {
		return dto.Fail[service.ChannelAffinityUsageCacheStats]("missing param: rule_name")
	}
	if keyFp == "" {
		return dto.Fail[service.ChannelAffinityUsageCacheStats]("missing param: key_fp")
	}

	stats := service.GetChannelAffinityUsageCacheStats(ruleName, usingGroup, keyFp)
	return dto.Ok(stats)
}
