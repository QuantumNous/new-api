package jsplugin

import (
	"bytes"
	"context"
	"crypto"
	"crypto/hmac"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/hex"
	"encoding/pem"
	"errors"
	"fmt"
	"maps"
	"math"
	"net/url"
	"slices"
	"sort"
	"strings"
	"time"

	"github.com/Calcium-Ion/moejs"
	"github.com/MoeForge/moego/base64"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type volcSignRequest struct {
	Method    string            `json:"method"`
	URL       string            `json:"url"`
	Headers   map[string]string `json:"headers"`
	Body      string            `json:"body"`
	AccessKey string            `json:"accessKey"`
	SecretKey string            `json:"secretKey"`
	Region    string            `json:"region"`
	Service   string            `json:"service"`
	Timestamp int64             `json:"timestamp"`
}

// injectGlobals installs utils and console. currentCall returns the hook call
// running on runtime, or nil outside one; utils.fetch reads its fetcher and
// budget there, so no request data lives in the runtime's globals.
func injectGlobals(runtime *moejs.Runtime, identity func() string, now func() time.Time, logOutput func(string), currentCall func() *runtimeCall) error {
	r := runtime.Realm()
	jsonTools, err := namespaceObject(r, map[string]moejs.Value{
		"clone": runtime.Function("clone", 1, func(r *moejs.Realm, _ moejs.Value, args []moejs.Value) (moejs.Value, error) {
			if moejs.Arg(args, 0).IsUndefined() {
				return moejs.Undefined(), r.TypeError("json.clone requires a JSON value")
			}
			budget := &jsonStateBudget{ctx: context.Background(), bytes: MaxJSONToolBytes, nodes: maxJSONToolNodes, realm: r}
			value, err := newJSONStateNode(moejs.Arg(args, 0), 0, budget)
			if err != nil {
				var exception *moejs.Exception
				var interrupted *moejs.InterruptedError
				if errors.As(err, &exception) || errors.As(err, &interrupted) {
					return moejs.Undefined(), err
				}
				return moejs.Undefined(), r.TypeError("json.clone: %s", err)
			}
			return value.jsValue(r)
		}),
	})
	if err != nil {
		return err
	}
	utils, err := namespaceObject(r, map[string]moejs.Value{
		"fetch": runtime.Function("fetch", 1, func(r *moejs.Realm, _ moejs.Value, args []moejs.Value) (moejs.Value, error) {
			call := currentCall()
			if call == nil {
				return moejs.Undefined(), fmt.Errorf("utils.fetch is not available outside hooks")
			}
			return call.fetch(r, moejs.Arg(args, 0))
		}),
		"paramOverride": runtime.Function("paramOverride", 2, func(r *moejs.Realm, _ moejs.Value, args []moejs.Value) (moejs.Value, error) {
			call := currentCall()
			if call == nil {
				return moejs.Undefined(), fmt.Errorf("utils.paramOverride is not available outside hooks")
			}
			return call.paramOverride(r, moejs.Arg(args, 0), moejs.Arg(args, 1))
		}),
		"attachments": runtime.Function("attachments", 0, func(r *moejs.Realm, _ moejs.Value, _ []moejs.Value) (moejs.Value, error) {
			call := currentCall()
			if call == nil {
				return moejs.Undefined(), fmt.Errorf("utils.attachments is not available outside hooks")
			}
			return call.attachments(r)
		}),
		"media": runtime.Function("media", 1, func(r *moejs.Realm, _ moejs.Value, args []moejs.Value) (moejs.Value, error) {
			call := currentCall()
			if call == nil {
				return moejs.Undefined(), fmt.Errorf("utils.media is not available outside hooks")
			}
			return call.media(r, moejs.Arg(args, 0))
		}),
		"mediaText": runtime.Function("mediaText", 2, func(r *moejs.Realm, _ moejs.Value, args []moejs.Value) (moejs.Value, error) {
			call := currentCall()
			if call == nil {
				return moejs.Undefined(), fmt.Errorf("utils.mediaText is not available outside hooks")
			}
			return call.mediaText(r, moejs.Arg(args, 0), moejs.Arg(args, 1))
		}),
		"keywords": runtime.Function("keywords", 3, func(r *moejs.Realm, _ moejs.Value, args []moejs.Value) (moejs.Value, error) {
			call := currentCall()
			if call == nil {
				return moejs.Undefined(), fmt.Errorf("utils.keywords is not available outside hooks")
			}
			return call.keywords(r, moejs.Arg(args, 0), moejs.Arg(args, 1), moejs.Arg(args, 2))
		}),
		"hasCapability": runtime.Function("hasCapability", 1, func(r *moejs.Realm, _ moejs.Value, args []moejs.Value) (moejs.Value, error) {
			name, err := stringValue(r, moejs.Arg(args, 0))
			if err != nil {
				return moejs.Undefined(), err
			}
			return moejs.Bool(HasCapability(name)), nil
		}),
		"json": jsonTools,
		"unixNow": runtime.Function("unixNow", 0, func(*moejs.Realm, moejs.Value, []moejs.Value) (moejs.Value, error) {
			return moejs.Int(now().Unix()), nil
		}),
		"jwtSignHS256": runtime.Function("jwtSignHS256", 2, func(r *moejs.Realm, _ moejs.Value, args []moejs.Value) (moejs.Value, error) {
			var claims map[string]any
			if argument := moejs.Arg(args, 0); !argument.IsNullish() {
				exported, err := r.ToGoStrict(argument)
				if err != nil {
					return moejs.Undefined(), err
				}
				var ok bool
				if claims, ok = exported.(map[string]any); !ok {
					return moejs.Undefined(), r.TypeError("jwtSignHS256 claims must be an object")
				}
			}
			secret, err := stringValue(r, moejs.Arg(args, 1))
			if err != nil {
				return moejs.Undefined(), err
			}
			token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims(claims)).SignedString([]byte(secret))
			if err != nil {
				return moejs.Undefined(), err
			}
			return moejs.String(token), nil
		}),
		"sha256": runtime.Function("sha256", 1, func(r *moejs.Realm, _ moejs.Value, args []moejs.Value) (moejs.Value, error) {
			data, err := signingInput(r, "sha256", moejs.Arg(args, 0))
			if err != nil {
				return moejs.Undefined(), err
			}
			encoding, err := digestEncoding(r, "sha256", moejs.Arg(args, 1), "hex")
			if err != nil {
				return moejs.Undefined(), err
			}
			digest := sha256.Sum256(data)
			return encodeDigest(r, digest[:], encoding)
		}),
		"hmacSHA256": runtime.Function("hmacSHA256", 2, func(r *moejs.Realm, _ moejs.Value, args []moejs.Value) (moejs.Value, error) {
			message, err := signingInput(r, "hmacSHA256", moejs.Arg(args, 0))
			if err != nil {
				return moejs.Undefined(), err
			}
			key, err := signingInput(r, "hmacSHA256", moejs.Arg(args, 1))
			if err != nil {
				return moejs.Undefined(), err
			}
			encoding, err := digestEncoding(r, "hmacSHA256", moejs.Arg(args, 2), "hex")
			if err != nil {
				return moejs.Undefined(), err
			}
			mac := hmac.New(sha256.New, key)
			_, _ = mac.Write(message)
			return encodeDigest(r, mac.Sum(nil), encoding)
		}),
		"signRS256": runtime.Function("signRS256", 2, func(r *moejs.Realm, _ moejs.Value, args []moejs.Value) (moejs.Value, error) {
			// Error messages are fixed text: they never quote the key or
			// wrap a parser error that could describe its contents.
			data, err := signingInput(r, "signRS256", moejs.Arg(args, 0))
			if err != nil {
				return moejs.Undefined(), err
			}
			keyPEM, err := stringValue(r, moejs.Arg(args, 1))
			if err != nil {
				return moejs.Undefined(), err
			}
			encoding, err := digestEncoding(r, "signRS256", moejs.Arg(args, 2), "base64url")
			if err != nil {
				return moejs.Undefined(), err
			}
			if len(keyPEM) > maxPrivateKeyPEMBytes {
				return moejs.Undefined(), r.RangeError("utils.signRS256 private key PEM exceeds 16 KiB")
			}
			block, _ := pem.Decode([]byte(keyPEM))
			if block == nil {
				return moejs.Undefined(), r.TypeError("utils.signRS256 private key is not PEM text")
			}
			var key *rsa.PrivateKey
			switch block.Type {
			case "PRIVATE KEY":
				parsed, _ := x509.ParsePKCS8PrivateKey(block.Bytes)
				key, _ = parsed.(*rsa.PrivateKey)
			case "RSA PRIVATE KEY":
				key, _ = x509.ParsePKCS1PrivateKey(block.Bytes)
			default:
				return moejs.Undefined(), r.TypeError("utils.signRS256 requires a PRIVATE KEY or RSA PRIVATE KEY PEM block")
			}
			if key == nil {
				return moejs.Undefined(), r.TypeError("utils.signRS256 private key is not a valid RSA private key")
			}
			hashed := sha256.Sum256(data)
			signature, err := rsa.SignPKCS1v15(nil, key, crypto.SHA256, hashed[:])
			if err != nil {
				return moejs.Undefined(), r.TypeError("utils.signRS256 cannot sign with this RSA private key")
			}
			return encodeDigest(r, signature, encoding)
		}),
		"base64": runtime.Function("base64", 1, func(r *moejs.Realm, _ moejs.Value, args []moejs.Value) (moejs.Value, error) {
			value, err := stringValue(r, moejs.Arg(args, 0))
			if err != nil {
				return moejs.Undefined(), err
			}
			return moejs.String(base64.StdEncoding.EncodeToString([]byte(value))), nil
		}),
		"base64URL": runtime.Function("base64URL", 1, func(r *moejs.Realm, _ moejs.Value, args []moejs.Value) (moejs.Value, error) {
			value, err := stringValue(r, moejs.Arg(args, 0))
			if err != nil {
				return moejs.Undefined(), err
			}
			return moejs.String(base64.RawURLEncoding.EncodeToString([]byte(value))), nil
		}),
		"base64URLDecode": runtime.Function("base64URLDecode", 1, func(r *moejs.Realm, _ moejs.Value, args []moejs.Value) (moejs.Value, error) {
			value, err := stringValue(r, moejs.Arg(args, 0))
			if err != nil {
				return moejs.Undefined(), err
			}
			decoded, err := base64.RawURLEncoding.DecodeString(value)
			if err != nil {
				return moejs.Undefined(), err
			}
			return moejs.String(string(decoded)), nil
		}),
		"uuid": runtime.Function("uuid", 0, func(*moejs.Realm, moejs.Value, []moejs.Value) (moejs.Value, error) {
			return moejs.String(uuid.NewString()), nil
		}),
		"volcSignV4": runtime.Function("volcSignV4", 1, func(r *moejs.Realm, _ moejs.Value, args []moejs.Value) (moejs.Value, error) {
			// Fields are read by their Go names, as plugins have always
			// passed them.
			var request volcSignRequest
			argument := moejs.Arg(args, 0)
			if !argument.IsNullish() && !argument.IsObject() {
				return moejs.Undefined(), r.TypeError("volcSignV4 request must be an object")
			}
			if argument.IsObject() {
				object := argument.AsObject()
				fields := []struct {
					name   string
					target *string
				}{
					{"Method", &request.Method}, {"URL", &request.URL}, {"Body", &request.Body},
					{"AccessKey", &request.AccessKey}, {"SecretKey", &request.SecretKey},
					{"Region", &request.Region}, {"Service", &request.Service},
				}
				for _, field := range fields {
					value, err := object.GetProp(r, r.KeyFromGoString(field.name))
					if err != nil {
						return moejs.Undefined(), err
					}
					if *field.target, err = stringValue(r, value); err != nil {
						return moejs.Undefined(), err
					}
				}
				headers, err := object.GetProp(r, r.KeyFromGoString("Headers"))
				if err != nil {
					return moejs.Undefined(), err
				}
				if headers.IsObject() {
					keys, err := r.EnumerableOwnKeys(headers.AsObject())
					if err != nil {
						return moejs.Undefined(), err
					}
					request.Headers = make(map[string]string, len(keys))
					for _, key := range keys {
						value, err := headers.AsObject().GetProp(r, key)
						if err != nil {
							return moejs.Undefined(), err
						}
						if request.Headers[key.GoString()], err = stringValue(r, value); err != nil {
							return moejs.Undefined(), err
						}
					}
				}
				timestamp, err := object.GetProp(r, r.KeyFromGoString("Timestamp"))
				if err != nil {
					return moejs.Undefined(), err
				}
				if !timestamp.IsNullish() {
					seconds, err := r.ToNumber(timestamp)
					if err != nil {
						return moejs.Undefined(), err
					}
					if !math.IsNaN(seconds) && !math.IsInf(seconds, 0) {
						request.Timestamp = int64(seconds)
					}
				}
			}
			signed, err := signVolcV4(request, now)
			if err != nil {
				return moejs.Undefined(), err
			}
			return r.FromGo(signed)
		}),
	})
	if err != nil {
		return err
	}
	if err = runtime.SetGlobal("utils", utils); err != nil {
		return err
	}
	console, err := namespaceObject(r, map[string]moejs.Value{
		"log": runtime.Function("log", 0, func(r *moejs.Realm, _ moejs.Value, args []moejs.Value) (moejs.Value, error) {
			parts := make([]string, len(args))
			for i, argument := range args {
				if argument.IsSymbol() {
					parts[i] = argument.String()
					continue
				}
				text, err := r.ToString(argument)
				if err != nil {
					return moejs.Undefined(), err
				}
				parts[i] = text.GoString()
			}
			if logOutput != nil {
				logOutput(identity() + " " + strings.Join(parts, " "))
			}
			return moejs.Undefined(), nil
		}),
	})
	if err != nil {
		return err
	}
	return runtime.SetGlobal("console", console)
}

