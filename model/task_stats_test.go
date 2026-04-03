package model

import "testing"

func TestTaskGetStatsAggregatesByMediaType(t *testing.T) {
	truncateTables(t)

	insertTask(t, &Task{
		TaskID:     "task-image-success",
		UserId:     1,
		Action:     "imageGenerate",
		Status:     TaskStatusSuccess,
		SubmitTime: 1711933200,
		Progress:   "100%",
	})
	insertTask(t, &Task{
		TaskID:     "task-image-failure",
		UserId:     1,
		Action:     "imageEdit",
		Status:     TaskStatusUnknown,
		SubmitTime: 1711936800,
		FailReason: "upstream failed",
	})
	insertTask(t, &Task{
		TaskID:     "task-video-running-progress",
		UserId:     1,
		Action:     "generate",
		Status:     TaskStatusUnknown,
		SubmitTime: 1712019600,
		Progress:   "85%",
	})
	insertTask(t, &Task{
		TaskID:     "task-video-running-status",
		UserId:     1,
		Action:     "textGenerate",
		Status:     TaskStatus("PENDING"),
		SubmitTime: 1712023200,
	})
	insertTask(t, &Task{
		TaskID:     "task-video-success",
		UserId:     1,
		Action:     "remixGenerate",
		Status:     TaskStatusSuccess,
		SubmitTime: 1712026800,
		Progress:   "100%",
	})
	insertTask(t, &Task{
		TaskID:     "task-non-media",
		UserId:     1,
		Action:     "speech",
		Status:     TaskStatusSuccess,
		SubmitTime: 1712026800,
		Progress:   "100%",
	})

	stats := TaskGetStats(SyncTaskQueryParams{
		MediaType:      TaskMediaTypeAll,
		StartTimestamp: 1711929600,
		EndTimestamp:   1712102399,
	})

	if stats.RunningCount != 2 {
		t.Fatalf("expected running_count=2, got %d", stats.RunningCount)
	}
	if len(stats.DailyCounts) != 0 {
		t.Fatalf("expected no daily counts, got %d", len(stats.DailyCounts))
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
}

func TestTaskGetUserStatsFiltersByUser(t *testing.T) {
	truncateTables(t)

	insertTask(t, &Task{
		TaskID:     "task-user-1",
		UserId:     1,
		Action:     "generate",
		Status:     TaskStatus("PROCESSING"),
		SubmitTime: 1712019600,
	})
	insertTask(t, &Task{
		TaskID:     "task-user-2",
		UserId:     2,
		Action:     "generate",
		Status:     TaskStatusFailure,
		SubmitTime: 1712019600,
		FailReason: "failed",
		Progress:   "100%",
	})

	stats := TaskGetUserStats(1, SyncTaskQueryParams{
		MediaType:      TaskMediaTypeAll,
		StartTimestamp: 1711929600,
		EndTimestamp:   1712102399,
	})

	if stats.TotalStats.Running != 1 || stats.TotalStats.Success != 0 || stats.TotalStats.Failure != 0 {
		t.Fatalf("unexpected user-scoped stats: %+v", stats.TotalStats)
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
