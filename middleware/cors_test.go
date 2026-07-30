package middleware

import "testing"

// TestTrustedBrowserOriginCoversLivePortal pins the production account-portal
// origin. This is not busywork: the portal moved from account.jinn.ccwu.cc to
// account.jinnhq.com and the allowlist was not updated, so every Airwallex
// checkout silently failed its return_url trust check and dumped paying users
// on the admin console's sign-in page. Payment still completed (activation runs
// on the webhook), which is exactly why the breakage went unnoticed.
func TestTrustedBrowserOriginCoversLivePortal(t *testing.T) {
	for _, origin := range []string{
		"https://account.jinnhq.com",        // live portal — payment return_url must survive
		"https://account.jinn.ccwu.cc:8444", // legacy portal, still allowed
	} {
		if !TrustedBrowserOrigin(origin) {
			t.Errorf("origin %s must be trusted; payment return URLs from it are silently discarded otherwise", origin)
		}
	}
}

func TestTrustedBrowserOriginRejectsUntrusted(t *testing.T) {
	for _, origin := range []string{
		"https://evil.example.com",
		"http://account.jinnhq.com",   // scheme matters
		"https://account.jinnhq.com/", // trailing slash is not an origin
		"https://jinnhq.com",          // marketing site is not a credentialed origin
		"",
	} {
		if TrustedBrowserOrigin(origin) {
			t.Errorf("origin %q must NOT be trusted", origin)
		}
	}
}
