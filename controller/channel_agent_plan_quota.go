package controller

import (
	"context"
	"errors"
	"math"
	"os"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

const agentPlanQuotaConfigEnv = "VOLCENGINE_AGENT_PLAN_MONITOR"
const codingPlanQuotaConfigEnv = "VOLCENGINE_CODING_PLAN_MONITOR"

var agentPlanCredentialPrefix = regexp.MustCompile("^[A-Z][A-Z0-9_]{0,63}$")

type agentPlanQuotaPool struct {
	Name             string    `json:"name"`
	CredentialPrefix string    `json:"credential_prefix"`
	SeatID           string    `json:"seat_id"`
	ChannelIDs       []int     `json:"channel_ids"`
	ExpiresAt        time.Time `json:"expires_at"`
	CodingPlan       bool      `json:"-"`
}

func (pool agentPlanQuotaPool) id() string {
	if pool.CodingPlan {
		return "coding-plan:" + pool.CredentialPrefix
	}
	return pool.CredentialPrefix + ":" + pool.SeatID
}

func configuredAgentPlanPools() ([]agentPlanQuotaPool, error) {
	var pools []agentPlanQuotaPool
	for _, setting := range []struct {
		env    string
		prefix string
		coding bool
	}{
		{agentPlanQuotaConfigEnv, "VOLCENGINE_AGENT_PLAN", false},
		{codingPlanQuotaConfigEnv, "VOLCENGINE_CODING_PLAN", true},
	} {
		raw := strings.TrimSpace(os.Getenv(setting.env))
		if raw == "" {
			continue
		}
		var configured []agentPlanQuotaPool
		if err := common.UnmarshalJsonStr(raw, &configured); err != nil {
			return nil, errors.New("invalid Volcengine plan monitor configuration")
		}
		for i := range configured {
			configured[i].CodingPlan = setting.coding
			if configured[i].CredentialPrefix == "" {
				configured[i].CredentialPrefix = setting.prefix
			}
		}
		pools = append(pools, configured...)
	}
	if len(pools) > 40 {
		return nil, errors.New("invalid Volcengine plan monitor configuration")
	}
	identities := make(map[string]bool)
	channelIDs := make(map[int]bool)
	for i := range pools {
		pool := &pools[i]
		if !agentPlanCredentialPrefix.MatchString(pool.CredentialPrefix) ||
			(pool.CodingPlan && pool.SeatID != "") ||
			len(pool.SeatID) > 128 || strings.TrimSpace(pool.SeatID) != pool.SeatID ||
			len(pool.Name) > 255 || len(pool.ChannelIDs) > 100 || identities[pool.id()] {
			return nil, errors.New("invalid or duplicate Agent Plan monitor pool")
		}
		identities[pool.id()] = true
		for _, id := range pool.ChannelIDs {
			if id <= 0 || channelIDs[id] {
				return nil, errors.New("invalid or duplicate Agent Plan monitor channel")
			}
			channelIDs[id] = true
		}
	}
	return pools, nil
}

type agentPlanQuotaSnapshot struct {
	Windows       []service.AgentPlanQuotaWindow `json:"windows,omitempty"`
	LastSuccessAt int64                          `json:"last_success_at,omitempty"`
	Status        string                         `json:"status"`
}

type agentPlanQuotaHandler struct{}

func (agentPlanQuotaHandler) Type() string { return model.SystemTaskTypeAgentPlanQuota }

func (agentPlanQuotaHandler) Enabled() bool {
	pools, err := configuredAgentPlanPools()
	return err == nil && len(pools) > 0
}

func (agentPlanQuotaHandler) Interval() time.Duration { return time.Minute }
func (agentPlanQuotaHandler) NewPayload() any         { return nil }

func (agentPlanQuotaHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	pools, err := configuredAgentPlanPools()
	if err != nil || len(pools) == 0 {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, nil, err)
		return
	}
	previous, err := latestAgentPlanQuotaSnapshots()
	if err != nil {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, nil, err)
		return
	}
	ctx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()
	snapshots := syncAgentPlanQuota(ctx, pools, previous)
	finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusSucceeded, snapshots, nil)
}

