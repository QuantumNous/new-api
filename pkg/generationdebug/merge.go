package generationdebug

func MergeIntoLogOther(other map[string]interface{}, summary *Summary, raw *RawDebug) {
	if other == nil || summary == nil {
		return
	}
	other["generation_debug"] = summary
	if raw == nil {
		return
	}
	adminInfo, ok := other["admin_info"].(map[string]interface{})
	if !ok || adminInfo == nil {
		adminInfo = make(map[string]interface{})
		other["admin_info"] = adminInfo
	}
	adminInfo["generation_debug_raw"] = raw
}
