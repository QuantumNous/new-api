package agent

import "regexp"

var (
	keyPattern   = regexp.MustCompile(`sk-[A-Za-z0-9_\-]{12,}`)
	emailPattern = regexp.MustCompile(`[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}`)
	phonePattern = regexp.MustCompile(`1[3-9][0-9]{9}`)
)

func GuardOut(content string) (string, error) {
	return Sanitize(content), nil
}

func Sanitize(content string) string {
	content = keyPattern.ReplaceAllStringFunc(content, func(s string) string {
		if len(s) <= 10 {
			return "sk-****"
		}
		return s[:6] + "****" + s[len(s)-4:]
	})
	content = emailPattern.ReplaceAllString(content, "[email]")
	content = phonePattern.ReplaceAllString(content, "[phone]")
	return content
}
