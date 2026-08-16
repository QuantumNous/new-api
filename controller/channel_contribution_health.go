package controller

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

const (
	channelContributionHealthBatchSize      = 100
	channelContributionHealthWorkerCount    = 4
	channelContributionHealthRequestTimeout = 30 * time.Second
)

type channelContributionHealthHandler struct{}

type channelContributionHealthSummary struct {
	Contributions int `json:"contributions"`
	Models        int `json:"models"`
	Succeeded     int `json:"succeeded"`
	Failed        int `json:"failed"`
	Paused        int `json:"paused"`
	Deleted       int `json:"deleted"`
}

type channelContributionHealthEntry struct {
	Candidate    model.ChannelContributionHealthCandidate
	Channel      *model.Channel
	Revision     *model.ChannelContributionRevision
	Specs        []channelContributionProbeSpec
	Observations map[string]model.ChannelContributionModelObservation
}

type channelContributionHealthWork struct {
	EntryIndex int
	Channel    *model.Channel
	Group      string
	Spec       channelContributionProbeSpec
}

type channelContributionHealthWorkResult struct {
	EntryIndex  int
	Observation model.ChannelContributionModelObservation
}

func RegisterChannelContributionHealthTask() {
	service.RegisterSystemTaskHandler(channelContributionHealthHandler{})
}

func (channelContributionHealthHandler) Type() string {
	return model.SystemTaskTypeChannelContributionHealth
}

func (channelContributionHealthHandler) Enabled() bool {
	return true
}

func (channelContributionHealthHandler) Interval() time.Duration {
	minutes := operation_setting.GetChannelContributionSetting().HealthCheckIntervalMinutes
	if minutes <= 0 {
		minutes = 10
	}
	return time.Duration(minutes) * time.Minute
}

func (channelContributionHealthHandler) NewPayload() any { return nil }

func (channelContributionHealthHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	summary, err := runChannelContributionHealthTask(ctx, service.NewSystemTaskProgressReporter(task, runnerID))
	if err != nil {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, summary, err)
		return
	}
	finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusSucceeded, summary, nil)
}