// namespaceObject builds a global namespace of host functions as a JavaScript
// object, members in name order. A Go map would be converted only when a hook
// first reads it, as part of that call's conversions, and the namespace would
// then keep that call's request data alive for the runtime's lifetime.
func namespaceObject(r *moejs.Realm, members map[string]moejs.Value) (moejs.Value, error) {
	object := r.NewObject()
	for _, name := range slices.Sorted(maps.Keys(members)) {
		if err := object.CreateDataPropertyOrThrow(r, r.KeyFromGoString(name), members[name]); err != nil {
			return moejs.Undefined(), err
		}
	}
	return r.FromGo(object)
}

// stringValue reads a host function's string parameter: undefined and null
// read as "", other values as JavaScript's String(value).
func stringValue(r *moejs.Realm, value moejs.Value) (string, error) {
	if value.IsNullish() {
		return "", nil
	}
	if value.IsString() {
		return value.AsString().GoString(), nil
	}
	text, err := r.ToString(value)
	if err != nil {
		return "", err
	}
	return text.GoString(), nil
}

// The signing utilities run to completion in Go, so they bound their own
// inputs: each data, message or key argument and the private key PEM.
const (
	maxSigningInputBytes  = 64 << 20
	maxPrivateKeyPEMBytes = 16 << 10
)

