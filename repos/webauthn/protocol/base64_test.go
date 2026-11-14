package protocol

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBase64UnmarshalJSON(t *testing.T) {
	type testData struct {
		StringData  string           `json:"string_data"`
		EncodedData URLEncodedBase64 `json:"encoded_data"`
	}

	tests := []struct {
		encodedMessage   string
		expectedTestData testData
	}{
		{
			encodedMessage: "\"" + base64.RawURLEncoding.EncodeToString([]byte("test base64 data")) + "\"",
			expectedTestData: testData{
				StringData:  "test string",
				EncodedData: URLEncodedBase64("test base64 data"),
			},
		},
		{
			encodedMessage: "null",
			expectedTestData: testData{
				StringData:  "test string",
				EncodedData: nil,
			},
		},
	}

	for _, test := range tests {
		raw := fmt.Sprintf(`{"string_data": "test string", "encoded_data": %s}`, test.encodedMessage)
		got := testData{}

		t.Logf("%s\n", raw)

		require.NoError(t, json.NewDecoder(strings.NewReader(raw)).Decode(&got))

		assert.Equal(t, test.expectedTestData.EncodedData, got.EncodedData)
		assert.Equal(t, test.expectedTestData.StringData, got.StringData)
	}
}
