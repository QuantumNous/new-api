package oauth

import (
	"bytes"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/tidwall/gjson"
)

type casServiceResponseEnvelope struct {
	XMLName               xml.Name                  `xml:"serviceResponse"`
	AuthenticationSuccess *casAuthenticationSuccess `xml:"authenticationSuccess"`
	AuthenticationFailure *casAuthenticationFailure `xml:"authenticationFailure"`
}

type casAuthenticationSuccess struct {
	User                string        `xml:"user"`
	Attributes          casAttributes `xml:"attributes"`
	ProxyGrantingTicket string        `xml:"proxyGrantingTicket"`
	Proxies             []string      `xml:"proxies>proxy"`
}

type casAuthenticationFailure struct {
	Code    string `xml:"code,attr"`
	Message string `xml:",chardata"`
}

type casAttributes map[string]any

func (a *casAttributes) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	values := map[string]any{}
	for {
		token, err := d.Token()
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return err
		}

		switch elem := token.(type) {
		case xml.StartElement:
			var raw string
			if err := d.DecodeElement(&raw, &elem); err != nil {
				return err
			}
			name := strings.TrimSpace(elem.Name.Local)
			value := strings.TrimSpace(raw)
			if name == "" {
				continue
			}
			if existing, ok := values[name]; ok {
				switch typed := existing.(type) {
				case string:
					values[name] = []string{typed, value}
				case []string:
					values[name] = append(typed, value)
				}
				continue
			}
			values[name] = value
		case xml.EndElement:
			if elem.Name == start.Name {
				*a = casAttributes(values)
				return nil
			}
		}
	}
	*a = casAttributes(values)
	return nil
}

func parseTicketValidationClaims(body []byte) ([]byte, error) {
	trimmed := bytes.TrimSpace(body)
	if len(trimmed) == 0 {
		return nil, errors.New("ticket validation response is empty")
	}
	if trimmed[0] == '<' {
		return parseTicketValidationXML(trimmed)
	}
	return parseTicketValidationJSON(trimmed)
}

func parseTicketValidationJSON(body []byte) ([]byte, error) {
	var payload map[string]any
	if err := common.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("parse ticket validation json failed: %w", err)
	}
	if payload == nil {
		return nil, errors.New("ticket validation response is empty")
	}

	serviceResponse := map[string]any{}
	if raw, ok := payload["serviceResponse"].(map[string]any); ok {
		serviceResponse = raw
	} else {
		if success, ok := payload["authenticationSuccess"]; ok {
			serviceResponse["authenticationSuccess"] = success
		}
		if failure, ok := payload["authenticationFailure"]; ok {
			serviceResponse["authenticationFailure"] = failure
		}
	}

	if failure, ok := serviceResponse["authenticationFailure"]; ok {
		return nil, formatTicketValidationFailure(failure)
	}
	if len(serviceResponse) == 0 {
		return body, nil
	}

	normalized := map[string]any{
		"serviceResponse": serviceResponse,
	}
	if success, ok := serviceResponse["authenticationSuccess"]; ok {
		normalized["authenticationSuccess"] = success
	}
	if failure, ok := serviceResponse["authenticationFailure"]; ok {
		normalized["authenticationFailure"] = failure
	}
	claimsJSON, err := common.Marshal(normalized)
	if err != nil {
		return nil, fmt.Errorf("marshal ticket validation claims failed: %w", err)
	}
	return claimsJSON, nil
}

