package kitutil

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestMaskSensitiveInfoMasksOnlyTheUpstreamAddress(t *testing.T) {
	tests := []struct {
		name         string
		upstreamURLs []string
		input        string
		want         string
	}{
		{
			name:         "no upstream address leaves hosts readable but masks IPs",
			upstreamURLs: []string{"", ""},
			input:        `Post "https://api.upstream.example.com/v1/chat/completions": dial tcp 10.0.0.1:443: connect: connection refused`,
			want:         `Post "https://api.upstream.example.com/v1/chat/completions": dial tcp ***.***.***.***:443: connect: connection refused`,
		},
		{
			name:         "bracketed IPv6 addresses are masked without an upstream address",
			upstreamURLs: nil,
			input:        `dial tcp [2a01:4f8::1]:443: i/o timeout; lookup api.example.com on [::1]:53; dial tcp [fe80::1%eth0]:443; dial tcp [::ffff:10.0.0.1]:443; items[0] and [1:2] stay`,
			want:         `dial tcp [***]:443: i/o timeout; lookup api.example.com on [***]:53; dial tcp [***]:443; dial tcp [***]:443; items[0] and [1:2] stay`,
		},
		{
			name:         "IPv6 upstream base URL in a WebSocket dial error",
			upstreamURLs: []string{"http://[2001:db8::1]:8080"},
			input:        `dial failed to ws://[2001:db8::1]:8080/v1/realtime: dial tcp [2001:db8::1]:8080: connect: connection refused`,
			want:         `dial failed to ws://***:8080/***/***: dial tcp [***]:8080: connect: connection refused`,
		},
		{
			name:         "no upstream address still masks API key values",
			upstreamURLs: nil,
			input:        `invalid api_key:AIzaSyAAAaUooTUni8AdaOkSRMda30n_Q4vrV70`,
			want:         `invalid api_key:***`,
		},
		{
			name:         "query values carry credentials on any host",
			upstreamURLs: []string{"https://custom.base.example"},
			input:        `Post "https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=id-1&client_secret=secret-1": dial tcp: i/o timeout, see https://docs.example.org/errors?lang=en#retry`,
			want:         `Post "https://aip.baidubce.com/oauth/2.0/token?client_id=***&client_secret=***&grant_type=***": dial tcp: i/o timeout, see https://docs.example.org/errors?lang=***#retry`,
		},
		{
			name:         "parentheses inside a URL keep its query masked",
			upstreamURLs: nil,
			input:        `failed to download https://cdn.example/image(1).png?token=secret (status 403)`,
			want:         `failed to download https://cdn.example/image(1).png?token=*** (status 403)`,
		},
		{
			name:         "trailing parenthesis stays outside the masked URL",
			upstreamURLs: nil,
			input:        `(see https://cdn.example/a?sig)`,
			want:         `(see https://cdn.example/a?sig=***)`,
		},
		{
			name:         "mixed trailing punctuation and parentheses are trimmed together",
			upstreamURLs: nil,
			input:        `(https://cdn.example/a?token=1&sig). ('https://cdn.example/a?sig') (https://cdn.example/a?sig.)`,
			want:         `(https://cdn.example/a?sig=***&token=***). ('https://cdn.example/a?sig=***') (https://cdn.example/a?sig=***.)`,
		},
		{
			name:         "trailing parentheses on an upstream URL",
			upstreamURLs: []string{"https://wiki.upstream.example.com"},
			input:        `(see https://wiki.upstream.example.com/Go_(lang)?k=v)).`,
			want:         `(see https://***.com/***?k=***)).`,
		},
		{
			name:         "apostrophes inside a URL keep its query and userinfo masked",
			upstreamURLs: nil,
			input:        `failed to download https://cdn.example/John's-photo.png?token=secret from 'https://o'neil:pw@cdn.example/a?sig=1'`,
			want:         `failed to download https://cdn.example/John's-photo.png?token=*** from 'https://***@cdn.example/a?sig=***'`,
		},
		{
			name:         "userinfo is masked on any host",
			upstreamURLs: nil,
			input:        `downloading https://alice:secret@cdn.example/file.png and https://bob@cdn.example/a?sig=1`,
			want:         `downloading https://***@cdn.example/file.png and https://***@cdn.example/a?sig=***`,
		},
		{
			name:         "query values are masked without an upstream address",
			upstreamURLs: nil,
			input:        `request to https://generativelanguage.googleapis.com/v1beta/models?key=AIza-secret failed`,
			want:         `request to https://generativelanguage.googleapis.com/v1beta/models?key=*** failed`,
		},
		{
			name:         "upstream URL, its IP and other URLs",
			upstreamURLs: []string{"https://api.upstream.example.com/openai"},
			input:        `request to https://api.upstream.example.com/openai/v1/chat/completions?key=secret failed: dial tcp 10.0.0.1:443: i/o timeout, see https://docs.example.org/errors`,
			want:         `request to https://***.com/***/***/***/***?key=*** failed: dial tcp ***.***.***.***:443: i/o timeout, see https://docs.example.org/errors`,
		},
		{
			name:         "bare upstream host in a DNS error",
			upstreamURLs: []string{"https://API.Upstream.example.com"},
			input:        `dial tcp: lookup api.upstream.example.com: no such host`,
			want:         `dial tcp: lookup ***.***.***.com: no such host`,
		},
		{
			name:         "fully qualified base URL with a trailing dot",
			upstreamURLs: []string{"https://private.example.com./v1"},
			input:        `request to https://private.example.com./v1/responses failed: dial tcp: lookup private.example.com.: no such host`,
			want:         `request to https://***.com/***/*** failed: dial tcp: lookup ***.***.com.: no such host`,
		},
		{
			name:         "base URL saved without a scheme",
			upstreamURLs: []string{"relay.example.co.uk"},
			input:        `request to https://relay.example.co.uk/v1/messages failed: EOF`,
			want:         `request to https://***.co.uk/***/*** failed: EOF`,
		},
		{
			name:         "quoted URL keeps its delimiters and trailing punctuation",
			upstreamURLs: []string{"https://api.upstream.example.com"},
			input:        `Post "https://api.upstream.example.com/v1/chat/completions": EOF; retry https://api.upstream.example.com/v1/models.`,
			want:         `Post "https://***.com/***/***/***": EOF; retry https://***.com/***/***.`,
		},
		{
			name:         "port does not hide a country-code TLD",
			upstreamURLs: []string{"https://relay.example.co.uk:8443"},
			input:        `request to https://relay.example.co.uk:8443/v1/messages failed`,
			want:         `request to https://***.co.uk:8443/***/*** failed`,
		},
		{
			name:         "IP upstream host is fully masked",
			upstreamURLs: []string{"http://10.0.0.1:8080"},
			input:        `request to http://10.0.0.1:8080/v1/chat failed`,
			want:         `request to http://***.***.***.***:8080/***/*** failed`,
		},
		{
			name:         "requested origin of an absolute route besides the base URL",
			upstreamURLs: []string{"https://api.upstream.example.com", "wss://realtime.private.example.net"},
			input:        `dial failed to wss://realtime.private.example.net/v1/responses: dial tcp: lookup realtime.private.example.net: no such host`,
			want:         `dial failed to wss://***.net/***/***: dial tcp: lookup ***.***.***.net: no such host`,
		},
		{
			name:         "subdomain upstream is masked whole before its parent base host",
			upstreamURLs: []string{"https://api.example.com", "wss://tenant.api.example.com"},
			input:        `dial tcp: lookup tenant.api.example.com: no such host`,
			want:         `dial tcp: lookup ***.***.***.com: no such host`,
		},
		{
			name:         "other domains and dotted identifiers stay readable",
			upstreamURLs: []string{"https://api.upstream.example.com"},
			input:        `Unknown event response.output_text.delta from model gpt-4.1, contact support@example.org`,
			want:         `Unknown event response.output_text.delta from model gpt-4.1, contact support@example.org`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, MaskSensitiveInfo(tt.input, tt.upstreamURLs...))
		})
	}
}
