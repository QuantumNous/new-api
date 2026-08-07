package dto

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestChannelSettingsReturnSourceURLJSON(t *testing.T) {
	t.Run("enabled", func(t *testing.T) {
		encoded, err := common.Marshal(ChannelSettings{ReturnSourceURL: true})
		if err != nil {
			t.Fatalf("marshal channel settings: %v", err)
		}

		if string(encoded) != `{"proxy":"","return_source_url":true}` {
			t.Fatalf("encoded settings = %s", encoded)
		}
	})

	t.Run("empty settings", func(t *testing.T) {
		encoded, err := common.Marshal(ChannelSettings{})
		if err != nil {
			t.Fatalf("marshal channel settings: %v", err)
		}

		if string(encoded) != `{"proxy":""}` {
			t.Fatalf("encoded settings = %s", encoded)
		}
	})
}