// signingInput reads a signing utility's byte parameter: an ArrayBuffer,
// SharedArrayBuffer, typed array or DataView as a copy of the bytes it holds
// or views, any other value as the UTF-8 bytes of stringValue. The copy keeps
// the bytes as they were when read, whatever later argument conversions do to
// the buffer.
func signingInput(r *moejs.Realm, function string, value moejs.Value) ([]byte, error) {
	if value.IsObject() {
		if data, ok := value.AsObject().BufferData(); ok {
			if len(data) > maxSigningInputBytes {
				return nil, r.RangeError("utils.%s input exceeds 64 MiB", function)
			}
			return bytes.Clone(data), nil
		}
	}
	text, err := stringValue(r, value)
	if err != nil {
		return nil, err
	}
	if len(text) > maxSigningInputBytes {
		return nil, r.RangeError("utils.%s input exceeds 64 MiB", function)
	}
	return []byte(text), nil
}

// digestEncoding reads a signing utility's output encoding: undefined is
// fallback, anything else must name hex, base64, base64url or bytes.
func digestEncoding(r *moejs.Realm, function string, value moejs.Value, fallback string) (string, error) {
	if value.IsUndefined() {
		return fallback, nil
	}
	name, err := stringValue(r, value)
	if err != nil {
		return "", err
	}
	switch name {
	case "hex", "base64", "base64url", "bytes":
		return name, nil
	}
	return "", r.TypeError("utils.%s encoding must be hex, base64, base64url or bytes", function)
}

