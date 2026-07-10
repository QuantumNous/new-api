package service

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func TestMergeTaskUsageFromNestedJSON_TopLevelUsage(t *testing.T) {
	t.Parallel()
	tr := &relaycommon.TaskInfo{}
	raw := []byte(`{"status":"succeeded","usage":{"total_tokens":100,"completion_tokens":80,"prompt_tokens":20}}`)
	mergeTaskUsageFromNestedJSON(raw, tr)
	if tr.TotalTokens != 100 || tr.CompletionTokens != 80 || tr.PromptTokens != 20 {
		t.Fatalf("got total=%d completion=%d prompt=%d", tr.TotalTokens, tr.CompletionTokens, tr.PromptTokens)
	}
}

func TestMergeTaskUsageFromNestedJSON_NewAPIWrappedDataUsage(t *testing.T) {
	t.Parallel()
	// 复现豆包视频经 New API 兼容上游轮询成功后 usage 在 data 内、顶层无 usage 的场景
	tr := &relaycommon.TaskInfo{Status: "SUCCESS"}
	raw := []byte(`{
		"code":"success",
		"message":"",
		"data":{
			"usage":{"total_tokens":151078,"completion_tokens":151078},
			"status":"SUCCESS",
			"task_id":"task_abc",
			"progress":"100%",
			"result_url":"https://example.com/v.mp4",
			"total_tokens":151078,
			"completion_tokens":151078
		}
	}`)
	mergeTaskUsageFromNestedJSON(raw, tr)
	if tr.TotalTokens != 151078 {
		t.Fatalf("TotalTokens=%d, want 151078", tr.TotalTokens)
	}
	if tr.CompletionTokens != 151078 {
		t.Fatalf("CompletionTokens=%d, want 151078", tr.CompletionTokens)
	}
}

func TestMergeTaskUsageFromNestedJSON_FlatTokensOnlyCompletion(t *testing.T) {
	t.Parallel()
	tr := &relaycommon.TaskInfo{}
	raw := []byte(`{"code":"success","data":{"status":"SUCCESS","completion_tokens":9000}}`)
	mergeTaskUsageFromNestedJSON(raw, tr)
	if tr.CompletionTokens != 9000 {
		t.Fatalf("CompletionTokens=%d, want 9000", tr.CompletionTokens)
	}
	if tr.TotalTokens != 9000 {
		t.Fatalf("TotalTokens=%d, want 9000 (backfilled from completion)", tr.TotalTokens)
	}
}

func TestMergeTaskUsageFromNestedJSON_DoesNotOverwriteExisting(t *testing.T) {
	t.Parallel()
	tr := &relaycommon.TaskInfo{TotalTokens: 10, CompletionTokens: 7, PromptTokens: 3}
	raw := []byte(`{"usage":{"total_tokens":999,"completion_tokens":888,"prompt_tokens":111}}`)
	mergeTaskUsageFromNestedJSON(raw, tr)
	if tr.TotalTokens != 10 || tr.CompletionTokens != 7 || tr.PromptTokens != 3 {
		t.Fatalf("should keep existing tokens, got total=%d completion=%d prompt=%d",
			tr.TotalTokens, tr.CompletionTokens, tr.PromptTokens)
	}
}
