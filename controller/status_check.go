package controller

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/status_check_setting"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

// ------------------- GET /api/status-check -------------------

// groupHealthResponse mirrors what fuzzy.vg's /api/status-check returns so the
// /status page can render announcement + per-group cards + per-model rows.
type modelHealthDTO struct {
	ModelName       string  `json:"model"`
	Group           string  `json:"group"`
	Availability    float64 `json:"availability"`
	LatencyMs       int64   `json:"latency_ms"`
	Level           string  `json:"level"`
	ChannelId       int     `json:"channel_id,omitempty"`
	Ok              bool    `json:"ok"`
	ErrorCode       int     `json:"error_code,omitempty"`
	ErrorMsg        string  `json:"error_msg,omitempty"`
	HasActive       bool    `json:"has_active"`
	PassiveRequests int64   `json:"passive_requests,omitempty"`
	PassiveSuccess  int64   `json:"passive_success,omitempty"`
}

type groupHealthDTO struct {
	Group        string           `json:"group"`
	Availability float64          `json:"availability"`
	AvgLatencyMs int64            `json:"avg_latency_ms"`
	TotalProbes  int              `json:"total_probes"`
	OkProbes     int              `json:"ok_probes"`
	Level        string           `json:"level"`
	Models       []modelHealthDTO `json:"models"`
}

type statusCheckResponse struct {
	Announcement string           `json:"announcement"`
	Groups       []groupHealthDTO `json:"groups"`
}

