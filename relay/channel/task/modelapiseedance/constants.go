package modelapiseedance

const ChannelName = "modelapi-seedance"
const UpstreamModel = "doubao-seedance-2-5-260628"
const maxModelAPISubmitResponseBytes = 1 << 20
const modelAPIBaseModelPrice = 0.14
const modelAPIBillingUnitsKey = "billable_units"

var ModelList = []string{
	UpstreamModel,
}
