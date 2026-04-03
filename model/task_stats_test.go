package model

import (
	"testing"
	"time"
)

func TestBuildTaskStatsResponse(t *testing.T) {
	startTimestamp := int64(1711929600) // 2024-04-01 00:00:00 +0800
	endTimestamp := int64(1712102399)   // 2024-04-02 23:59:59 +0800

	stats := BuildTaskStatsResponse(
		[]taskStatsRecord{
			{Action: "imageGenerate", Status: TaskStatusSuccess, SubmitTime: 1711933200},
			{Action: "imageEdit", Status: TaskStatus("UNKNOWN"), FailReason: "upstream failed", SubmitTime: 1711936800},
			{Action: "generate", Status: TaskStatus("UNKNOWN"), Progress: "85%", SubmitTime: 1712019600},
			{Action: "textGenerate", Status: TaskStatus("PENDING"), SubmitTime: 1712023200},
			{Action: "remixGenerate", Status: TaskStatusSuccess, SubmitTime: 1712026800},
			{Action: "speech", Status: TaskStatusSuccess, SubmitTime: 1712026800},
		},
		startTimestamp,
		endTimestamp,
	)

	if stats.RunningCount != 2 {
		t.Fatalf("expected running_count=2, got %d", stats.RunningCount)
	}

	if stats.TotalStats.Success != 2 || stats.TotalStats.Failure != 1 || stats.TotalStats.Running != 2 {
		t.Fatalf("unexpected total stats: %+v", stats.TotalStats)
	}

	if stats.ImageStats.Success != 1 || stats.ImageStats.Failure != 1 || stats.ImageStats.Running != 0 {
		t.Fatalf("unexpected image stats: %+v", stats.ImageStats)
	}

	if stats.VideoStats.Success != 1 || stats.VideoStats.Running != 2 || stats.VideoStats.Failure != 0 {
		t.Fatalf("unexpected video stats: %+v", stats.VideoStats)
	}

	if len(stats.DailyCounts) != 2 {
		t.Fatalf("expected 2 daily buckets, got %d", len(stats.DailyCounts))
	}

	if stats.DailyCounts[0].Date != "2024-04-01" || stats.DailyCounts[0].Total != 2 {
		t.Fatalf("unexpected first daily bucket: %+v", stats.DailyCounts[0])
	}

	if stats.DailyCounts[1].Date != "2024-04-02" || stats.DailyCounts[1].Total != 3 {
		t.Fatalf("unexpected second daily bucket: %+v", stats.DailyCounts[1])
	}
}

func TestGetTaskActionsForMediaType(t *testing.T) {
	allActions := getTaskActionsForMediaType(TaskMediaTypeAll)
	if len(allActions) != 7 {
		t.Fatalf("expected 7 actions for all media type, got %d", len(allActions))
	}

	imageActions := getTaskActionsForMediaType(TaskMediaTypeImage)
	if len(imageActions) != 2 {
		t.Fatalf("expected 2 image actions, got %d", len(imageActions))
	}

	videoActions := getTaskActionsForMediaType(TaskMediaTypeVideo)
	if len(videoActions) != 5 {
		t.Fatalf("expected 5 video actions, got %d", len(videoActions))
	}
}

func TestBuildTaskStatsResponseTodayUsesHourlyBuckets(t *testing.T) {
	now := time.Now().In(time.Local)
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	end := time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 0, now.Location())

	stats := BuildTaskStatsResponse(
		[]taskStatsRecord{
			{
				Action:     "generate",
				Status:     TaskStatusSuccess,
				SubmitTime: start.Add(2 * time.Hour).Unix(),
			},
			{
				Action:     "imageGenerate",
				Status:     TaskStatusSuccess,
				SubmitTime: start.Add(15 * time.Hour).Unix(),
			},
		},
		start.Unix(),
		end.Unix(),
	)

	if len(stats.DailyCounts) != 24 {
		t.Fatalf("expected 24 hourly buckets, got %d", len(stats.DailyCounts))
	}

	if stats.DailyCounts[2].Date != "02:00" || stats.DailyCounts[2].Total != 1 {
		t.Fatalf("unexpected 02:00 bucket: %+v", stats.DailyCounts[2])
	}

	if stats.DailyCounts[15].Date != "15:00" || stats.DailyCounts[15].Total != 1 {
		t.Fatalf("unexpected 15:00 bucket: %+v", stats.DailyCounts[15])
	}
}
