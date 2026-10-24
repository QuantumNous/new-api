package protocol

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
)

func decodeBody(body io.Reader, v any) (err error) {
	decoder := json.NewDecoder(body)

	if err = decoder.Decode(v); err != nil {
		return err
	}

	_, err = decoder.Token()

	if !errors.Is(err, io.EOF) {
		return errors.New("The body contains trailing data")
	}

	return nil
}

func decodeBytes(data []byte, v any) (err error) {
	decoder := json.NewDecoder(bytes.NewReader(data))

	if err = decoder.Decode(v); err != nil {
		return err
	}

	_, err = decoder.Token()

	if !errors.Is(err, io.EOF) {
		return errors.New("The body contains trailing data")
	}

	return nil
}
