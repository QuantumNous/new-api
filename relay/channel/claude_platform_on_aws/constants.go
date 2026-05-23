package claude_platform_on_aws

import (
	"github.com/QuantumNous/new-api/relay/channel/claude"
)

// ChannelName is used as the channel's log / identifier name.
const ChannelName = "claude-platform-on-aws"

// SigV4ServiceName is the AWS SigV4 service name for this endpoint.
// See: https://docs.aws.amazon.com/claude-platform/latest/userguide/making-requests.html
const SigV4ServiceName = "aws-external-anthropic"

// DefaultAnthropicVersion matches the value used by the first-party Anthropic API.
const DefaultAnthropicVersion = "2023-06-01"

// EndpointTemplate is the default region-rendered base URL.
// Used as a fallback when the channel's base URL is left empty.
const EndpointTemplate = "https://aws-external-anthropic.%s.api.aws"

// ModelList reuses the Claude channel's model list — Claude Platform on AWS
// publishes the exact same model IDs as the first-party Claude API.
var ModelList = claude.ModelList