// GetStatusCheck /api/status-check — merge active probe results (group_health /
// model_health tables) with passive perf_metrics rollup into one payload.
func GetStatusCheck(c *gin.Context) {
	cfg := status_check_setting.GetSetting()
	groups := status_check_setting.GetGroups()

	intervalSec := int64(status_check_setting.GetIntervalMinutes() * 60)
	since := time.Now().Unix() - intervalSec*2 // last 2 cycles

	activeGroups, err := model.GetLatestGroupHealth(groups, since)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	activeByGroup := map[string]model.GroupHealth{}
	for _, g := range activeGroups {
		activeByGroup[g.Group] = g
	}

	// passive perf_metrics rollup across the configured window
	hours := status_check_setting.GetPassiveWindowHours()
	endTs := time.Now().Unix()
	startTs := endTs - int64(hours)*3600
	passiveSummary, err := model.GetPerfMetricsSummaryByGroup(startTs, endTs, groups)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// keyed by group|model
	passive := map[string]model.PerfMetricSummaryByGroup{}
	for _, s := range passiveSummary {
		passive[s.Group+"|"+s.ModelName] = s
	}

	excluded := status_check_setting.GetExcludedModelsMap()

	out := statusCheckResponse{Announcement: cfg.Announcement, Groups: []groupHealthDTO{}}
	for _, group := range groups {
		dto := groupHealthDTO{Group: group, Models: []modelHealthDTO{}}

		// models in this group come from active probe rows; if no active row yet,
		// fall back to passive perf_metrics models for this group.
		modelRows, err := model.GetLatestModelHealth(group, since)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		seen := map[string]bool{}
		for _, m := range modelRows {
			if excluded != nil {
				if _, skip := excluded[m.ModelName]; skip {
					continue
				}
			}
			seen[m.ModelName] = true
			dto.Models = append(dto.Models, mergeHealthRow(m, passive, group))
		}
		// passive-only models (no active probe yet) — cold start fallback
		for _, s := range passiveSummary {
			if s.Group != group {
				continue
			}
			if seen[s.ModelName] {
				continue
			}
			if excluded != nil {
				if _, skip := excluded[s.ModelName]; skip {
					continue
				}
			}
			dto.Models = append(dto.Models, passiveOnlyRow(s, group))
		}

		// group-level roll-up
		if active, ok := activeByGroup[group]; ok && active.TotalProbes > 0 {
			dto.TotalProbes = active.TotalProbes
			dto.OkProbes = active.OkProbes
			dto.AvgLatencyMs = active.AvgLatencyMs
			activeAvail := active.Availability
			// passive weighted into availability
			passiveAvail := passiveGroupAvailability(passive, group)
			dto.Availability = mergeAvailability(activeAvail, passiveAvail, true, passiveAvail >= 0)
		} else {
			// no active probe, fall back to all-passive
			passiveAvail := passiveGroupAvailability(passive, group)
			dto.Availability = passiveAvail
			if dto.Availability < 0 {
				dto.Availability = 100 // unknown → optimistic
			}
		}
		dto.Level = GradeAvailability(dto.Availability)

		out.Groups = append(out.Groups, dto)
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": out})
}

// mergeHealthRow builds a per-model DTO combining active probe + passive rollup.
func mergeHealthRow(m model.ModelHealth, passive map[string]model.PerfMetricSummaryByGroup, group string) modelHealthDTO {
	dto := modelHealthDTO{
		ModelName: m.ModelName,
		Group:     group,
		LatencyMs: m.LatencyMs,
		ChannelId: m.ChannelId,
		Ok:        m.Ok,
		ErrorCode: m.ErrorCode,
		ErrorMsg:  m.ErrorMsg,
		HasActive: true,
	}
	activeAvail := 0.0
	if m.Ok {
		activeAvail = 100
	}
	var passiveAvail float64 = -1
	if p, ok := passive[group+"|"+m.ModelName]; ok {
		dto.PassiveRequests = p.RequestCount
		dto.PassiveSuccess = p.SuccessCount
		if p.RequestCount > 0 {
			passiveAvail = float64(p.SuccessCount) / float64(p.RequestCount) * 100
		}
	}
	dto.Availability = mergeAvailability(activeAvail, passiveAvail, true, passiveAvail >= 0)
	dto.Level = GradeAvailability(dto.Availability)
	return dto
}

func passiveOnlyRow(s model.PerfMetricSummaryByGroup, group string) modelHealthDTO {
	avail := 100.0
	if s.RequestCount > 0 {
		avail = float64(s.SuccessCount) / float64(s.RequestCount) * 100
	}
	return modelHealthDTO{
		ModelName:       s.ModelName,
		Group:           group,
		Availability:    avail,
		Level:           GradeAvailability(avail),
		Ok:              avail >= 70,
		PassiveRequests: s.RequestCount,
		PassiveSuccess:  s.SuccessCount,
	}
}

// mergeAvailability 50/50 if both sides present; 100% on whichever exists.
// activeAvail/0, passiveAvail: NaN/或 -1 when absent.
func mergeAvailability(activeAvail, passiveAvail float64, hasActive, hasPassive bool) float64 {
	if hasActive && hasPassive {
		return (activeAvail + passiveAvail) / 2
	}
	if hasActive {
		return activeAvail
	}
	if hasPassive {
		return passiveAvail
	}
	return 100 // unknown optimistic
}

func passiveGroupAvailability(passive map[string]model.PerfMetricSummaryByGroup, group string) float64 {
	totalReq, totalSucc := int64(0), int64(0)
	for _, p := range passive {
		if !strings.EqualFold(p.Group, group) {
			continue
		}
		totalReq += p.RequestCount
		totalSucc += p.SuccessCount
	}
	if totalReq == 0 {
		return -1
	}
	return float64(totalSucc) / float64(totalReq) * 100
}

// GradeAvailability thresholds mirrored from web/src/features/performance-metrics/lib/format.ts
func GradeAvailability(pct float64) string {
	switch {
	case pct >= 100:
		return "excellent"
	case pct >= 90:
		return "good"
	case pct >= 70:
		return "warning"
	default:
		return "critical"
	}
}

// ------------------- scheduled probe -------------------

type groupHealthProbeHandler struct{}

func (groupHealthProbeHandler) Type() string    { return model.SystemTaskTypeGroupHealthProbe }
func (groupHealthProbeHandler) Enabled() bool   { return status_check_setting.GetSetting().Enabled }
func (groupHealthProbeHandler) NewPayload() any { return nil }

func (groupHealthProbeHandler) Interval() time.Duration {
	minutes := status_check_setting.GetIntervalMinutes()
	return time.Duration(minutes) * time.Minute
}

// channelTestUnsupportedTypes mirrors controller/channel-test.go unsupportedTestChannelTypes
// shared with the channel_test flow; keep in sync.
var channelTestUnsupportedTypes = []int{
	constant.ChannelTypeMidjourney,
	constant.ChannelTypeMidjourneyPlus,
	constant.ChannelTypeSunoAPI,
	constant.ChannelTypeKling,
	constant.ChannelTypeJimeng,
	constant.ChannelTypeDoubaoVideo,
	constant.ChannelTypeVidu,
}

// Run executes one probe cycle. For every configured group, iterate channels
// that carry that group and call testChannel directly (NOT performChannelTests),
// so the auto-disable path is bypassed. Write results into model_health and roll
// the group aggregate up into group_health.
func (groupHealthProbeHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	summary, err := runGroupHealthProbe(ctx, service.NewSystemTaskProgressReporter(task, runnerID))
	if err != nil {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, nil, err)
		return
	}
	finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusSucceeded, summary, nil)
}

type groupHealthProbeSummary struct {
	Groups   int `json:"groups"`
	Channels int `json:"channels"`
	Tested   int `json:"tested"`
	Ok       int `json:"ok"`
	Failed   int `json:"failed"`
}