func latestAgentPlanQuotaSnapshots() (map[string]agentPlanQuotaSnapshot, error) {
	task, err := model.GetLatestSystemTask(model.SystemTaskTypeAgentPlanQuota, model.SystemTaskStatusSucceeded)
	if err != nil || task == nil {
		return nil, err
	}
	var snapshots map[string]agentPlanQuotaSnapshot
	err = common.UnmarshalJsonStr(task.Result, &snapshots)
	return snapshots, err
}

func syncAgentPlanQuota(ctx context.Context, pools []agentPlanQuotaPool, previous map[string]agentPlanQuotaSnapshot) map[string]agentPlanQuotaSnapshot {
	// Personal subscriptions and enterprise seats use separate API actions.
	type batchKey struct {
		prefix string
		team   bool
		coding bool
	}
	batches := make(map[batchKey][]agentPlanQuotaPool)
	for _, pool := range pools {
		key := batchKey{pool.CredentialPrefix, pool.SeatID != "", pool.CodingPlan}
		batches[key] = append(batches[key], pool)
	}

	result := make(map[string]agentPlanQuotaSnapshot, len(pools))
	var resultMu sync.Mutex
	var work sync.WaitGroup
	concurrency := make(chan struct{}, 8)
	for batch, grouped := range batches {
		work.Go(func() {
			var seats []string
			if batch.team {
				for _, pool := range grouped {
					seats = append(seats, pool.SeatID)
				}
			}
			var windows map[string][]service.AgentPlanQuotaWindow
			status := "unavailable"
			select {
			case concurrency <- struct{}{}:
				windows, status = service.FetchVolcenginePlanQuota(ctx, os.Getenv(batch.prefix+"_AK"), os.Getenv(batch.prefix+"_SK"), batch.coding, seats)
				<-concurrency
			case <-ctx.Done():
			}
			resultMu.Lock()
			defer resultMu.Unlock()
			for _, pool := range grouped {
				snapshot := previous[pool.id()]
				snapshot.Status = status
				if status == "" {
					quota, reported := windows[pool.SeatID]
					if batch.team && !reported {
						snapshot.Status = "unavailable"
						result[pool.id()] = snapshot
						continue
					}
					snapshot.Windows = quota
					snapshot.LastSuccessAt = common.GetTimestamp()
					snapshot.Status = "ok"
					if len(snapshot.Windows) == 0 {
						snapshot.Status = "no_quota"
					}
				}
				result[pool.id()] = snapshot
			}
		})
	}
	work.Wait()
	return result
}

type agentPlanQuotaChannel struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	TodayTokens *int64 `json:"today_tokens,omitempty"`
}

type agentPlanQuotaKey struct {
	ID          string                  `json:"id"`
	Label       string                  `json:"label"`
	Channels    []agentPlanQuotaChannel `json:"channels"`
	TodayTokens *int64                  `json:"today_tokens,omitempty"`
}

type agentPlanQuotaView struct {
	agentPlanQuotaSnapshot
	ID                string              `json:"id"`
	Name              string              `json:"name,omitempty"`
	Product           string              `json:"product"`
	SeatID            string              `json:"seat_id,omitempty"`
	ExpiresAt         int64               `json:"expires_at,omitempty"`
	Keys              []agentPlanQuotaKey `json:"keys"`
	UnmatchedChannels int                 `json:"unmatched_channels,omitempty"`
}

func volcengineMonitorProduct(channel *model.Channel) string {
	if channel == nil || channel.Type != constant.ChannelTypeVolcEngine {
		return ""
	}
	switch constant.NormalizeVolcenginePlanBaseURL(strings.TrimRight(channel.GetBaseURL(), "/")) {
	case constant.VolcengineTokenPlanBaseURL:
		return "agent-plan"
	case constant.VolcengineCodingPlanPreset:
		return "coding-plan"
	default:
		return ""
	}
}

