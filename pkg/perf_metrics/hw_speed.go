package perfmetrics

import "github.com/QuantumNous/new-api/pkg/hwperf"

// countsForSpeed reports whether the sample may feed the tokens-per-second
// figure. The rule itself lives in pkg/hwperf, together with the output
// threshold it shares with the quality measurement, so both upstream call sites
// here keep nothing but their own line.
func (s Sample) countsForSpeed() bool {
	return hwperf.CountsForSpeed(s.OutputTokens, s.GenerationMs)
}
