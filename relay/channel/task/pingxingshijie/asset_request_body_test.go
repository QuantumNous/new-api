package pingxingshijie

import (
	"io"
	"strings"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func TestBuildRequestBodyAssetUploadStripsGatewayModel(t *testing.T) {
	c := newAssetUploadContext(`{"model":"pingxingshijie-asset","image_url":"https://example.com/a.jpg","asset_type":"Image"}`)
	info := &relaycommon.RelayInfo{RequestURLPath: "/v1/assets/upload", TaskRelayInfo: &relaycommon.TaskRelayInfo{}}

	body, err := (&TaskAdaptor{}).BuildRequestBody(c, info)
	if err != nil {
		t.Fatal(err)
	}
	raw, err := io.ReadAll(body)
	if err != nil {
		t.Fatal(err)
	}

	if strings.Contains(string(raw), "model") {
		t.Fatalf("asset upstream body must not include gateway-only model: %s", string(raw))
	}
	if !strings.Contains(string(raw), `"image_url":"https://example.com/a.jpg"`) {
		t.Fatalf("asset upstream body lost image_url: %s", string(raw))
	}
	if !strings.Contains(string(raw), `"asset_type":"Image"`) {
		t.Fatalf("asset upstream body lost asset_type: %s", string(raw))
	}
}