func runChannelContributionHealthTask(ctx context.Context, report func(processed, total int)) (summary channelContributionHealthSummary, runErr error) {
	testUserId, err := resolveChannelTestUserID(nil)
	if err != nil {
		return summary, err
	}
	setting := operation_setting.GetChannelContributionSetting()
	deleteAfterSeconds := int64(setting.UnavailableDeleteHours) * int64(time.Hour/time.Second)
	afterContributionId := 0
	processed := 0
	cacheChanged := false
	defer func() {
		if !cacheChanged {
			return
		}
		model.InitChannelCache()
	}()

	for {
		if err := ctx.Err(); err != nil {
			return summary, err
		}
		candidates, err := model.ListContributionChannelsForHealthAfter(afterContributionId, channelContributionHealthBatchSize)
		if err != nil {
			return summary, err
		}
		if len(candidates) == 0 {
			break
		}
		afterContributionId = candidates[len(candidates)-1].ContributionId

		channelIds := make([]int, 0, len(candidates))
		revisionIds := make([]int, 0, len(candidates))
		for _, candidate := range candidates {
			channelIds = append(channelIds, candidate.ChannelId)
			revisionIds = append(revisionIds, candidate.RevisionId)
		}
		var channels []*model.Channel
		if err := model.DB.Where("id IN ?", channelIds).Find(&channels).Error; err != nil {
			return summary, err
		}
		channelById := make(map[int]*model.Channel, len(channels))
		for _, channel := range channels {
			channelById[channel.Id] = channel
		}
		var revisions []*model.ChannelContributionRevision
		if err := model.DB.Where("id IN ?", revisionIds).Find(&revisions).Error; err != nil {
			return summary, err
		}
		revisionById := make(map[int]*model.ChannelContributionRevision, len(revisions))
		for _, revision := range revisions {
			revisionById[revision.Id] = revision
		}

		entries := make([]channelContributionHealthEntry, 0, len(candidates))
		for _, candidate := range candidates {
			entry := channelContributionHealthEntry{
				Candidate:    candidate,
				Channel:      channelById[candidate.ChannelId],
				Revision:     revisionById[candidate.RevisionId],
				Observations: make(map[string]model.ChannelContributionModelObservation),
			}
			if entry.Revision == nil || entry.Revision.ConfigHash != candidate.ConfigHash {
				entries = append(entries, entry)
				continue
			}
			if entry.Channel == nil || entry.Channel.Status == common.ChannelStatusManuallyDisabled {
				entries = append(entries, entry)
				continue
			}

			specs, specErr := resolveChannelContributionProbeSpecs(entry.Revision)
			channelModels := channelContributionModels(entry.Channel.Models)
			if specErr != nil {
				for _, modelName := range channelModels {
					entry.Observations[modelName] = model.ChannelContributionModelObservation{
						Model: modelName,
						Error: specErr.Error(),
					}
				}
				entries = append(entries, entry)
				continue
			}
			specByModel := make(map[string]channelContributionProbeSpec, len(specs))
			for _, spec := range specs {
				specByModel[spec.Model] = spec
			}
			entry.Specs = make([]channelContributionProbeSpec, 0, len(channelModels))
			for _, modelName := range channelModels {
				spec, ok := specByModel[modelName]
				if !ok {
					entry.Observations[modelName] = model.ChannelContributionModelObservation{
						Model: modelName,
						Error: "model is absent from the approved contribution revision",
					}
					continue
				}
				entry.Specs = append(entry.Specs, spec)
			}
			entries = append(entries, entry)
		}

		work := buildChannelContributionHealthWork(entries)
		results := executeChannelContributionHealthWork(ctx, testUserId, work)
		if err := ctx.Err(); err != nil {
			return summary, err
		}
		for _, result := range results {
			entry := &entries[result.EntryIndex]
			entry.Observations[result.Observation.Model] = result.Observation
		}

		totalHint := processed + len(entries)
		for index := range entries {
			entry := &entries[index]
			processed++
			summary.Contributions++
			if report != nil {
				report(processed, totalHint)
			}
			if entry.Revision == nil || entry.Revision.ConfigHash != entry.Candidate.ConfigHash {
				continue
			}

			observations := make([]model.ChannelContributionModelObservation, 0, len(entry.Observations))
			for _, modelName := range channelContributionModels(entry.channelModels()) {
				observation, ok := entry.Observations[modelName]
				if ok {
					observations = append(observations, observation)
				}
			}
			if entry.Channel != nil && entry.Channel.Status != common.ChannelStatusManuallyDisabled {
				summary.Models += len(observations)
				for _, observation := range observations {
					if observation.Healthy {
						summary.Succeeded++
					} else {
						summary.Failed++
					}
				}
			}

			cycle, err := model.ApplyChannelContributionHealthCycle(
				entry.Candidate.ContributionId,
				entry.Candidate.ChannelId,
				entry.Candidate.RevisionId,
				entry.Candidate.ConfigHash,
				observations,
				common.GetTimestamp(),
				deleteAfterSeconds,
			)
			if errors.Is(err, model.ErrStaleChannelContributionHealthProbe) {
				continue
			}
			if err != nil {
				return summary, fmt.Errorf("apply contribution health channel=%d: %w", entry.Candidate.ChannelId, err)
			}
			if cycle.Paused {
				summary.Paused++
			}
			if cycle.Deleted {
				summary.Deleted++
			}
			cacheChanged = cacheChanged || cycle.StateChanged
		}
		if len(candidates) < channelContributionHealthBatchSize {
			break
		}
	}

	if report != nil {
		report(processed, processed)
	}
	return summary, nil
}

func (entry *channelContributionHealthEntry) channelModels() string {
	if entry.Channel != nil {
		return entry.Channel.Models
	}
	if entry.Revision != nil {
		return entry.Revision.Models
	}
	return ""
}

