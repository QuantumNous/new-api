package constant

// WaffoPayMethod defines the display and API parameter mapping for Waffo payment methods.
type WaffoPayMethod struct {
	Name          string `json:"name"`            // Frontend display name
	Icon          string `json:"icon"`            // Frontend icon identifier: credit-card, apple, google
	PayMethodType string `json:"payMethodType"` // Waffo API PayMethodType, can be comma-separated
	PayMethodName string `json:"payMethodName"` // Waffo API PayMethodName, empty means auto-select by Waffo checkout
}

// DefaultWaffoPayMethods is the default list of supported payment methods.
var DefaultWaffoPayMethods = []WaffoPayMethod{
	{Name: "Card", Icon: "credit-card", PayMethodType: "CREDITCARD,DEBITCARD", PayMethodName: ""},
	{Name: "Apple Pay", Icon: "apple", PayMethodType: "APPLEPAY", PayMethodName: "APPLEPAY"},
	{Name: "Google Pay", Icon: "google", PayMethodType: "GOOGLEPAY", PayMethodName: "GOOGLEPAY"},
}
