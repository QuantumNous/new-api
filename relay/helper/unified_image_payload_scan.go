package helper

import (
	"bufio"
	"fmt"
	"io"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

const (
	unifiedImageScanBufferSize = 32 << 10
	unifiedImageScanMaxDepth   = 64
	unifiedImageScanMaxKey     = 256
	unifiedImageScanMaxString  = 8192
)

type unifiedImageJSONScanner struct {
	reader *bufio.Reader
}

func scanUnifiedImagePayload(reader io.Reader) (bool, error) {
	scanner := &unifiedImageJSONScanner{
		reader: bufio.NewReaderSize(reader, unifiedImageScanBufferSize),
	}
	first, err := scanner.peekNonSpace()
	if err != nil {
		return false, err
	}
	if first != '{' {
		return false, fmt.Errorf("image generation payload must be a JSON object")
	}
	imageIntent, err := scanner.scanImageObject(0)
	if err != nil || imageIntent {
		return imageIntent, err
	}
	if trailing, err := scanner.readNonSpace(); err != io.EOF {
		if err != nil {
			return false, err
		}
		return false, fmt.Errorf("unexpected trailing JSON byte %q", trailing)
	}
	return false, nil
}

func (scanner *unifiedImageJSONScanner) scanImageObject(depth int) (bool, error) {
	if depth > unifiedImageScanMaxDepth {
		return false, fmt.Errorf("image generation payload exceeds maximum JSON depth %d", unifiedImageScanMaxDepth)
	}
	if err := scanner.expectByte('{'); err != nil {
		return false, err
	}
	if next, err := scanner.peekNonSpace(); err != nil {
		return false, err
	} else if next == '}' {
		_, _ = scanner.readNonSpace()
		return false, nil
	}

	seen := make(map[string]struct{})
	for {
		key, err := scanner.readJSONString(unifiedImageScanMaxKey)
		if err != nil {
			return false, err
		}
		if err := scanner.expectByte(':'); err != nil {
			return false, err
		}

		canonical, sensitive := canonicalImageIntentKey(key)
		if !sensitive {
			if err := scanner.skipJSONValue(); err != nil {
				return false, err
			}
		} else {
			if key != canonical {
				return true, nil
			}
			if _, exists := seen[canonical]; exists {
				return true, nil
			}
			seen[canonical] = struct{}{}

			var imageIntent bool
			switch canonical {
			case "model":
				imageIntent, err = scanner.scanImageModel()
			case "modalities", "responseModalities", "response_modalities":
				imageIntent, err = scanner.scanImageModalities(depth + 1)
			case "tools":
				imageIntent, err = scanner.scanImageTools(depth + 1)
			case "imageConfig", "image_config":
				imageIntent, err = scanner.scanConfiguredValue()
			case "generationConfig", "generation_config", "extra_body", "extraBody", "google":
				imageIntent, err = scanner.scanImageContainer(depth + 1)
			}
			if err != nil {
				return false, err
			}
			if imageIntent {
				return true, nil
			}
		}

		delimiter, err := scanner.readNonSpace()
		if err != nil {
			return false, err
		}
		switch delimiter {
		case '}':
			return false, nil
		case ',':
			continue
		default:
			return false, fmt.Errorf("invalid JSON object delimiter %q", delimiter)
		}
	}
}

func (scanner *unifiedImageJSONScanner) scanImageModel() (bool, error) {
	next, err := scanner.peekNonSpace()
	if err != nil {
		return false, err
	}
	if next != '"' {
		return false, scanner.skipJSONValue()
	}
	model, err := scanner.readJSONString(unifiedImageScanMaxString)
	if err != nil {
		return false, err
	}
	return isImageGenerationModel(model), nil
}

func (scanner *unifiedImageJSONScanner) scanImageModalities(depth int) (bool, error) {
	if depth > unifiedImageScanMaxDepth {
		return false, fmt.Errorf("image generation payload exceeds maximum JSON depth %d", unifiedImageScanMaxDepth)
	}
	next, err := scanner.peekNonSpace()
	if err != nil {
		return false, err
	}
	if next == '"' {
		value, err := scanner.readJSONString(128)
		return strings.EqualFold(strings.TrimSpace(value), "image"), err
	}
	if next != '[' {
		return false, scanner.skipJSONValue()
	}
	if err := scanner.expectByte('['); err != nil {
		return false, err
	}
	if next, err := scanner.peekNonSpace(); err != nil {
		return false, err
	} else if next == ']' {
		_, _ = scanner.readNonSpace()
		return false, nil
	}
	for {
		item, err := scanner.peekNonSpace()
		if err != nil {
			return false, err
		}
		if item == '"' {
			value, err := scanner.readJSONString(128)
			if err != nil {
				return false, err
			}
			if strings.EqualFold(strings.TrimSpace(value), "image") {
				return true, nil
			}
		} else if err := scanner.skipJSONValue(); err != nil {
			return false, err
		}

		delimiter, err := scanner.readNonSpace()
		if err != nil {
			return false, err
		}
		switch delimiter {
		case ']':
			return false, nil
		case ',':
			continue
		default:
			return false, fmt.Errorf("invalid JSON array delimiter %q", delimiter)
		}
	}
}

func (scanner *unifiedImageJSONScanner) scanImageTools(depth int) (bool, error) {
	if depth > unifiedImageScanMaxDepth {
		return false, fmt.Errorf("image generation payload exceeds maximum JSON depth %d", unifiedImageScanMaxDepth)
	}
	next, err := scanner.peekNonSpace()
	if err != nil {
		return false, err
	}
	if next == '{' {
		return scanner.scanImageToolObject(depth)
	}
	if next != '[' {
		return false, scanner.skipJSONValue()
	}
	if err := scanner.expectByte('['); err != nil {
		return false, err
	}
	if next, err := scanner.peekNonSpace(); err != nil {
		return false, err
	} else if next == ']' {
		_, _ = scanner.readNonSpace()
		return false, nil
	}
	for {
		item, err := scanner.peekNonSpace()
		if err != nil {
			return false, err
		}
		var imageIntent bool
		switch item {
		case '{':
			imageIntent, err = scanner.scanImageToolObject(depth + 1)
		case '[':
			imageIntent, err = scanner.scanImageTools(depth + 1)
		default:
			err = scanner.skipJSONValue()
		}
		if err != nil {
			return false, err
		}
		if imageIntent {
			return true, nil
		}

		delimiter, err := scanner.readNonSpace()
		if err != nil {
			return false, err
		}
		switch delimiter {
		case ']':
			return false, nil
		case ',':
			continue
		default:
			return false, fmt.Errorf("invalid JSON array delimiter %q", delimiter)
		}
	}
}

func (scanner *unifiedImageJSONScanner) scanImageToolObject(depth int) (bool, error) {
	if depth > unifiedImageScanMaxDepth {
		return false, fmt.Errorf("image generation payload exceeds maximum JSON depth %d", unifiedImageScanMaxDepth)
	}
	if err := scanner.expectByte('{'); err != nil {
		return false, err
	}
	if next, err := scanner.peekNonSpace(); err != nil {
		return false, err
	} else if next == '}' {
		_, _ = scanner.readNonSpace()
		return false, nil
	}

	seenType := false
	for {
		key, err := scanner.readJSONString(unifiedImageScanMaxKey)
		if err != nil {
			return false, err
		}
		if err := scanner.expectByte(':'); err != nil {
			return false, err
		}
		if strings.EqualFold(key, "type") {
			if key != "type" || seenType {
				return true, nil
			}
			seenType = true
			next, err := scanner.peekNonSpace()
			if err != nil {
				return false, err
			}
			if next == '"' {
				value, err := scanner.readJSONString(128)
				if err != nil {
					return false, err
				}
				if strings.EqualFold(strings.TrimSpace(value), "image_generation") {
					return true, nil
				}
			} else if err := scanner.skipJSONValue(); err != nil {
				return false, err
			}
		} else if err := scanner.skipJSONValue(); err != nil {
			return false, err
		}

		delimiter, err := scanner.readNonSpace()
		if err != nil {
			return false, err
		}
		switch delimiter {
		case '}':
			return false, nil
		case ',':
			continue
		default:
			return false, fmt.Errorf("invalid JSON object delimiter %q", delimiter)
		}
	}
}

func (scanner *unifiedImageJSONScanner) scanConfiguredValue() (bool, error) {
	next, err := scanner.peekNonSpace()
	if err != nil {
		return false, err
	}
	if next != 'n' {
		return true, nil
	}
	value, err := scanner.readJSONPrimitive(16)
	if err != nil {
		return false, err
	}
	return strings.TrimSpace(value) != "null", nil
}

func (scanner *unifiedImageJSONScanner) scanImageContainer(depth int) (bool, error) {
	if depth > unifiedImageScanMaxDepth {
		return false, fmt.Errorf("image generation payload exceeds maximum JSON depth %d", unifiedImageScanMaxDepth)
	}
	next, err := scanner.peekNonSpace()
	if err != nil {
		return false, err
	}
	if next != '{' {
		return false, scanner.skipJSONValue()
	}
	return scanner.scanImageObject(depth)
}

func (scanner *unifiedImageJSONScanner) skipJSONValue() error {
	first, err := scanner.readNonSpace()
	if err != nil {
		return err
	}
	switch first {
	case '"':
		return scanner.skipJSONStringAfterQuote()
	case '{', '[':
		return scanner.skipJSONComposite(first)
	default:
		for {
			value, err := scanner.reader.ReadByte()
			if err == io.EOF {
				return nil
			}
			if err != nil {
				return err
			}
			if value == ',' || value == '}' || value == ']' || isJSONWhitespace(value) {
				return scanner.reader.UnreadByte()
			}
		}
	}
}

func (scanner *unifiedImageJSONScanner) skipJSONComposite(first byte) error {
	stack := []byte{first}
	inString := false
	escaped := false
	for len(stack) > 0 {
		value, err := scanner.reader.ReadByte()
		if err != nil {
			return err
		}
		if inString {
			if escaped {
				escaped = false
				continue
			}
			if value == '\\' {
				escaped = true
				continue
			}
			if value == '"' {
				inString = false
			}
			continue
		}
		switch value {
		case '"':
			inString = true
		case '{', '[':
			if len(stack) >= unifiedImageScanMaxDepth {
				return fmt.Errorf("image generation payload exceeds maximum JSON depth %d", unifiedImageScanMaxDepth)
			}
			stack = append(stack, value)
		case '}':
			if stack[len(stack)-1] != '{' {
				return fmt.Errorf("invalid JSON object closing delimiter")
			}
			stack = stack[:len(stack)-1]
		case ']':
			if stack[len(stack)-1] != '[' {
				return fmt.Errorf("invalid JSON array closing delimiter")
			}
			stack = stack[:len(stack)-1]
		}
	}
	return nil
}

func (scanner *unifiedImageJSONScanner) readJSONString(limit int) (string, error) {
	if err := scanner.expectByte('"'); err != nil {
		return "", err
	}
	raw := make([]byte, 0, min(limit+2, 128))
	if limit > 0 {
		raw = append(raw, '"')
	}
	escaped := false
	tooLong := false
	for {
		value, err := scanner.reader.ReadByte()
		if err != nil {
			return "", err
		}
		if limit > 0 && !tooLong {
			if len(raw) < limit+1 {
				raw = append(raw, value)
			} else {
				tooLong = true
			}
		}
		if escaped {
			escaped = false
			continue
		}
		if value == '\\' {
			escaped = true
			continue
		}
		if value == '"' {
			break
		}
	}
	if limit == 0 || tooLong {
		return "", nil
	}
	var decoded string
	if err := common.Unmarshal(raw, &decoded); err != nil {
		return "", err
	}
	return decoded, nil
}

func (scanner *unifiedImageJSONScanner) skipJSONStringAfterQuote() error {
	escaped := false
	for {
		value, err := scanner.reader.ReadByte()
		if err != nil {
			return err
		}
		if escaped {
			escaped = false
			continue
		}
		if value == '\\' {
			escaped = true
			continue
		}
		if value == '"' {
			return nil
		}
	}
}

func (scanner *unifiedImageJSONScanner) readJSONPrimitive(limit int) (string, error) {
	var value strings.Builder
	for {
		char, err := scanner.reader.ReadByte()
		if err == io.EOF {
			return value.String(), nil
		}
		if err != nil {
			return "", err
		}
		if char == ',' || char == '}' || char == ']' || isJSONWhitespace(char) {
			if err := scanner.reader.UnreadByte(); err != nil {
				return "", err
			}
			return value.String(), nil
		}
		if value.Len() < limit {
			value.WriteByte(char)
		}
	}
}

func (scanner *unifiedImageJSONScanner) expectByte(expected byte) error {
	actual, err := scanner.readNonSpace()
	if err != nil {
		return err
	}
	if actual != expected {
		return fmt.Errorf("expected JSON byte %q, got %q", expected, actual)
	}
	return nil
}

func (scanner *unifiedImageJSONScanner) peekNonSpace() (byte, error) {
	value, err := scanner.readNonSpace()
	if err != nil {
		return 0, err
	}
	if err := scanner.reader.UnreadByte(); err != nil {
		return 0, err
	}
	return value, nil
}

func (scanner *unifiedImageJSONScanner) readNonSpace() (byte, error) {
	for {
		value, err := scanner.reader.ReadByte()
		if err != nil {
			return 0, err
		}
		if !isJSONWhitespace(value) {
			return value, nil
		}
	}
}

func isJSONWhitespace(value byte) bool {
	return value == ' ' || value == '\t' || value == '\n' || value == '\r'
}
