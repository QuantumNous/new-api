package attemptlog

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/types"
)

// A representative prompt body: system prompt + tools + a few messages.
// 8KB is typical for an agent request with a medium system prompt.
var benchBody8KB = []byte(`{"model":"glm-5.2","messages":[{"role":"system","content":"` +
	strings.Repeat("You are a helpful assistant. ", 80) +
	`"},{"role":"user","content":"Please fix this Python error: TypeError: undefined is not a function?"}],"tools":[{"type":"function","function":{"name":"get_weather","description":"Get weather","parameters":{"type":"object","properties":{"location":{"type":"string"}}}}}]}`)

func BenchmarkComputePrefixHashes_8KB(b *testing.B) {
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_ = ComputePrefixHashes(benchBody8KB, types.RelayFormatOpenAI)
	}
}

func BenchmarkSparseChainHash_8KB(b *testing.B) {
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_ = sparseChainHash(benchBody8KB)
	}
}

func BenchmarkSparseChainHash_100KB(b *testing.B) {
	big := strings.Repeat("a", 100*1024)
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_ = sparseChainHash([]byte(big))
	}
}

func BenchmarkLastUserText_8KB(b *testing.B) {
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_ = LastUserText(benchBody8KB, types.RelayFormatOpenAI)
	}
}

func BenchmarkGuessTaskType(b *testing.B) {
	text := "Please fix this Python error: TypeError: undefined is not a function?"
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_ = GuessTaskType(text)
	}
}

// Large-body benchmarks model the 1M-context era: 200K/300K/600K/1200K byte
// bodies correspond roughly to 150K/256K/500K/1M token contexts. The dominant
// cost is sparseChainHash (O(log(body)) SHA256 calls); gjson extraction adds an
// O(body) streaming parse. These tell us whether telemetry stays negligible at
// extreme prompt sizes.
var benchSizes = []struct {
	name string
	size int
}{
	{"200K", 200 * 1024},
	{"300K", 300 * 1024},
	{"600K", 600 * 1024},
	{"1200K", 1200 * 1024},
}

func makeLargeOpenAIBody(targetBytes int) []byte {
	filler := strings.Repeat("a", targetBytes)
	return []byte(`{"model":"gpt-4o","messages":[{"role":"system","content":"` + filler + `"},{"role":"user","content":"hello"}],"tools":[]}`)
}

func BenchmarkBlockChainHash_Large(b *testing.B) {
	for _, sz := range benchSizes {
		data := makeLargeOpenAIBody(sz.size)
		b.Run(sz.name, func(b *testing.B) {
			b.ReportAllocs()
			for i := 0; i < b.N; i++ {
				_ = sparseChainHash(data)
			}
		})
	}
}

func BenchmarkComputePrefixHashes_Large(b *testing.B) {
	for _, sz := range benchSizes {
		body := makeLargeOpenAIBody(sz.size)
		b.Run(sz.name, func(b *testing.B) {
			b.ReportAllocs()
			for i := 0; i < b.N; i++ {
				_ = ComputePrefixHashes(body, types.RelayFormatOpenAI)
			}
		})
	}
}

func BenchmarkLastUserText_Large(b *testing.B) {
	for _, sz := range benchSizes {
		body := makeLargeOpenAIBody(sz.size)
		b.Run(sz.name, func(b *testing.B) {
			b.ReportAllocs()
			for i := 0; i < b.N; i++ {
				_ = LastUserText(body, types.RelayFormatOpenAI)
			}
		})
	}
}