func agentPlanQuotaViews(pools []agentPlanQuotaPool, snapshots map[string]agentPlanQuotaSnapshot, channels map[int]*model.Channel, usage model.AgentPlanTokenUsage) []agentPlanQuotaView {
	views := make([]agentPlanQuotaView, 0, len(pools))
	for _, pool := range pools {
		view := agentPlanQuotaView{
			ID: pool.id(), Name: pool.Name, SeatID: pool.SeatID,
			Product:                "agent-plan",
			Keys:                   make([]agentPlanQuotaKey, 0),
			agentPlanQuotaSnapshot: snapshots[pool.id()],
		}
		if pool.CodingPlan {
			view.Product = "coding-plan"
		}
		if !pool.ExpiresAt.IsZero() {
			view.ExpiresAt = pool.ExpiresAt.Unix()
		}
		if view.Status == "" {
			view.Status = "pending"
		}
		keyIndexes := make(map[string]int)
		for _, id := range pool.ChannelIDs {
			channel := channels[id]
			if volcengineMonitorProduct(channel) != view.Product {
				view.UnmatchedChannels++
				continue
			}
			keys := channel.GetKeys()
			if !channel.ChannelInfo.IsMultiKey {
				keys = []string{channel.Key}
			}
			for position, raw := range keys {
				key := strings.TrimSpace(raw)
				if key == "" {
					continue
				}
				index, exists := keyIndexes[key]
				if !exists {
					label := "••••"
					if len(key) >= 12 {
						label += key[len(key)-4:]
					}
					index = len(view.Keys)
					keyIndexes[key] = index
					view.Keys = append(view.Keys, agentPlanQuotaKey{
						ID: strconv.Itoa(id) + ":" + strconv.Itoa(position), Label: label,
					})
					if usage != nil {
						view.Keys[index].TodayTokens = new(int64)
					}
				}
				item := &view.Keys[index]
				if !slices.ContainsFunc(item.Channels, func(candidate agentPlanQuotaChannel) bool { return candidate.ID == id }) {
					entry := agentPlanQuotaChannel{ID: id, Name: channel.Name}
					if usage != nil {
						tokens := usage[model.AgentPlanKeyRef(key)][id]
						entry.TodayTokens = &tokens
						*item.TodayTokens += min(tokens, math.MaxInt64-*item.TodayTokens)
					}
					item.Channels = append(item.Channels, entry)
				}
			}
		}
		views = append(views, view)
	}
	return views
}

func GetChannelAgentPlanQuotas(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	pools, err := configuredAgentPlanPools()
	if err != nil {
		common.ApiErrorT(c, "Invalid Volcengine plan monitor configuration")
		return
	}
	channels := make(map[int]*model.Channel)
	var ids []int
	for _, pool := range pools {
		ids = append(ids, pool.ChannelIDs...)
	}
	if len(ids) > 0 {
		rows, err := model.GetChannelsByIds(ids)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		for _, channel := range rows {
			channels[channel.Id] = channel
		}
	}
	var snapshots map[string]agentPlanQuotaSnapshot
	if len(pools) > 0 {
		snapshots, err = latestAgentPlanQuotaSnapshots()
		if err != nil {
			common.ApiError(c, err)
			return
		}
	}
	var usage model.AgentPlanTokenUsage
	if common.LogConsumeEnabled && len(channels) > 0 {
		ids = ids[:0]
		for id, channel := range channels {
			if volcengineMonitorProduct(channel) != "" {
				ids = append(ids, id)
			}
		}
		now := time.Now().In(time.FixedZone("UTC+8", 8*60*60))
		start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()
		usage, err = model.ReadAgentPlanTokenUsage(ctx, ids, start.Unix(), start.AddDate(0, 0, 1).Unix())
		if err != nil {
			common.SysError(common.LogText("failed to read Agent Plan token usage: %v", err))
		}
	}
	common.ApiSuccess(c, agentPlanQuotaViews(pools, snapshots, channels, usage))
}
