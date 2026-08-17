package controller

import (
	"net/http"
	"sort"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

// modelStatusProbe is the alive check for one enabled model, derived from the
// scheduled channel tests (monitor_setting) that already run in the background.
type modelStatusProbe struct {
	Checked   bool  `json:"checked"`
	Alive     bool  `json:"alive"`
	TestTime  int64 `json:"test_time,omitempty"`
	LatencyMs int64 `json:"latency_ms,omitempty"`
}

// modelStatusEntry is one model's live status for the model square.
type modelStatusEntry struct {
	Name         string           `json:"name"`
	RequestCount int64            `json:"request_count"`
	SuccessRate  *float64         `json:"success_rate"`
	AvgLatencyMs int64            `json:"avg_latency_ms,omitempty"`
	Probe        modelStatusProbe `json:"probe"`
}

type modelProbeAggregate struct {
	channels   int
	tested     int
	alive      bool
	lastTest   int64
	latencySum int64
}

func (a *modelProbeAggregate) add(channel *model.Channel) {
	a.channels++
	if channel.TestTime <= 0 {
		return
	}
	a.tested++
	if channel.TestTime > a.lastTest {
		a.lastTest = channel.TestTime
	}
	if channel.Status == common.ChannelStatusEnabled {
		a.alive = true
		if channel.ResponseTime > 0 {
			a.latencySum += int64(channel.ResponseTime)
		}
	}
}

func (a *modelProbeAggregate) toProbe() modelStatusProbe {
	probe := modelStatusProbe{
		Checked:  a.tested > 0,
		Alive:    a.alive,
		TestTime: a.lastTest,
	}
	if probe.Checked && a.alive && a.tested > 0 {
		probe.LatencyMs = a.latencySum / int64(a.tested)
	}
	return probe
}

// GetModelStatus returns per-model success rate and average latency (from
// perf metrics of real traffic) plus alive/dead status (from scheduled
// channel tests) for every currently enabled model. Public endpoint
// backing the model square status strip.
func GetModelStatus(c *gin.Context) {
	modelNames := model.GetEnabledModels()

	channels, err := model.GetAllChannels(0, 0, true, false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	probes := map[string]*modelProbeAggregate{}
	for _, channel := range channels {
		if channel == nil {
			continue
		}
		for _, name := range strings.Split(channel.Models, ",") {
			name = strings.TrimSpace(name)
			if name == "" {
				continue
			}
			agg, ok := probes[name]
			if !ok {
				agg = &modelProbeAggregate{}
				probes[name] = agg
			}
			agg.add(channel)
		}
	}

	summaries := map[string]perfmetrics.ModelSummary{}
	activeGroups := append(lo.Keys(ratio_setting.GetGroupRatioCopy()), "auto")
	if summary, err := perfmetrics.QuerySummaryAll(24, activeGroups); err == nil {
		for _, m := range summary.Models {
			summaries[m.ModelName] = m
		}
	} else {
		common.SysError("failed to query perf metrics summary for model status: " + err.Error())
	}

	entries := make([]modelStatusEntry, 0, len(modelNames))
	for _, name := range modelNames {
		entry := modelStatusEntry{
			Name: name,
		}
		if summary, ok := summaries[name]; ok {
			rate := summary.SuccessRate
			entry.SuccessRate = &rate
			entry.RequestCount = summary.RequestCount
			entry.AvgLatencyMs = summary.AvgLatencyMs
		}
		if agg, ok := probes[name]; ok {
			entry.Probe = agg.toProbe()
		}
		entries = append(entries, entry)
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].Name < entries[j].Name })

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"models": entries,
		},
	})
}
