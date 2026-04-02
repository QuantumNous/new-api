package system_setting

import "strings"

var CreativeCenterImageBedURL = ""
var CreativeCenterImageBedApiKey = ""

func EnableCreativeCenterImageBed() bool {
	return strings.TrimSpace(CreativeCenterImageBedURL) != "" &&
		strings.TrimSpace(CreativeCenterImageBedApiKey) != ""
}
