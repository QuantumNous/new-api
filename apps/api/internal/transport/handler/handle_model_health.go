package handler

import (
	channelpkg "github.com/QuantumNous/new-api/internal/catalog"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/transport/contract"
)

// GetChannelModelHealth lists the persisted unit health state. Without a
// channel_id it returns every row, which is the system-wide view; with one it
// returns that channel's per-model matrix. Rows are shaped as the admin view
// (state label, remaining cooldown, last cooling outcome) — mono's
// gateway_health.rs.
func GetChannelModelHealth(c contract.Context) {
	channelID := 0
	if raw := c.Query("channel_id"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 0 {
			common.ApiErrorMsg(c, "无效的渠道 ID")
			return
		}
		channelID = parsed
	}

	views, err := channelpkg.ListUnitHealth(channelID)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, common.H{
		"success": true,
		"data":    views,
	})
}

type channelModelHealthActionRequest struct {
	ChannelId int    `json:"channel_id"`
	KeyIndex  int    `json:"key_index"`
	Model     string `json:"model"`
}

// UpdateChannelModelHealth disables, recovers, or force-recalls one route
// unit. A disable is the explicit persisted hard-disable (automatic health
// recovery never clears it); a recover re-enables the key/channel the probe
// cascade auto-disabled, restores the model's ability row, then clears the
// hard-disable and arms slow start; a force recall settles a live cooldown
// right now without waiting out the window.
func UpdateChannelModelHealth(c contract.Context) {
	var req channelModelHealthActionRequest
	if err := c.BindJSON(&req); err != nil || req.ChannelId <= 0 || req.Model == "" {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	action := c.Param("action")
	key := channelpkg.RouteKey{ChannelId: req.ChannelId, KeyIndex: req.KeyIndex, Model: req.Model}
	now := time.Now()

	var err error
	switch action {
	case "disable":
		err = channelpkg.DisableUnit(key, now)
	case "recover":
		err = channelpkg.RecoverUnit(key, now)
	case "force_recall":
		err = channelpkg.ForceRecallUnit(key, now)
	default:
		common.ApiErrorMsg(c, "未知操作")
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, common.H{
		"success": true,
		"message": "",
	})
}