func buildChannelContributionHealthWork(entries []channelContributionHealthEntry) []channelContributionHealthWork {
	maxModels := 0
	total := 0
	for _, entry := range entries {
		total += len(entry.Specs)
		if len(entry.Specs) > maxModels {
			maxModels = len(entry.Specs)
		}
	}
	work := make([]channelContributionHealthWork, 0, total)
	for modelIndex := 0; modelIndex < maxModels; modelIndex++ {
		for entryIndex := range entries {
			entry := &entries[entryIndex]
			if entry.Channel == nil || modelIndex >= len(entry.Specs) {
				continue
			}
			group := entry.Channel.Group
			if entry.Revision != nil {
				group = entry.Revision.Group
			}
			work = append(work, channelContributionHealthWork{
				EntryIndex: entryIndex,
				Channel:    entry.Channel,
				Group:      group,
				Spec:       entry.Specs[modelIndex],
			})
		}
	}
	return work
}

func executeChannelContributionHealthWork(ctx context.Context, testUserId int, work []channelContributionHealthWork) []channelContributionHealthWorkResult {
	if len(work) == 0 {
		return nil
	}
	jobs := make(chan channelContributionHealthWork, len(work))
	results := make(chan channelContributionHealthWorkResult, len(work))
	workerCount := channelContributionHealthWorkerCount
	if len(work) < workerCount {
		workerCount = len(work)
	}
	var workers sync.WaitGroup
	workers.Add(workerCount)
	for workerIndex := 0; workerIndex < workerCount; workerIndex++ {
		go func() {
			defer workers.Done()
			for item := range jobs {
				results <- channelContributionHealthWorkResult{
					EntryIndex:  item.EntryIndex,
					Observation: probeChannelContributionModel(ctx, testUserId, item.Channel, item.Group, item.Spec),
				}
			}
		}()
	}
	for _, item := range work {
		jobs <- item
	}
	close(jobs)
	workers.Wait()
	close(results)

	collected := make([]channelContributionHealthWorkResult, 0, len(work))
	for result := range results {
		collected = append(collected, result)
	}
	return collected
}

func probeChannelContributionModel(ctx context.Context, testUserId int, channel *model.Channel, group string, spec channelContributionProbeSpec) model.ChannelContributionModelObservation {
	observation := model.ChannelContributionModelObservation{Model: spec.Model}
	failures := make([]string, 0, len(spec.Streams))
	for _, stream := range spec.Streams {
		probeCtx, cancel := context.WithTimeout(ctx, channelContributionHealthRequestTimeout)
		result := testChannelWithOptions(
			probeCtx,
			channel,
			testUserId,
			spec.Model,
			string(spec.EndpointType),
			stream,
			channelTestOptions{
				UseSSRFProtectedClient: true,
				SkipConsumeLog:         true,
				SkipPricingValidation:  true,
				GroupOverride:          group,
			},
		)
		cancel()
		if result.localErr == nil && result.newAPIError == nil {
			continue
		}
		mode := "non-stream"
		if stream {
			mode = "stream"
		}
		failures = append(failures, mode+": "+contributionHealthError(channel, result))
	}
	observation.Healthy = len(failures) == 0
	observation.Error = strings.Join(failures, "; ")
	return observation
}

func contributionHealthError(channel *model.Channel, result testResult) string {
	message := "channel health test failed"
	if result.newAPIError != nil {
		message = result.newAPIError.Error()
	} else if result.localErr != nil {
		message = result.localErr.Error()
	}
	if channel != nil {
		if baseURL := strings.TrimSpace(channel.GetBaseURL()); baseURL != "" {
			for _, candidate := range []string{baseURL, url.QueryEscape(baseURL), url.PathEscape(baseURL)} {
				message = strings.ReplaceAll(message, candidate, "[UPSTREAM]")
			}
		}
		message = sanitizeChannelCredentialError(errors.New(message), channel.Key, "").Error()
	}
	return truncateChannelContributionError(message, 500)
}
