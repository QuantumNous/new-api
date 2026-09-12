package common

import "strings"

// ImageErrorMessage avoids presenting a provider's broad refusal category as a
// verified explanation of the customer's content. Status/code and server logs
// remain unchanged for diagnostics and client error handling.
func ImageErrorMessage(path, code, message string) string {
	if strings.Contains(path, "/images/") && code == "content_policy_violation" {
		return "Image generation failed. Please contact support with the request ID."
	}
	return message
}
