package channel

import (
	"fmt"
)

// ForeignTextRequest is the leftover Adaptor method body for a protocol the
// channel does not speak. Production text traffic converts via
// ConvertRequestToChannelNative (IR) and then calls the native Convert* hook.
func ForeignTextRequest(method string) (any, error) {
	return nil, fmt.Errorf("%s: protocol conversion belongs to ConvertRequestToChannelNative", method)
}
