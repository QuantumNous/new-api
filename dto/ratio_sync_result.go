package dto

// FetchUpstreamRatiosResult holds the response data for FetchUpstreamRatios.
type FetchUpstreamRatiosResult struct {
	Differences map[string]map[string]DifferenceItem `json:"differences"`
	TestResults []TestResult                          `json:"test_results"`
}
