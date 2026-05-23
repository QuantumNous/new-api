package service

import (
	"math"

	"github.com/QuantumNous/new-api/model"
)

func buildPublicUpstreamStatusFromRecords(records []model.SupplierStatusSync) PublicUpstreamStatusPayload {
	groupIndex := make(map[string]int)
	monitorIndex := make(map[string]int)
	payload := PublicUpstreamStatusPayload{
		Success: true,
		Message: "",
		Data:    []PublicUpstreamStatusGroup{},
	}

	for _, record := range records {
		categoryName := record.DisplayName
		if categoryName == "" {
			categoryName = record.Provider
		}
		monitor := timelinePointFromRecord(record)
		groupPos := ensurePublicGroup(&payload, groupIndex, categoryName)
		monitorPos := ensurePublicMonitor(&payload.Data[groupPos], monitorIndex, record)
		payload.Data[groupPos].Monitors[monitorPos].History = append(payload.Data[groupPos].Monitors[monitorPos].History, monitor)
		if record.CheckedAt >= payload.Data[groupPos].Monitors[monitorPos].UpdatedAt {
			updatePublicMonitorLatest(&payload.Data[groupPos].Monitors[monitorPos], record)
		}
	}

	for groupIdx := range payload.Data {
		for monitorIdx := range payload.Data[groupIdx].Monitors {
			normalizePublicMonitor(&payload.Data[groupIdx].Monitors[monitorIdx])
		}
	}
	sortPublicPayload(&payload)
	return payload
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

func ensurePublicMonitor(group *PublicUpstreamStatusGroup, monitorIndex map[string]int, record model.SupplierStatusSync) int {
	key := monitorKey(record.Provider, record.GroupName, record.ModelName)
	if pos, ok := monitorIndex[key]; ok {
		return pos
	}
	group.Monitors = append(group.Monitors, PublicUpstreamStatusMonitor{
		Name:    firstNonEmpty(record.MonitorName, record.ModelName),
		Model:   record.ModelName,
		Group:   record.GroupName,
		History: []PublicUpstreamStatusTimeline{},
	})
	pos := len(group.Monitors) - 1
	monitorIndex[key] = pos
	return pos
}

func updatePublicMonitorLatest(monitor *PublicUpstreamStatusMonitor, record model.SupplierStatusSync) {
	monitor.Name = firstNonEmpty(record.MonitorName, record.ModelName)
	monitor.Model = record.ModelName
	monitor.Group = record.GroupName
	monitor.Status = record.Status
	monitor.Availability = record.Availability
	monitor.Latency = record.Latency
	monitor.UpdatedAt = record.CheckedAt
}

func normalizePublicMonitor(monitor *PublicUpstreamStatusMonitor) {
	if len(monitor.History) == 0 {
		return
	}
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

func timelinePointFromRecord(record model.SupplierStatusSync) PublicUpstreamStatusTimeline {
	return PublicUpstreamStatusTimeline{
		Timestamp:    record.CheckedAt,
		Status:       record.Status,
		Availability: record.Availability,
		Latency:      record.Latency,
	}
}
