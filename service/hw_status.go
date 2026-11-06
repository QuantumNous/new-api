// The public status answer: the state of every own model, its availability over
// the last thirty days and the outages, in Turkish and English.
//
// The answer is built from the status samples and the incident rows only. A
// supplier name, a channel and an upstream error text never reach this answer:
// the stored reason is a class, and the visible text comes from the fixed
// catalog below.

package service

import (
	"context"
	"errors"
	"net/http"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

var (
	hwStatusJobOnce sync.Once
	// hwStatusJobInterval is the measurement period; hwStatusPurgeInterval spaces
	// the retention sweep, because the sample table only needs pruning hourly
	// while the measurement runs every minute.
	hwStatusJobInterval   = time.Minute
	hwStatusPurgeInterval = time.Hour
)

// HwStatusAnswer is the public answer of GET /api/hw/status.
type HwStatusAnswer struct {
	// CheckedAt is the moment the answer was built.
	CheckedAt int64 `json:"checked_at"`
	// AvailabilityDays is the window the availability figure covers.
	AvailabilityDays int `json:"availability_days"`
	// Overall is the estate's state: "outage" when any model is in an outage,
	// "degraded" when any model is degraded, otherwise "operational".
	Overall string `json:"overall"`
	// Models carries one entry per own model name.
	Models []HwStatusModelAnswer `json:"models"`
	// Incident is the running outage, when there is one.
	Incident *HwStatusIncidentAnswer `json:"incident,omitempty"`
	// Recent lists the most recent outages, newest first.
	Recent []HwStatusIncidentAnswer `json:"recent"`
}

// HwStatusModelAnswer is one own model in the public answer.
type HwStatusModelAnswer struct {
	Model string `json:"model"`
	// Status is "operational", "degraded" or "outage".
	Status string `json:"status"`
	// AvailabilityPercent covers the window and is rounded to two decimals. It
	// is null-shaped as 0 when there is no measurement yet.
	AvailabilityPercent float64 `json:"availability_percent"`
	MessageTR           string  `json:"message_tr"`
	MessageEN           string  `json:"message_en"`
}

// HwStatusIncidentAnswer is one outage in the public answer. Start and end are
// unix seconds; End is 0 while the outage runs.
type HwStatusIncidentAnswer struct {
	StartedAt int64  `json:"started_at"`
	EndedAt   int64  `json:"ended_at"`
	Duration  int64  `json:"duration"`
	MessageTR string `json:"message_tr"`
	MessageEN string `json:"message_en"`
}

// The three public state names.
const (
	HwStatusOperational = "operational"
	HwStatusDegraded    = "degraded"
	HwStatusOutage      = "outage"
)

// hwStatusModelText is the fixed text of one model state. No supplier, no
// channel and no error text is quoted.
func hwStatusModelText(state string) (string, string) {
	switch state {
	case HwStatusDegraded:
		return "Bazı istekler yavaş yanıt veriyor; hizmet çalışmaya devam ediyor.",
			"Some requests are answering slowly; the service keeps working."
	case HwStatusOutage:
		return "Bu modelde kesinti var; ekip üzerinde çalışıyor.",
			"There is an outage on this model; the team is working on it."
	}
	return "Tüm sistemler çalışıyor.", "All systems are operational."
}

// hwStatusIncidentText is the fixed outage text. The date is added by the
// frontend from the timestamps, so the text stays one sentence.
func hwStatusIncidentText(ended bool) (string, string) {
	if ended {
		return "Kesinti sona erdi, hizmet yeniden çalışıyor.", "The outage has ended and the service is back."
	}
	return "Kesinti sürüyor; ekip üzerinde çalışıyor.", "The outage is ongoing; the team is working on it."
}

// HwStatusNow builds the public answer for the current moment.
func HwStatusNow(now time.Time) (HwStatusAnswer, error) {
	models := HwSoldModelNames()
	snapshot, err := model.HwReadStatusSnapshot(now.Unix(), models)
	if err != nil {
		return HwStatusAnswer{}, err
	}
	return HwBuildStatusAnswer(now, snapshot), nil
}

// HwBuildStatusAnswer is the pure half of HwStatusNow, so a test can pin the
// texts and the aggregation without a database.
func HwBuildStatusAnswer(now time.Time, snapshot model.HwStatusSnapshot) HwStatusAnswer {
	answer := HwStatusAnswer{
		CheckedAt:        now.Unix(),
		AvailabilityDays: model.HwStatusAvailabilityDays,
		Overall:          HwStatusOperational,
		Models:           make([]HwStatusModelAnswer, 0, len(snapshot.Models)),
		Recent:           make([]HwStatusIncidentAnswer, 0, len(snapshot.Incidents)),
	}
	for _, state := range snapshot.Models {
		status := model.HwStatusCodeOf(state)
		textTR, textEN := hwStatusModelText(status)
		answer.Models = append(answer.Models, HwStatusModelAnswer{
			Model:               state.Model,
			Status:              status,
			AvailabilityPercent: model.HwStatusAvailabilityPercent(state),
			MessageTR:           textTR,
			MessageEN:           textEN,
		})
		switch status {
		case HwStatusOutage:
			answer.Overall = HwStatusOutage
		case HwStatusDegraded:
			if answer.Overall != HwStatusOutage {
				answer.Overall = HwStatusDegraded
			}
		}
	}
	for _, incident := range snapshot.Incidents {
		textTR, textEN := hwStatusIncidentText(incident.EndedAt > 0)
		entry := HwStatusIncidentAnswer{
			StartedAt: incident.StartedAt,
			EndedAt:   incident.EndedAt,
			Duration:  incident.Duration,
			MessageTR: textTR,
			MessageEN: textEN,
		}
		if incident.EndedAt == 0 {
			if answer.Incident == nil {
				answer.Incident = &entry
			}
			continue
		}
		answer.Recent = append(answer.Recent, entry)
	}
	return answer
}

// StartHwStatusJob starts the minute measurement on the master node only. A
// second call changes nothing; a worker node returns without starting anything.
// The credit extension of a closed outage runs in the same pass, so the shop
// stays correct even when the process restarted while an outage was running.
func StartHwStatusJob() {
	hwStatusJobOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		if probe := hwStatusProbeFromEnv(); probe != nil {
			model.SetHwStatusProbe(probe, hwStatusProbeTokenIdFromEnv())
			common.SysLog(common.LogText("status measurement probe installed: a quiet minute is decided by a mini call"))
		} else {
			common.SysLog(common.LogText("status measurement probe not configured: a quiet minute is decided by the route"))
		}
		go func() {
			common.SysLog(common.LogText("status measurement job started: interval=%s", hwStatusJobInterval))
			if removed, err := model.HwPurgeFalseIdleOutages(); err != nil {
				common.SysError(common.LogText("status false outage sweep failed: %v", err))
			} else if removed > 0 {
				common.SysLog(common.LogText("status false outage sweep removed %d outages", removed))
			}
			runHwStatusOnceSafely(time.Now())
			ticker := time.NewTicker(hwStatusJobInterval)
			defer ticker.Stop()
			ticked := 0
			purgeEvery := 0
			if hwStatusJobInterval > 0 {
				purgeEvery = int(hwStatusPurgeInterval / hwStatusJobInterval)
			}
			for at := range ticker.C {
				runHwStatusOnceSafely(at)
				ticked++
				if purgeEvery > 0 && ticked%purgeEvery == 0 {
					runHwStatusPurgeOnceSafely(at)
				}
			}
		}()
	})
}