// encodeDigest returns digest in an encoding digestEncoding accepted:
// lowercase hex, padded base64, unpadded base64url, or an ArrayBuffer for
// bytes.
func encodeDigest(r *moejs.Realm, digest []byte, encoding string) (moejs.Value, error) {
	switch encoding {
	case "base64":
		return moejs.String(base64.StdEncoding.EncodeToString(digest)), nil
	case "base64url":
		return moejs.String(base64.RawURLEncoding.EncodeToString(digest)), nil
	case "bytes":
		return r.FromGo(digest)
	}
	return moejs.String(hex.EncodeToString(digest)), nil
}

func signVolcV4(request volcSignRequest, now func() time.Time) (map[string]string, error) {
	parsedURL, err := url.Parse(request.URL)
	if err != nil || parsedURL.Host == "" {
		return nil, fmt.Errorf("invalid Volcengine signing URL")
	}
	region := request.Region
	if region == "" {
		region = "cn-north-1"
	}
	service := request.Service
	if service == "" {
		service = "cv"
	}
	timestamp := now().UTC()
	if request.Timestamp != 0 {
		timestamp = time.Unix(request.Timestamp, 0).UTC()
	}
	xDate := timestamp.Format("20060102T150405Z")
	shortDate := timestamp.Format("20060102")
	bodyHash := sha256.Sum256([]byte(request.Body))
	requestPath := parsedURL.EscapedPath()
	if requestPath == "" {
		requestPath = "/"
	}

	headers := make(map[string]string, len(request.Headers)+3)
	for name, value := range request.Headers {
		headers[strings.ToLower(name)] = strings.TrimSpace(value)
	}
	headers["host"] = parsedURL.Host
	headers["x-date"] = xDate
	headers["x-content-sha256"] = hex.EncodeToString(bodyHash[:])
	keys := make([]string, 0, len(headers))
	for name := range headers {
		keys = append(keys, name)
	}
	sort.Strings(keys)
	var canonicalHeaders strings.Builder
	for _, name := range keys {
		canonicalHeaders.WriteString(name)
		canonicalHeaders.WriteByte(':')
		canonicalHeaders.WriteString(headers[name])
		canonicalHeaders.WriteByte('\n')
	}
	signedHeaders := strings.Join(keys, ";")
	canonicalRequest := strings.Join([]string{
		strings.ToUpper(request.Method), requestPath, parsedURL.Query().Encode(),
		canonicalHeaders.String(), signedHeaders, hex.EncodeToString(bodyHash[:]),
	}, "\n")
	canonicalHash := sha256.Sum256([]byte(canonicalRequest))
	scope := fmt.Sprintf("%s/%s/%s/request", shortDate, region, service)
	stringToSign := fmt.Sprintf("HMAC-SHA256\n%s\n%s\n%s", xDate, scope, hex.EncodeToString(canonicalHash[:]))
	sign := func(key []byte, value string) []byte {
		mac := hmac.New(sha256.New, key)
		_, _ = mac.Write([]byte(value))
		return mac.Sum(nil)
	}
	signingKey := sign(sign(sign([]byte(request.SecretKey), shortDate), region), service)
	signingKey = sign(signingKey, "request")
	signature := hex.EncodeToString(sign(signingKey, stringToSign))
	return map[string]string{
		"Authorization":    fmt.Sprintf("HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s", request.AccessKey, scope, signedHeaders, signature),
		"X-Date":           xDate,
		"X-Content-Sha256": hex.EncodeToString(bodyHash[:]),
	}, nil
}
