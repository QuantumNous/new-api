package controller

import "testing"

// TestVerifyIndiaGeo exercises the exact IP→country resolver the wallet uses to
// pick checkout currency (opsIPCountry, called from GetUserTopUpInfo as
// client_region). UPI only renders when client_region=IN → INR, so if these
// real Indian IPs do not resolve to "IN", Indian buyers silently fall back to
// USD + card-only and never see UPI. Run:
//
//	go test ./controller -run TestVerifyIndiaGeo -v
//
// This is a diagnostic, not a gate: it always logs the resolved country and
// only fails if the embedded DB cannot place well-known Indian carrier IPs.
func TestVerifyIndiaGeo(t *testing.T) {
	// Real allocations by major Indian networks (Jio, Airtel, BSNL, academic,
	// APNIC-IN blocks). These are stable network prefixes, not individuals.
	indiaIPs := []string{
		"49.36.0.1",    // Reliance Jio
		"122.160.0.1",  // Bharti Airtel
		"117.192.0.1",  // BSNL
		"14.139.0.1",   // Indian academic (ERNET)
		"103.21.244.1", // APNIC IN
		"1.6.0.1",      // Tata Communications IN
	}
	miss := 0
	for _, ip := range indiaIPs {
		got := opsIPCountry(ip)
		flag := "IN✓"
		if got != "IN" {
			flag = "NOT-IN✗"
			miss++
		}
		t.Logf("%-16s -> %-3s %s", ip, got, flag)
	}
	// Control: a US IP must NOT resolve to IN (guards against a stub that
	// returns IN for everything).
	if us := opsIPCountry("8.8.8.8"); us == "IN" {
		t.Errorf("control IP 8.8.8.8 resolved to IN — resolver is not trustworthy")
	} else {
		t.Logf("control 8.8.8.8   -> %-3s (expected non-IN)", us)
	}
	if miss == len(indiaIPs) {
		t.Fatalf("embedded iploc DB placed 0/%d Indian IPs in IN — geo layer is broken, "+
			"so Indian checkouts default to USD and never offer UPI", len(indiaIPs))
	}
	if miss > 0 {
		t.Logf("WARNING: %d/%d Indian IPs did not resolve to IN", miss, len(indiaIPs))
	}
}
