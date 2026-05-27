package service

import (
	"math"
	"sort"

	"github.com/QuantumNous/new-api/model"
)

const upstreamStatusTimelineBucketSeconds int64 = 5 * 60

func buildPublicUpstreamStatus(records []model.SupplierStatusSync, probes []model.ChannelProbeResult) PublicUpstreamStatusPayload {
	payload := buildPublicUpstreamStatusFromRecordsWithOptions(records, false)
	appendPublicUpstreamStatusFromProbes(&payload, probes)
	sortPublicPayload(&payload)
	return payload
}

func buildPublicUpstreamStatusFromRecords(records []model.SupplierStatusSync) PublicUpstreamStatusPayload {
	return buildPublicUpstreamStatusFromRecordsWithOptions(records, true)
}

func buildPublicUpstreamStatusFromRecordsWithOptions(records []model.SupplierStatusSync, normalize bool) PublicUpstreamStatusPayload {
	groupIndex := make(map[string]int)
	monitorIndex := make(map[string]int)
	groupResolver := newPlatformStatusGroupResolver()
	payload := PublicUpstreamStatusPayload{
		Success: true,
		Message: "",
		Data:    []PublicUpstreamStatusGroup{},
	}

	for _, record := range records {
		monitor := timelinePointFromRecord(record)
		for _, target := range groupResolver.targetsForRecord(record) {
			if target.Group == "" || target.Model == "" {
				continue
			}
			groupPos := ensurePublicGroup(&payload, groupIndex, target.Group)
			monitorPos := ensurePublicMonitor(&payload.Data[groupPos], monitorIndex, target.Group, target.Model)
			payload.Data[groupPos].Monitors[monitorPos].History = append(payload.Data[groupPos].Monitors[monitorPos].History, monitor)
			if record.CheckedAt >= payload.Data[groupPos].Monitors[monitorPos].UpdatedAt {
				updatePublicMonitorLatest(&payload.Data[groupPos].Monitors[monitorPos], target.Group, target.Model, record)
			}
		}
	}

	if normalize {
		for groupIdx := range payload.Data {
			for monitorIdx := range payload.Data[groupIdx].Monitors {
				normalizePublicMonitor(&payload.Data[groupIdx].Monitors[monitorIdx])
			}
		}
	}
	sortPublicPayload(&payload)
	return payload
}

func appendPublicUpstreamStatusFromProbes(payload *PublicUpstreamStatusPayload, probes []model.ChannelProbeResult) {
	groupIndex := indexPublicGroups(*payload)
	monitorIndex := indexPublicMonitors(*payload)
	for _, probe := range probes {
		if probe.Model == "" {
			continue
		}
		record := supplierStatusRecordFromProbe(probe)
		categoryName := platformGroupDisplayName(probe.Group)
		if categoryName == "" {
			continue
		}
		groupPos := ensurePublicGroup(payload, groupIndex, categoryName)
		monitorPos := ensurePublicMonitor(&payload.Data[groupPos], monitorIndex, categoryName, record.ModelName)
		payload.Data[groupPos].Monitors[monitorPos].History = append(
			payload.Data[groupPos].Monitors[monitorPos].History,
			timelinePointFromRecord(record),
		)
		if record.CheckedAt >= payload.Data[groupPos].Monitors[monitorPos].UpdatedAt {
			updatePublicMonitorLatest(&payload.Data[groupPos].Monitors[monitorPos], categoryName, record.ModelName, record)
		}
	}
	for groupIdx := range payload.Data {
		for monitorIdx := range payload.Data[groupIdx].Monitors {
			normalizePublicMonitor(&payload.Data[groupIdx].Monitors[monitorIdx])
		}
	}
}

func supplierStatusRecordFromProbe(probe model.ChannelProbeResult) model.SupplierStatusSync {
	return model.SupplierStatusSync{
		Provider:     DynamicSourcePlatformProbe,
		GroupName:    platformGroupDisplayName(probe.Group),
		MonitorID:    DynamicSourcePlatformProbe + ":" + probe.Group + ":" + probe.Model,
		MonitorName:  probe.Model,
		ModelName:    probe.Model,
		Status:       probeStatusCode(probe.Status),
		Availability: availabilityFromProbeStatus(probe.Status),
		Latency:      probe.Latency,
		CheckedAt:    probe.CheckedAt,
	}
}

func indexPublicGroups(payload PublicUpstreamStatusPayload) map[string]int {
	index := make(map[string]int, len(payload.Data))
	for i, group := range payload.Data {
		index[group.CategoryName] = i
	}
	return index
}

func indexPublicMonitors(payload PublicUpstreamStatusPayload) map[string]int {
	index := make(map[string]int)
	for _, group := range payload.Data {
		for i, monitor := range group.Monitors {
			index[monitorKey("", group.CategoryName, monitor.Model)] = i
		}
	}
	return index
}

