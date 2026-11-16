package jsplugin

import (
	"context"
	"fmt"
	"io"

	"github.com/MoeForge/moejs"
)

// MaxMediaTextChars is the most text utils.mediaText returns for one
// attachment, in UTF-16 code units, and its default.
const MaxMediaTextChars = 128 << 10

// MediaSource is a stage hook's access to the attachments of its request:
// the inline media and multipart files a hook reads as "[media:N]" refs, and
// the files the body names by id or URL. utils.attachments, utils.media and
// utils.mediaText read it, and utils.fetch sends the refs a body names. The
// host sets one per hook call in TransformContext.Media; the bytes never
// reach JavaScript.
type MediaSource interface {
	// Attachments lists the request's attachments in body order.
	Attachments() []Attachment
	// Media describes the media ref names; false when ref is not one of
	// the call's.
	Media(ref string) (MediaInfo, bool)
	// MediaText reads the text of the media ref names, at most maxChars
	// UTF-16 code units; false when ref is not one of the call's.
	MediaText(ctx context.Context, ref string, maxChars int) (MediaText, bool)
	// FetchBody returns body with each JSON string that equals a ref of the
	// call replaced by that media's data URL, and its length; a nil reader
	// when body names no ref.
	FetchBody(body string) (io.Reader, int64, error)
}

// Attachment is one entry of utils.attachments. Ref is "" for a file that
// is not in the request: a file id, a file URL or a remote URL, which URL
// holds when the body gives one. Path is the JSON Pointer of the attachment
// in the body a hook reads, or the field name of a multipart file.
// Rewritable marks a text file a media.text effect may rewrite.
type Attachment struct {
	Ref        string
	Kind       string
	Mime       string
	Size       int
	Filename   string
	URL        string
	Path       string
	Rewritable bool
}

// MediaInfo is the result of utils.media; Width and Height are 0 when the
// media is not an image the host reads.
type MediaInfo struct {
	Kind       string
	Mime       string
	Size       int
	Filename   string
	Width      int
	Height     int
	Rewritable bool
}

// MediaText is the result of utils.mediaText: Text, cut short when
// Truncated, or the reason the text was not read in Unchecked.
type MediaText struct {
	Text      string
	Truncated bool
	Unchecked string
}

type jsMember struct {
	name  string
	value moejs.Value
}

// plainObject builds a JavaScript object, not a host map, so a hook may
// return it or keep it.
func plainObject(r *moejs.Realm, members ...jsMember) (moejs.Value, error) {
	object := r.NewObject()
	for _, member := range members {
		if err := object.CreateDataPropertyOrThrow(r, r.KeyFromGoString(member.name), member.value); err != nil {
			return moejs.Undefined(), err
		}
	}
	return r.FromGo(object)
}

func (c *runtimeCall) mediaSource() MediaSource {
	if c.transform == nil {
		return nil
	}
	return c.transform.Media
}

// attachments is utils.attachments().
func (c *runtimeCall) attachments(r *moejs.Realm) (moejs.Value, error) {
	if c.transform == nil {
		return moejs.Undefined(), fmt.Errorf("utils.attachments is available in request processing hooks only")
	}
	var items []moejs.Value
	if source := c.mediaSource(); source != nil {
		for _, attachment := range source.Attachments() {
			members := make([]jsMember, 0, 7)
			if attachment.Ref != "" {
				members = append(members, jsMember{"ref", moejs.String(attachment.Ref)})
			}
			members = append(members, jsMember{"kind", moejs.String(attachment.Kind)}, jsMember{"mime", moejs.String(attachment.Mime)})
			if attachment.Ref != "" {
				members = append(members, jsMember{"size", moejs.Int(int64(attachment.Size))})
			}
			if attachment.Filename != "" {
				members = append(members, jsMember{"filename", moejs.String(attachment.Filename)})
			}
			if attachment.URL != "" {
				members = append(members, jsMember{"url", moejs.String(attachment.URL)})
			}
			members = append(members, jsMember{"path", moejs.String(attachment.Path)})
			if attachment.Rewritable {
				members = append(members, jsMember{"rewritable", moejs.Bool(true)})
			}
			item, err := plainObject(r, members...)
			if err != nil {
				return moejs.Undefined(), err
			}
			items = append(items, item)
		}
	}
	return r.FromGo(r.NewArrayFromSlice(items))
}

