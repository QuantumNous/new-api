package model

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/setting/operation_setting"
)

var (
	benchmarkDefaultLogRequestSampleRunner = logRequestSampleAsyncRunner
	benchmarkDefaultLogRequestSampleRandom = logRequestSampleRandomFloat
	benchmarkOriginalSamplingSetting       operation_setting.LogRequestSamplingSetting
)

func benchmarkRequestSamplingLog() *Log {
	return &Log{
		Id:        1,
		UserId:    123,
		CreatedAt: 1000,
		Type:      LogTypeConsume,
		RequestId: "bench_req",
	}
}

func BenchmarkLogRequestSamplingDisabled(b *testing.B) {
	configureRequestSamplingBenchmark(false, 1)
	defer resetRequestSamplingBenchmark()
	log := benchmarkRequestSamplingLog()
	params := RecordConsumeLogParams{ModelName: "gpt-4o", TokenId: 1, Other: map[string]interface{}{}}

	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		c := newRequestSamplingContext("POST", "/v1/chat/completions", strings.NewReader(`{"messages":[{"content":"hi"}]}`))
		maybeRecordLogRequestSample(c, 123, params, log)
	}
}

func BenchmarkLogRequestSamplingEnabledNotSampled(b *testing.B) {
	configureRequestSamplingBenchmark(true, 0)
	defer resetRequestSamplingBenchmark()
	log := benchmarkRequestSamplingLog()
	params := RecordConsumeLogParams{ModelName: "gpt-4o", TokenId: 1, Other: map[string]interface{}{}}

	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		c := newRequestSamplingContext("POST", "/v1/chat/completions", strings.NewReader(`{"messages":[{"content":"hi"}]}`))
		maybeRecordLogRequestSample(c, 123, params, log)
	}
}

func BenchmarkLogRequestSamplingSampled16KiB(b *testing.B) {
	configureRequestSamplingBenchmark(true, 1)
	defer resetRequestSamplingBenchmark()
	log := benchmarkRequestSamplingLog()
	params := RecordConsumeLogParams{ModelName: "gpt-4o", TokenId: 1, Other: map[string]interface{}{}}
	payload := `{"messages":[{"role":"user","content":"` + strings.Repeat("a", 15*1024) + `"}]}`

	oldRunner := logRequestSampleAsyncRunner
	logRequestSampleAsyncRunner = func(fn func()) {}
	defer func() { logRequestSampleAsyncRunner = oldRunner }()

	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		c := newRequestSamplingContext("POST", "/v1/chat/completions", strings.NewReader(payload))
		maybeRecordLogRequestSample(c, 123, params, log)
	}
}

func configureRequestSamplingBenchmark(enabled bool, rate float64) {
	benchmarkOriginalSamplingSetting = operation_setting.GetLogRequestSamplingSetting()
	operation_setting.UpdateLogRequestSamplingSetting(func(setting *operation_setting.LogRequestSamplingSetting) {
		setting.Enabled = enabled
		setting.SampleRate = rate
		setting.Groups = []string{"plg"}
	})
	logRequestSampleRandomFloat = func() float64 { return 0 }
	logRequestSampleAsyncRunner = func(fn func()) { fn() }
}

func resetRequestSamplingBenchmark() {
	operation_setting.UpdateLogRequestSamplingSetting(func(setting *operation_setting.LogRequestSamplingSetting) {
		*setting = benchmarkOriginalSamplingSetting
	})
	logRequestSampleRandomFloat = benchmarkDefaultLogRequestSampleRandom
	logRequestSampleAsyncRunner = benchmarkDefaultLogRequestSampleRunner
}