func upstreamCategoryName(record model.SupplierStatusSync) string {
	if record.GroupName != "" {
		return record.GroupName
	}
	if record.DisplayName != "" {
		return record.DisplayName
	}
	return record.Provider
}

func ensurePublicGroup(payload *PublicUpstreamStatusPayload, groupIndex map[string]int, categoryName string) int {
	if pos, ok := groupIndex[categoryName]; ok {
		return pos
	}
	payload.Data = append(payload.Data, PublicUpstreamStatusGroup{
		CategoryName: categoryName,
		Monitors:     []PublicUpstreamStatusMonitor{},
	})
	pos := len(payload.Data) - 1
	groupIndex[categoryName] = pos
	return pos
}

func ensurePublicMonitor(group *PublicUpstreamStatusGroup, monitorIndex map[string]int, categoryName string, modelName string) int {
	key := monitorKey("", categoryName, modelName)
	if pos, ok := monitorIndex[key]; ok {
		return pos
	}
	group.Monitors = append(group.Monitors, PublicUpstreamStatusMonitor{
		Name:    modelName,
		Model:   modelName,
		Group:   categoryName,
		History: []PublicUpstreamStatusTimeline{},
	})
	pos := len(group.Monitors) - 1
	monitorIndex[key] = pos
	return pos
}

func updatePublicMonitorLatest(monitor *PublicUpstreamStatusMonitor, categoryName string, modelName string, record model.SupplierStatusSync) {
	monitor.Name = modelName
	monitor.Model = modelName
	monitor.Group = categoryName
	monitor.Status = record.Status
	monitor.Availability = record.Availability
	monitor.Latency = record.Latency
	monitor.UpdatedAt = record.CheckedAt
}

func availabilityFromProbeStatus(status string) float64 {
	switch status {
	case DynamicHealthHealthy:
		return 100
	case DynamicHealthDegraded:
		return 80
	case DynamicHealthUnhealthy:
		return 0
	default:
		return 0
	}
}

func normalizePublicMonitor(monitor *PublicUpstreamStatusMonitor) {
	if len(monitor.History) == 0 {
		return
	}
	monitor.History = aggregatePublicTimeline(monitor.History)
	available := 0
	for _, point := range monitor.History {
		if point.Status == 1 {
			available++
		}
	}
	monitor.Uptime = math.Round(float64(available)/float64(len(monitor.History))*10000) / 10000
	if monitor.Availability > 1 {
		monitor.Availability = math.Round(monitor.Availability*100) / 100
	}
}

type publicTimelineBucket struct {
	timestamp       int64
	count           int
	status          int
	availabilitySum float64
	latencySum      int
}

func aggregatePublicTimeline(history []PublicUpstreamStatusTimeline) []PublicUpstreamStatusTimeline {
	bucketIndex := make(map[int64]int)
	buckets := make([]publicTimelineBucket, 0, len(history))
	for _, point := range history {
		bucketTimestamp := point.Timestamp - point.Timestamp%upstreamStatusTimelineBucketSeconds
		bucketPos, ok := bucketIndex[bucketTimestamp]
		if !ok {
			buckets = append(buckets, publicTimelineBucket{
				timestamp:       bucketTimestamp,
				status:          point.Status,
				availabilitySum: point.Availability,
				latencySum:      point.Latency,
				count:           1,
			})
			bucketIndex[bucketTimestamp] = len(buckets) - 1
			continue
		}

		bucket := &buckets[bucketPos]
		bucket.count++
		bucket.availabilitySum += point.Availability
		bucket.latencySum += point.Latency
		if publicStatusSeverity(point.Status) > publicStatusSeverity(bucket.status) {
			bucket.status = point.Status
		}
	}

	sort.SliceStable(buckets, func(i, j int) bool {
		return buckets[i].timestamp < buckets[j].timestamp
	})

	result := make([]PublicUpstreamStatusTimeline, 0, len(buckets))
	for _, bucket := range buckets {
		result = append(result, PublicUpstreamStatusTimeline{
			Timestamp:    bucket.timestamp,
			Status:       bucket.status,
			Availability: math.Round(bucket.availabilitySum/float64(bucket.count)*100) / 100,
			Latency:      int(math.Round(float64(bucket.latencySum) / float64(bucket.count))),
		})
	}
	return result
}

func publicStatusSeverity(status int) int {
	switch status {
	case 0:
		return 3
	case 2:
		return 2
	case 1:
		return 1
	default:
		return 0
	}
}

func timelinePointFromRecord(record model.SupplierStatusSync) PublicUpstreamStatusTimeline {
	return PublicUpstreamStatusTimeline{
		Timestamp:    record.CheckedAt,
		Status:       record.Status,
		Availability: record.Availability,
		Latency:      record.Latency,
	}
}
