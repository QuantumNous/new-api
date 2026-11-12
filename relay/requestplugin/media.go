package requestplugin

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"image"
	_ "image/gif"
	"image/jpeg"
	"image/png"
	"strings"

	"github.com/HugoSmits86/nativewebp"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/requestpatch"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/tidwall/gjson"
	"golang.org/x/image/draw"
	"golang.org/x/image/riff"
	"golang.org/x/image/vp8"
	"golang.org/x/image/vp8l"
	_ "golang.org/x/image/webp"
)

// Limits of media.reencode.
const (
	maxReencodeBytes  = 20 << 20
	maxReencodePixels = 40_000_000
)

// reencodeSlots bounds the re-encodes running at once in the process.
var reencodeSlots = make(chan struct{}, 4)

// inlineMedia is one inline media string of a JSON body: a base64 data URL,
// or the data of a Claude base64 source, a Gemini inline data part or a chat
// input_audio part, whose mime type or audio format is a sibling member.
type inlineMedia struct {
	// path is the JSON Pointer of the media string.
	path string
	// mimePath is the JSON Pointer of the sibling mime type member; empty
	// for a data URL and for input_audio.
	mimePath string
	mime     string
	// data is the base64 payload.
	data string
	// filename is the sibling filename member of a chat or Responses file.
	filename string
	// audio marks input_audio data, whose format names its mime type.
	audio bool
}

// size is the decoded byte length of the payload.
func (m inlineMedia) size() int {
	return len(m.data)*3/4 - strings.Count(m.data[max(0, len(m.data)-2):], "=")
}

// dimensions reads the pixel size of an image from its header; zero when the
// media is not an image the host decodes.
func (m inlineMedia) dimensions() (int, int) {
	if !strings.HasPrefix(m.mime, "image/") {
		return 0, 0
	}
	config, _, err := image.DecodeConfig(base64.NewDecoder(base64.StdEncoding, strings.NewReader(m.data)))
	if err != nil {
		return 0, 0
	}
	return config.Width, config.Height
}

// scanMedia finds the inline media of a JSON body and returns the body with
// each media string replaced by "[media:N]", the view a stage hook reads.
func scanMedia(body []byte) ([]byte, []inlineMedia) {
	if !bytes.Contains(body, []byte("base64")) && !bytes.Contains(body, []byte("nlineData")) && !bytes.Contains(body, []byte("nline_data")) && !bytes.Contains(body, []byte("input_audio")) {
		return body, nil
	}
	var view bytes.Buffer
	view.Grow(len(body))
	var media []inlineMedia
	walkMedia(gjson.ParseBytes(body), "", "", &view, &media)
	if len(media) == 0 {
		return body, nil
	}
	return view.Bytes(), media
}

