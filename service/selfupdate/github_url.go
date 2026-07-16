package selfupdate

import (
	"fmt"
	"net/url"
	"strings"
)

// ValidateDownloadURL ensures that raw is an HTTPS URL pointing to a trusted
// GitHub host. Allowed hosts: github.com, *.github.com,
// objects.githubusercontent.com, *.githubusercontent.com.
func ValidateDownloadURL(raw string) error {
	u, err := url.Parse(raw)
	if err != nil {
		return err
	}
	if u.Scheme != "https" {
		return fmt.Errorf("only HTTPS URLs are allowed")
	}
	host := u.Hostname()
	if host == "github.com" || strings.HasSuffix(host, ".github.com") ||
		host == "objects.githubusercontent.com" || strings.HasSuffix(host, ".githubusercontent.com") {
		return nil
	}
	return fmt.Errorf("download from untrusted host: %s", host)
}
