package claude_platform_on_aws

import (
	"net/http"
	"strings"
	"testing"
	"time"
)

// Test vector taken from the AWS SigV4 official documentation:
// https://docs.aws.amazon.com/general/latest/gr/sigv4-signed-request-examples.html
// (GET ListUsers example for service "iam"). We reuse it because the Claude
// Platform on AWS endpoint is behind the same SigV4 algorithm — passing this
// vector guarantees the algorithm itself is correct.
//
// Request:
//
//	GET https://iam.amazonaws.com/?Action=ListUsers&Version=2010-05-08
//	Headers:
//	  Content-Type: application/x-www-form-urlencoded; charset=utf-8
//	  Host: iam.amazonaws.com
//	  X-Amz-Date: 20150830T123600Z
//	Body: empty
//
// Credentials:
//
//	AKIDEXAMPLE / wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY
//
// Service/region: iam / us-east-1
//
// Expected Authorization (per AWS docs):
//
//	AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/iam/aws4_request,
//	  SignedHeaders=content-type;host;x-amz-date,
//	  Signature=5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7
func TestSigV4_AWSReferenceVector(t *testing.T) {
	signTime, _ := time.Parse("20060102T150405Z", "20150830T123600Z")

	req, err := http.NewRequest(
		http.MethodGet,
		"https://iam.amazonaws.com/?Action=ListUsers&Version=2010-05-08",
		nil,
	)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded; charset=utf-8")

	creds := AwsCredentials{
		AccessKeyID:     "AKIDEXAMPLE",
		SecretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
	}

	if err := signRequestSigV4(req, nil, creds, "us-east-1", "iam", signTime); err != nil {
		t.Fatalf("sign: %v", err)
	}

	got := req.Header.Get("Authorization")
	want := "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/iam/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7"
	if got != want {
		t.Fatalf("unexpected authorization\n got:  %s\n want: %s", got, want)
	}

	if h := req.Header.Get("X-Amz-Date"); h != "20150830T123600Z" {
		t.Fatalf("X-Amz-Date = %q, want 20150830T123600Z", h)
	}
}

// Sanity test for our claude-platform-on-aws specific path.
func TestSigV4_ClaudePlatformOnAws_AddsRequiredHeaders(t *testing.T) {
	signTime := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	body := []byte(`{"model":"claude-sonnet-4-6","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}`)

	req, err := http.NewRequest(http.MethodPost, "https://aws-external-anthropic.us-west-2.api.aws/v1/messages", strings.NewReader(string(body)))
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("anthropic-workspace-id", "wrkspc_demo")

	creds := AwsCredentials{
		AccessKeyID:     "AKIDEXAMPLE",
		SecretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
		SessionToken:    "FQoGZX-token",
	}
	if err := signRequestSigV4(req, body, creds, "us-west-2", SigV4ServiceName, signTime); err != nil {
		t.Fatalf("sign: %v", err)
	}

	if got := req.Header.Get("X-Amz-Security-Token"); got != "FQoGZX-token" {
		t.Fatalf("X-Amz-Security-Token = %q, want FQoGZX-token", got)
	}
	if got := req.Header.Get("X-Amz-Date"); got != "20260102T030405Z" {
		t.Fatalf("X-Amz-Date = %q, want 20260102T030405Z", got)
	}
	auth := req.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20260102/us-west-2/"+SigV4ServiceName+"/aws4_request, ") {
		t.Fatalf("authorization prefix wrong: %q", auth)
	}
	// Signed headers must include host, the security token, content-type, and the anthropic-* headers.
	for _, want := range []string{"host", "x-amz-date", "x-amz-security-token", "content-type", "anthropic-version", "anthropic-workspace-id"} {
		if !strings.Contains(auth, want) {
			t.Fatalf("authorization missing signed header %q: %s", want, auth)
		}
	}
}

// TestParseSigV4ApiKey covers the accepted API key formats for SigV4
// authentication: two-part long-term credentials, three-part temporary
// credentials, and the malformed inputs that must be rejected.
func TestParseSigV4ApiKey(t *testing.T) {
	cases := []struct {
		name    string
		raw     string
		wantErr bool
		ak, sk  string
		token   string
	}{
		{name: "two parts", raw: "AKID|SECRET", ak: "AKID", sk: "SECRET"},
		{name: "three parts", raw: "AKID|SECRET|TOKEN", ak: "AKID", sk: "SECRET", token: "TOKEN"},
		{name: "single part invalid", raw: "AKID", wantErr: true},
		{name: "four parts invalid", raw: "a|b|c|d", wantErr: true},
		{name: "empty fields invalid", raw: "AKID|", wantErr: true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := parseSigV4ApiKey(tc.raw)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got.AccessKeyID != tc.ak || got.SecretAccessKey != tc.sk || got.SessionToken != tc.token {
				t.Fatalf("got %+v, want ak=%q sk=%q token=%q", got, tc.ak, tc.sk, tc.token)
			}
		})
	}
}

// TestCanonicalQuery exercises canonicalQuery against the SigV4 spec rules:
// empty query, already-sorted pairs, out-of-order pairs that must be
// re-sorted, repeated keys preserved in original value order, and
// percent-encoding of reserved characters such as space.
func TestCanonicalQuery(t *testing.T) {
	cases := []struct {
		in, out string
	}{
		{"", ""},
		{"a=1&b=2", "a=1&b=2"},
		{"b=2&a=1", "a=1&b=2"},
		{"a=1&a=2", "a=1&a=2"},
		{"key with space=value", "key%20with%20space=value"},
	}
	for _, tc := range cases {
		got := canonicalQuery(tc.in)
		if got != tc.out {
			t.Fatalf("canonicalQuery(%q) = %q, want %q", tc.in, got, tc.out)
		}
	}
}