func walkMedia(value gjson.Result, pointer, key string, view *bytes.Buffer, media *[]inlineMedia) {
	switch {
	case value.IsObject():
		mimeMember := ""
		if value.Get("type").Str == "base64" && value.Get("media_type").Type == gjson.String {
			mimeMember = "media_type"
		} else if key == "inlineData" || key == "inline_data" {
			for _, name := range []string{"mimeType", "mime_type"} {
				if value.Get(name).Type == gjson.String {
					mimeMember = name
				}
			}
		} else if key == "input_audio" && value.Get("format").Type == gjson.String {
			mimeMember = "format"
		}
		view.WriteByte('{')
		first := true
		own := len(*media)
		filename := ""
		value.ForEach(func(name, member gjson.Result) bool {
			if !first {
				view.WriteByte(',')
			}
			first = false
			view.WriteString(name.Raw)
			view.WriteByte(':')
			memberPointer := pointer + "/" + escapePointer(name.String())
			if mimeMember != "" && name.String() == "data" && member.Type == gjson.String {
				item := inlineMedia{path: memberPointer, mimePath: pointer + "/" + mimeMember, mime: value.Get(mimeMember).Str, data: member.Str}
				if mimeMember == "format" {
					item.mimePath, item.mime, item.audio = "", "audio/"+strings.ToLower(item.mime), true
				}
				writePlaceholder(view, media, item)
				return true
			}
			if name.String() == "filename" && member.Type == gjson.String {
				filename = member.Str
			}
			walkMedia(member, memberPointer, name.String(), view, media)
			return true
		})
		view.WriteByte('}')
		// A file's name is a sibling of its data URL.
		for index := own; filename != "" && index < len(*media); index++ {
			if item := &(*media)[index]; strings.LastIndexByte(item.path, '/') == len(pointer) && strings.HasPrefix(item.path, pointer) {
				item.filename = filename
			}
		}
	case value.IsArray():
		view.WriteByte('[')
		index := 0
		value.ForEach(func(_, item gjson.Result) bool {
			if index > 0 {
				view.WriteByte(',')
			}
			walkMedia(item, fmt.Sprintf("%s/%d", pointer, index), "", view, media)
			index++
			return true
		})
		view.WriteByte(']')
	case value.Type == gjson.String:
		if header, data, found := strings.Cut(value.Str, ","); found && strings.HasPrefix(header, "data:") && strings.HasSuffix(header, ";base64") {
			mime, _, _ := strings.Cut(strings.TrimPrefix(header, "data:"), ";")
			writePlaceholder(view, media, inlineMedia{path: pointer, mime: mime, data: data})
			return
		}
		view.WriteString(value.Raw)
	default:
		view.WriteString(value.Raw)
	}
}

func writePlaceholder(view *bytes.Buffer, media *[]inlineMedia, item inlineMedia) {
	fmt.Fprintf(view, `"[media:%d]"`, len(*media))
	*media = append(*media, item)
}

func escapePointer(token string) string {
	return strings.ReplaceAll(strings.ReplaceAll(token, "~", "~0"), "/", "~1")
}

// reencodeMedia decodes an inline image and encodes it again as a
// media.reencode effect asks. It returns the json.patch operations that
// replace the media string and its mime type, and the change for the public
// record; none when the new bytes are not smaller or the image is an
// animated GIF or over the limits.
func reencodeMedia(ctx context.Context, item inlineMedia, effect requestpatch.Effect) ([]requestpatch.Operation, *relaycommon.RequestPluginMediaChange, error) {
	if item.size() > maxReencodeBytes {
		return nil, nil, nil
	}
	select {
	case reencodeSlots <- struct{}{}:
	case <-ctx.Done():
		return nil, nil, ctx.Err()
	}
	defer func() { <-reencodeSlots }()

	raw, err := base64.StdEncoding.DecodeString(item.data)
	if err != nil {
		return nil, nil, fmt.Errorf("media %s is not valid base64", item.path)
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(raw))
	if err != nil {
		return nil, nil, fmt.Errorf("media %s is not a jpeg, png, gif or webp image", item.path)
	}
	if int64(config.Width)*int64(config.Height) > maxReencodePixels || format == "gif" && gifAnimated(raw) {
		return nil, nil, nil
	}
	// With a VP8X chunk the size read above is the canvas the chunk declares,
	// while the decoder decodes the frame at its own size: the two must agree
	// for the pixel bound to hold.
	if format == "webp" {
		if width, height, err := webpFrameSize(raw); err != nil || width != config.Width || height != config.Height {
			return nil, nil, fmt.Errorf("media %s cannot be decoded", item.path)
		}
	}
	if err = ctx.Err(); err != nil {
		return nil, nil, err
	}
	img, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return nil, nil, fmt.Errorf("media %s cannot be decoded", item.path)
	}
	bounds := img.Bounds()
	if longest := max(bounds.Dx(), bounds.Dy()); effect.MaxSide > 0 && longest > effect.MaxSide {
		width := max(1, bounds.Dx()*effect.MaxSide/longest)
		height := max(1, bounds.Dy()*effect.MaxSide/longest)
		scaled := image.NewNRGBA(image.Rect(0, 0, width, height))
		draw.CatmullRom.Scale(scaled, scaled.Bounds(), img, bounds, draw.Src, nil)
		img = scaled
	}
	opaque, known := img.(interface{ Opaque() bool })
	transparent := !known || !opaque.Opaque()
	target := effect.Format
	if target == "auto" {
		target = "jpeg"
		if transparent {
			target = "png"
		}
	}
	if err = ctx.Err(); err != nil {
		return nil, nil, err
	}
	var encoded bytes.Buffer
	switch target {
	case "jpeg":
		if transparent {
			canvas := image.NewRGBA(img.Bounds())
			draw.Draw(canvas, canvas.Bounds(), image.White, image.Point{}, draw.Src)
			draw.Draw(canvas, canvas.Bounds(), img, img.Bounds().Min, draw.Over)
			img = canvas
		}
		quality := effect.Quality
		if quality == 0 {
			quality = jpeg.DefaultQuality
		}
		err = jpeg.Encode(&encoded, img, &jpeg.Options{Quality: quality})
	case "png":
		err = png.Encode(&encoded, img)
	case "webp":
		// nativewebp writes lossless WebP only.
		err = nativewebp.Encode(&encoded, img, nil)
	default:
		return nil, nil, fmt.Errorf("format %q is not supported", effect.Format)
	}
	if err != nil {
		return nil, nil, fmt.Errorf("media %s cannot be encoded as %s", item.path, target)
	}
	if encoded.Len() >= len(raw) {
		return nil, nil, nil
	}

	mime := "image/" + target
	payload := base64.StdEncoding.EncodeToString(encoded.Bytes())
	if item.mimePath == "" {
		payload = "data:" + mime + ";base64," + payload
	}
	value, err := common.Marshal(payload)
	if err != nil {
		return nil, nil, err
	}
	ops := []requestpatch.Operation{{Op: "replace", Path: item.path, Value: value}}
	if item.mimePath != "" {
		mimeValue, err := common.Marshal(mime)
		if err != nil {
			return nil, nil, err
		}
		ops = append(ops, requestpatch.Operation{Op: "replace", Path: item.mimePath, Value: mimeValue})
	}
	return ops, &relaycommon.RequestPluginMediaChange{
		From:     relaycommon.RequestPluginMediaForm{Mime: item.mime, Bytes: len(raw)},
		To:       relaycommon.RequestPluginMediaForm{Mime: mime, Bytes: encoded.Len()},
		Lossless: target != "jpeg",
	}, nil
}