// media is utils.media(ref).
func (c *runtimeCall) media(r *moejs.Realm, refArgument moejs.Value) (moejs.Value, error) {
	if c.transform == nil {
		return moejs.Undefined(), fmt.Errorf("utils.media is available in request processing hooks only")
	}
	ref, err := stringValue(r, refArgument)
	if err != nil {
		return moejs.Undefined(), err
	}
	source := c.mediaSource()
	if source == nil {
		return moejs.Null(), nil
	}
	info, ok := source.Media(ref)
	if !ok {
		return moejs.Null(), nil
	}
	members := []jsMember{{"kind", moejs.String(info.Kind)}, {"mime", moejs.String(info.Mime)}, {"size", moejs.Int(int64(info.Size))}}
	if info.Filename != "" {
		members = append(members, jsMember{"filename", moejs.String(info.Filename)})
	}
	if info.Width > 0 && info.Height > 0 {
		members = append(members, jsMember{"width", moejs.Int(int64(info.Width))}, jsMember{"height", moejs.Int(int64(info.Height))})
	}
	if info.Rewritable {
		members = append(members, jsMember{"rewritable", moejs.Bool(true)})
	}
	return plainObject(r, members...)
}

// mediaText is utils.mediaText(ref, {maxChars?}). Reading a document runs in
// Go with the call's clock stopped and its slot lent out, as utils.fetch
// waits.
func (c *runtimeCall) mediaText(r *moejs.Realm, refArgument, optionsArgument moejs.Value) (moejs.Value, error) {
	if c.transform == nil {
		return moejs.Undefined(), fmt.Errorf("utils.mediaText is available in request processing hooks only")
	}
	ref, err := stringValue(r, refArgument)
	if err != nil {
		return moejs.Undefined(), err
	}
	maxChars := MaxMediaTextChars
	if !optionsArgument.IsNullish() {
		if !optionsArgument.IsObject() {
			return moejs.Undefined(), r.TypeError("utils.mediaText options must be an object")
		}
		value, err := optionsArgument.AsObject().GetProp(r, r.KeyFromGoString("maxChars"))
		if err != nil {
			return moejs.Undefined(), err
		}
		if !value.IsUndefined() {
			number, err := r.ToNumber(value)
			if err != nil {
				return moejs.Undefined(), err
			}
			if number != float64(int(number)) || number < 1 || number > MaxMediaTextChars {
				return moejs.Undefined(), r.RangeError("utils.mediaText maxChars must be an integer from 1 to %d", MaxMediaTextChars)
			}
			maxChars = int(number)
		}
	}
	source := c.mediaSource()
	if source == nil {
		return moejs.Null(), nil
	}
	var text MediaText
	found := false
	if interrupted := c.offSlot(r, "utils.mediaText", func() {
		text, found = source.MediaText(c.ctx, ref, maxChars)
	}); interrupted != nil {
		return moejs.Undefined(), interrupted
	}
	if !found {
		return moejs.Null(), nil
	}
	if text.Unchecked != "" {
		return plainObject(r, jsMember{"unchecked", moejs.String(text.Unchecked)})
	}
	return plainObject(r, jsMember{"text", moejs.String(text.Text)}, jsMember{"truncated", moejs.Bool(text.Truncated)})
}

// offSlot runs work, which waits or computes in Go, with the call's
// JavaScript clock stopped and its execution slot lent to other calls. It
// returns the interrupt that ended the call meanwhile, nil when the call
// goes on.
func (c *runtimeCall) offSlot(r *moejs.Realm, function string, work func()) error {
	if !c.watchdog.pause() {
		// The call timed out or its caller left; the interrupt ends it.
		return r.CheckInterrupt()
	}
	c.yieldSlot()
	work()
	if !c.reclaimSlot() {
		// JavaScript must not run without a slot, and a thrown error could be
		// caught; interrupting discards the runtime as a timeout does.
		cause := context.Cause(c.ctx)
		if cause == nil {
			cause = fmt.Errorf("plugin call could not resume after %s: %w", function, ErrCallAdmissionTimeout)
		}
		c.runtime.Interrupt(cause)
		return r.CheckInterrupt()
	}
	c.watchdog.resume()
	return r.CheckInterrupt()
}
