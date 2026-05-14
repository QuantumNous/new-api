package agent

func DocLink(topic string) string {
	links := map[string]string{
		"how_to_topup":             "/console/topup",
		"how_to_use_token":         "/console/token",
		"third_party_client_setup": "/console/token",
		"billing_rules":            "/pricing",
		"rate_limit":               "/console/log",
		"model_list":               "/pricing",
	}
	if url, ok := links[topic]; ok {
		return url
	}
	return "/console"
}