func parseTicketValidationXML(body []byte) ([]byte, error) {
	var envelope casServiceResponseEnvelope
	if err := xml.Unmarshal(body, &envelope); err != nil {
		return nil, fmt.Errorf("parse ticket validation xml failed: %w", err)
	}
	if envelope.AuthenticationFailure != nil {
		return nil, formatTicketValidationFailure(map[string]any{
			"code":    strings.TrimSpace(envelope.AuthenticationFailure.Code),
			"message": strings.TrimSpace(envelope.AuthenticationFailure.Message),
		})
	}
	if envelope.AuthenticationSuccess == nil {
		return nil, errors.New("ticket validation response missing authenticationSuccess")
	}

	success := map[string]any{
		"user": strings.TrimSpace(envelope.AuthenticationSuccess.User),
	}
	if len(envelope.AuthenticationSuccess.Attributes) > 0 {
		success["attributes"] = map[string]any(envelope.AuthenticationSuccess.Attributes)
	}
	if pgt := strings.TrimSpace(envelope.AuthenticationSuccess.ProxyGrantingTicket); pgt != "" {
		success["proxyGrantingTicket"] = pgt
	}
	if len(envelope.AuthenticationSuccess.Proxies) > 0 {
		success["proxies"] = envelope.AuthenticationSuccess.Proxies
	}

	normalized := map[string]any{
		"serviceResponse": map[string]any{
			"authenticationSuccess": success,
		},
		"authenticationSuccess": success,
	}
	claimsJSON, err := common.Marshal(normalized)
	if err != nil {
		return nil, fmt.Errorf("marshal ticket validation claims failed: %w", err)
	}
	return claimsJSON, nil
}

func formatTicketValidationFailure(raw any) error {
	switch typed := raw.(type) {
	case map[string]any:
		code := strings.TrimSpace(fmt.Sprint(typed["code"]))
		message := strings.TrimSpace(fmt.Sprint(typed["message"]))
		if message == "" {
			message = strings.TrimSpace(fmt.Sprint(typed["description"]))
		}
		if code != "" && message != "" {
			return fmt.Errorf("ticket validation failed: %s: %s", code, message)
		}
		if code != "" {
			return fmt.Errorf("ticket validation failed: %s", code)
		}
		if message != "" {
			return fmt.Errorf("ticket validation failed: %s", message)
		}
	case string:
		if message := strings.TrimSpace(typed); message != "" {
			return fmt.Errorf("ticket validation failed: %s", message)
		}
	}
	return errors.New("ticket validation failed")
}

func firstClaimValue(claimsJSON []byte, path string) string {
	values := extractClaimCandidates(claimsJSON, path)
	if len(values) == 0 {
		return ""
	}
	return values[0]
}

func extractClaimCandidates(claimsJSON []byte, path string) []string {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil
	}
	result := gjson.GetBytes(claimsJSON, path)
	if !result.Exists() {
		return nil
	}
	if result.IsArray() {
		candidates := make([]string, 0, len(result.Array()))
		for _, item := range result.Array() {
			value := strings.TrimSpace(item.String())
			if value != "" {
				candidates = append(candidates, value)
			}
		}
		return candidates
	}
	value := strings.TrimSpace(result.String())
	if value == "" {
		return nil
	}
	return []string{value}
}

func resolveMappedGroup(claimsJSON []byte, config *model.CustomOAuthProvider) string {
	return resolveMappedGroupCandidates(extractClaimCandidates(claimsJSON, config.GroupField), config)
}

func resolveMappedRole(claimsJSON []byte, config *model.CustomOAuthProvider) int {
	return resolveMappedRoleCandidates(extractClaimCandidates(claimsJSON, config.RoleField), config)
}

func parseStringMapping(raw string) map[string]string {
	payload := make(map[string]any)
	if strings.TrimSpace(raw) == "" {
		return map[string]string{}
	}
	if err := common.UnmarshalJsonStr(raw, &payload); err != nil {
		common.SysError("failed to parse custom auth mapping: " + err.Error())
		return map[string]string{}
	}
	result := make(map[string]string, len(payload))
	for key, value := range payload {
		trimmedKey := strings.TrimSpace(key)
		trimmedValue := strings.TrimSpace(fmt.Sprint(value))
		if trimmedKey == "" || trimmedValue == "" {
			continue
		}
		result[trimmedKey] = trimmedValue
	}
	return result
}

func isExistingGroup(group string) bool {
	group = strings.TrimSpace(group)
	if group == "" {
		return false
	}
	if setting.ContainsAutoGroup(group) {
		return true
	}
	_, ok := ratio_setting.GetGroupRatioCopy()[group]
	return ok
}