func runGroupHealthProbe(ctx context.Context, report func(processed, total int)) (*groupHealthProbeSummary, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	groups := status_check_setting.GetGroups()
	excluded := status_check_setting.GetExcludedModelsMap()

	channels, err := model.GetAllChannels(0, 0, true, false)
	if err != nil {
		return nil, err
	}

	testUserID, err := resolveChannelTestUserID(nil)
	if err != nil {
		return nil, err
	}

	probeTs := time.Now().Unix()
	intervalSec := int64(status_check_setting.GetIntervalMinutes() * 60)

	summary := &groupHealthProbeSummary{Groups: len(groups)}
	totalUnits := 0
	channelGroups := make(map[int][]string, len(channels))
	for _, ch := range channels {
		if ch.Status == common.ChannelStatusManuallyDisabled {
			continue
		}
		if lo.Contains(channelTestUnsupportedTypes, ch.Type) {
			continue
		}
		chGroups := ch.GetGroups()
		relevant := lo.Filter(chGroups, func(g string, _ int) bool {
			return lo.Contains(groups, g)
		})
		if len(relevant) == 0 {
			continue
		}
		channelGroups[ch.Id] = relevant
		totalUnits += len(ch.GetModels())
	}
	summary.Channels = len(channelGroups)

	processed := 0
	type groupAcc struct {
		total  int
		ok     int
		latSum int64
	}
	acc := make(map[string]*groupAcc, len(groups))
	for _, g := range groups {
		acc[g] = &groupAcc{}
	}

	for _, ch := range channels {
		if ctx.Err() != nil {
			break
		}
		relevant, ok := channelGroups[ch.Id]
		if !ok {
			continue
		}
		models := ch.GetModels()
		for _, modelName := range models {
			if excluded != nil {
				if _, skip := excluded[modelName]; skip {
					continue
				}
			}
			processed++
			if report != nil {
				report(processed, totalUnits)
			}
			tik := time.Now()
			result := testChannel(ctx, ch, testUserID, modelName, "", false)
			latMs := time.Since(tik).Milliseconds()

			ok := result.localErr == nil && result.newAPIError == nil
			errCode := 0
			errMsg := ""
			if result.newAPIError != nil {
				errCode = result.newAPIError.StatusCode
			}
			if result.localErr != nil {
				errMsg = result.localErr.Error()
			}
			if result.newAPIError != nil && result.newAPIError.Err != nil && errMsg == "" {
				errMsg = result.newAPIError.Err.Error()
			}

			// One live probe per (channel, model); fan the same outcome out
			// to every configured group that owns this channel.
			for _, g := range relevant {
				mh := model.ModelHealth{
					ModelName: modelName,
					Group:     g,
					ProbeTs:   probeTs,
					LatencyMs: latMs,
					Ok:        ok,
					ErrorCode: errCode,
					ErrorMsg:  errMsg,
					ChannelId: ch.Id,
				}
				if err := model.UpsertModelHealth(&mh); err != nil {
					common.SysLog(fmt.Sprintf("group_health_probe: upsert model_health failed: group=%s model=%s err=%v", g, modelName, err))
				}
				accG := acc[g]
				accG.total++
				accG.latSum += latMs
				if ok {
					accG.ok++
				}
			}
			summary.Tested++
			if ok {
				summary.Ok++
			} else {
				summary.Failed++
			}
			if common.RequestInterval > 0 {
				select {
				case <-ctx.Done():
					return summary, nil
				case <-time.After(common.RequestInterval):
				}
			}
		}
	}

	// roll up group_health
	for _, g := range groups {
		a := acc[g]
		if a.total == 0 {
			continue // skip group with no probes
		}
		avail := float64(a.ok) / float64(a.total) * 100
		gh := model.GroupHealth{
			Group:        g,
			ProbeTs:      probeTs,
			Availability: avail,
			AvgLatencyMs: a.latSum / int64(a.total),
			TotalProbes:  a.total,
			OkProbes:     a.ok,
			FailedProbes: a.total - a.ok,
		}
		if err := model.UpsertGroupHealth(&gh); err != nil {
			common.SysError(fmt.Sprintf("group_health_probe: upsert group_health failed: group=%s err=%v", g, err))
		}
	}

	// prune stale rows older than ~10 cycles so the tables stay trim
	retentionCutoff := probeTs - intervalSec*10
	if err := model.DeleteHealthBefore(retentionCutoff, retentionCutoff); err != nil {
		common.SysError(fmt.Sprintf("group_health_probe: prune failed: %v", err))
	}

	return summary, nil
}