// hwStatusProbeFromEnv builds the mini call that decides a quiet minute, from
// the measurement configuration the quality run already uses
// (HW_QUALITY_BASE_URL and HW_QUALITY_API_KEY). It returns nil when that
// configuration is missing, so an environment without a key keeps the route
// check instead of reporting a false outage.
func hwStatusProbeFromEnv() func(ctx context.Context, modelName string) model.HwStatusProbeOutcome {
	options := HwQualityRunOptionsFromEnv()
	if options.BaseURL == "" || options.APIKey == "" {
		return nil
	}
	return hwToStatusProbe(&http.Client{}, options.BaseURL, options.APIKey)
}

// hwToStatusProbe is the translation from a route answer to a probe outcome,
// kept apart from the environment so a test can pin it. Only a 200 is an
// answer; a quota or key refusal (429, 401, 403) is no evidence about the
// model, and neither is a call that is still running when the probe deadline
// passes: on 6 Nov 2026 the upstream answered every call with a 200, but a third
// of them only after 28-101 seconds, and the eight second deadline turned that
// slow but working supplier into a public outage of every model. Everything
// else (a 5xx, an empty body, a network error) means the model did not answer.
func hwToStatusProbe(client *http.Client, baseURL string, apiKey string) func(ctx context.Context, modelName string) model.HwStatusProbeOutcome {
	return func(ctx context.Context, modelName string) model.HwStatusProbeOutcome {
		_, _, err := hwCallChat(ctx, client, baseURL, apiKey, hwChatRequest{
			Model:     modelName,
			Messages:  []hwChatMessage{{Role: "user", Content: "ping"}},
			MaxTokens: 1,
		})
		switch {
		case err == nil:
			return model.HwStatusProbeAnswered
		case hwChatStatusRefused(err):
			// A quota or key refusal is no evidence about the model.
			return model.HwStatusProbeUnavailable
		case errors.Is(err, context.DeadlineExceeded):
			// Slow is not down: real customer traffic still measures the model.
			return model.HwStatusProbeUnavailable
		default:
			return model.HwStatusProbeNoAnswer
		}
	}
}

// hwStatusProbeTokenIdFromEnv looks up the token the mini call calls with, so
// the measurement can leave the probe's own rows out of the customer count.
// Without that id a failed probe would count as a customer failure. An unknown
// token yields 0, which excludes nothing: a missing id costs an outage signal,
// never a false one. Only the group and whether the token was found are logged,
// never the key.
func hwStatusProbeTokenIdFromEnv() int {
	options := HwQualityRunOptionsFromEnv()
	if options.APIKey == "" {
		return 0
	}
	token, err := model.GetTokenByKey(options.APIKey, true)
	if err != nil || token == nil || token.Id <= 0 {
		common.SysLog(common.LogText("status measurement probe token not found: probe traffic stays in the count"))
		return 0
	}
	common.SysLog(common.LogText("status measurement probe token resolved: group=%s found=true id=%d", token.Group, token.Id))
	return token.Id
}

// runHwStatusOnceSafely is one measurement pass. A panic is logged and ends the
// pass only, so a bad row cannot stop the ticker.
func runHwStatusOnceSafely(at time.Time) {
	defer func() {
		if r := recover(); r != nil {
			common.SysError(common.LogText("status measurement job panicked: %v", r))
		}
	}()
	if err := model.HwMeasureStatusOnce(at, HwSoldModelNames()); err != nil {
		common.SysError(common.LogText("status measurement job failed; the next minute retries"))
	}
	runHwIncidentCardSafely(at)
}

func runHwStatusPurgeOnceSafely(at time.Time) {
	defer func() {
		if r := recover(); r != nil {
			common.SysError(common.LogText("status retention job panicked: %v", r))
		}
	}()
	if err := model.PurgeOldStatusSamples(at.Unix()); err != nil {
		common.SysError(common.LogText("status retention job failed; the next hour retries"))
	}
}