// webpFrameSize reads the size of a WebP image's frame from the header of
// its first VP8 or VP8L chunk.
func webpFrameSize(data []byte) (int, int, error) {
	_, chunks, err := riff.NewReader(bytes.NewReader(data))
	if err != nil {
		return 0, 0, err
	}
	for {
		id, length, chunk, err := chunks.Next()
		if err != nil {
			return 0, 0, err
		}
		switch id {
		case riff.FourCC{'V', 'P', '8', ' '}:
			decoder := vp8.NewDecoder()
			decoder.Init(chunk, int(length))
			header, err := decoder.DecodeFrameHeader()
			return header.Width, header.Height, err
		case riff.FourCC{'V', 'P', '8', 'L'}:
			config, err := vp8l.DecodeConfig(chunk)
			return config.Width, config.Height, err
		}
	}
}

// gifAnimated reports a GIF with more than one image. It walks the block
// structure without decoding any pixels.
func gifAnimated(data []byte) bool {
	if len(data) < 13 {
		return false
	}
	position := 13
	if data[10]&0x80 != 0 {
		position += 3 << (data[10]&7 + 1)
	}
	frames := 0
	for position < len(data) {
		switch data[position] {
		case 0x21: // extension: introducer and label, then data sub-blocks
			position += 2
		case 0x2C: // image descriptor
			if frames++; frames > 1 {
				return true
			}
			if position+10 > len(data) {
				return false
			}
			flags := data[position+9]
			position += 10
			if flags&0x80 != 0 {
				position += 3 << (flags&7 + 1)
			}
			position++ // LZW minimum code size
		default: // trailer
			return false
		}
		for position < len(data) && data[position] != 0 {
			position += int(data[position]) + 1
		}
		position++
	}
	return false
}
