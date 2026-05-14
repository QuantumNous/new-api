package agent

import "strings"

func TranslateError(err error) string {
	if err == nil {
		return ""
	}
	return ExplainError(0, err.Error())
}

func ExplainError(statusCode int, text string) string {
	lower := strings.ToLower(text)
	switch {
	case statusCode == 429 || strings.Contains(lower, "429") || strings.Contains(lower, "rate limit"):
		return "The selected model is busy or rate-limited. Please wait a moment or try another model."
	case statusCode == 401 || strings.Contains(lower, "unauthorized") || strings.Contains(lower, "401"):
		return "The credential appears invalid. Please check or create a new API key."
	case strings.Contains(lower, "insufficient") || strings.Contains(lower, "quota"):
		return "Your quota may be insufficient. Please check your balance or top up."
	case strings.Contains(lower, "context length"):
		return "The input is too long for this model. Please shorten it or use a longer-context model."
	case strings.Contains(lower, "timeout"):
		return "The upstream model timed out. Please try again later."
	default:
		if text != "" {
			return Sanitize(text)
		}
		return "The request failed, but no detailed reason was available."
	}
}
