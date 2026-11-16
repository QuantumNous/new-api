package common

import (
	"context"
	"encoding/binary"
	"fmt"
	"io"
	"strings"

	"github.com/abema/go-mp4"
	"github.com/go-audio/aiff"
	"github.com/go-audio/wav"
	"github.com/jfreymuth/oggvorbis"
	"github.com/mewkiz/flac"
	"github.com/pkg/errors"
	"github.com/tcolgate/mp3"
	"github.com/yapingcat/gomedia/go-codec"
)

// GetAudioDuration Gets the duration (in seconds) of an audio file using a pure Go library.
// It no longer relies on external ffmpeg or ffprobe programs.
func GetAudioDuration(ctx context.Context, f io.ReadSeeker, ext string) (duration float64, err error) {
	SysLog(LogText("GetAudioDuration: ext=%s", ext))
	ext = strings.ToLower(ext)
	// Select parser based on file extension
	switch ext {
	case ".mp3":
		duration, err = getMP3Duration(f)
	case ".wav":
		duration, err = getWAVDuration(f)
	case ".flac":
		duration, err = getFLACDuration(f)
	case ".m4a", ".mp4":
		duration, err = getM4ADuration(f)
	case ".ogg", ".oga", ".opus":
		duration, err = getOGGDuration(f)
		if err != nil {
			duration, err = getOpusDuration(f)
		}
	case ".aiff", ".aif", ".aifc":
		duration, err = getAIFFDuration(f)
	case ".webm":
		duration, err = getWebMDuration(f)
	case ".aac":
		duration, err = getAACDuration(f)
	default:
		return 0, fmt.Errorf("unsupported audio format: %s", ext)
	}
	SysLog(LogText("GetAudioDuration: duration=%f", duration))
	return duration, err
}

// getMP3Duration Parses an MP3 file to get the duration.
// NOTE: For VBR (Variable Bitrate) MP3s, this estimate may not be completely accurate, but is usually good enough.
// FFmpeg scans the entire file to get an exact value in this case, but the library here provides a quick estimate.
func getMP3Duration(r io.Reader) (float64, error) {
	d := mp3.NewDecoder(r)
	var f mp3.Frame
	skipped := 0
	duration := 0.0

	for {
		if err := d.Decode(&f, &skipped); err != nil {
			if err == io.EOF {
				break
			}
			return 0, errors.Wrap(err, "failed to decode mp3 frame")
		}
		duration += f.Duration().Seconds()
	}
	return duration, nil
}

// getWAVDuration Parses the WAV file header to get the duration.
func getWAVDuration(r io.ReadSeeker) (float64, error) {
	// 1. Forced reset of pointer
	r.Seek(0, io.SeekStart)

	dec := wav.NewDecoder(r)

	// IsValidFile will read the fmt block
	if !dec.IsValidFile() {
		return 0, errors.New("invalid wav file")
	}

	// Try to find the data block
	if err := dec.FwdToPCM(); err != nil {
		return 0, errors.Wrap(err, "failed to find PCM data chunk")
	}

	pcmSize := int64(dec.PCMSize)

	// If the read Size is 0, try to use the file size to infer
	if pcmSize == 0 {
		// Get total file size
		currentPos, _ := r.Seek(0, io.SeekCurrent) // Currently usually after the data chunk header
		endPos, _ := r.Seek(0, io.SeekEnd)
		fileSize := endPos

		// Restore position (although it doesn't matter if you don't continue reading)
		r.Seek(currentPos, io.SeekStart)

		// Data area size ≈ total file size - current pointer position (i.e. Header size)
		// Note: After FwdToPCM is successful, CurrentPos should just point to the beginning of the data in the Data area.
		// Or after Data Chunk ID + Size.
		// WAV Header is generally 44 bytes.
		if fileSize > 44 {
			// If FwdToPCM succeeds, the Reader should be at the beginning of the data block
			// So all the remaining bytes are theoretically audio data
			pcmSize = fileSize - currentPos

			// A simple summary: If the calculation is still negative or 0, it is forced to be calculated according to the file size - 44
			if pcmSize <= 0 {
				pcmSize = fileSize - 44
			}
		}
	}

	numChans := int64(dec.NumChans)
	bitDepth := int64(dec.BitDepth)
	sampleRate := float64(dec.SampleRate)

	if sampleRate == 0 || numChans == 0 || bitDepth == 0 {
		return 0, errors.New("invalid wav header metadata")
	}

	bytesPerFrame := numChans * (bitDepth / 8)
	if bytesPerFrame == 0 {
		return 0, errors.New("invalid byte depth calculation")
	}

	totalFrames := pcmSize / bytesPerFrame

	durationSeconds := float64(totalFrames) / sampleRate
	return durationSeconds, nil
}

// getFLACDuration Parses the STREAMINFO block of a FLAC file.
func getFLACDuration(r io.Reader) (float64, error) {
	stream, err := flac.Parse(r)
	if err != nil {
		return 0, errors.Wrap(err, "failed to parse flac stream")
	}
	defer stream.Close()

	// Duration = total number of samples / sampling rate
	duration := float64(stream.Info.NSamples) / float64(stream.Info.SampleRate)
	return duration, nil
}

// getM4ADuration Parses the 'mvhd' box for M4A/MP4 files.
func getM4ADuration(r io.ReadSeeker) (float64, error) {
	// The go-mp4 library requires the ReadSeeker interface
	info, err := mp4.Probe(r)
	if err != nil {
		return 0, errors.Wrap(err, "failed to probe m4a/mp4 file")
	}
	// Duration = Duration / Timescale
	return float64(info.Duration) / float64(info.Timescale), nil
}

// getOGGDuration Parses an OGG/Vorbis file to get the duration.
func getOGGDuration(r io.ReadSeeker) (float64, error) {
	// reset reader to beginning
	if _, err := r.Seek(0, io.SeekStart); err != nil {
		return 0, errors.Wrap(err, "failed to seek ogg file")
	}

	reader, err := oggvorbis.NewReader(r)
	if err != nil {
		return 0, errors.Wrap(err, "failed to create ogg vorbis reader")
	}

	// Calculation time = total number of samples / sampling rate
	// Need to read the entire file to get the total number of samples
	channels := reader.Channels()
	sampleRate := reader.SampleRate()

	// Estimation method: read to the end of the file
	var totalSamples int64
	buf := make([]float32, 4096*channels)
	for {
		n, err := reader.Read(buf)
		if err == io.EOF {
			break
		}
		if err != nil {
			return 0, errors.Wrap(err, "failed to read ogg samples")
		}
		totalSamples += int64(n / channels)
	}

	duration := float64(totalSamples) / float64(sampleRate)
	return duration, nil
}

// getOpusDuration Parses an Opus file (in an OGG container) to get the duration.
func getOpusDuration(r io.ReadSeeker) (float64, error) {
	// Opus is usually packaged in an OGG container
	// We need to parse the OGG page to get the duration information
	if _, err := r.Seek(0, io.SeekStart); err != nil {
		return 0, errors.Wrap(err, "failed to seek opus file")
	}

	// Read OGG page header
	var totalGranulePos int64
	buf := make([]byte, 27) // OGG page header minimum size

	for {
		n, err := r.Read(buf)
		if err == io.EOF {
			break
		}
		if err != nil {
			return 0, errors.Wrap(err, "failed to read opus/ogg page")
		}
		if n < 27 {
			break
		}

		// Check OGG page identifier "OggS"
		if string(buf[0:4]) != "OggS" {
			// Skip some bytes and continue searching
			if _, err := r.Seek(-26, io.SeekCurrent); err != nil {
				break
			}
			continue
		}

		// Read granule position (bytes 6-13, little endian)
		granulePos := int64(binary.LittleEndian.Uint64(buf[6:14]))
		if granulePos > totalGranulePos {
			totalGranulePos = granulePos
		}

		// Read segment table size
		numSegments := int(buf[26])
		segmentTable := make([]byte, numSegments)
		if _, err := io.ReadFull(r, segmentTable); err != nil {
			break
		}

		// Calculate page data size and skip
		var pageSize int
		for _, segSize := range segmentTable {
			pageSize += int(segSize)
		}
		if _, err := r.Seek(int64(pageSize), io.SeekCurrent); err != nil {
			break
		}
	}

	// The sampling rate of Opus is fixed at 48000 Hz
	duration := float64(totalGranulePos) / 48000.0
	return duration, nil
}

// getAIFFDuration Parses the AIFF file header to get the duration.
func getAIFFDuration(r io.ReadSeeker) (float64, error) {
	if _, err := r.Seek(0, io.SeekStart); err != nil {
		return 0, errors.Wrap(err, "failed to seek aiff file")
	}

	dec := aiff.NewDecoder(r)
	if !dec.IsValidFile() {
		return 0, errors.New("invalid aiff file")
	}

	d, err := dec.Duration()
	if err != nil {
		return 0, errors.Wrap(err, "failed to get aiff duration")
	}

	return d.Seconds(), nil
}

// getWebMDuration Parses a WebM file to get the duration.
// WebM uses Matroska container format
func getWebMDuration(r io.ReadSeeker) (float64, error) {
	if _, err := r.Seek(0, io.SeekStart); err != nil {
		return 0, errors.Wrap(err, "failed to seek webm file")
	}

	// Parsing WebM/Matroska files is more complicated
	// A simplified implementation is provided here to read the EBML header
	// For full WebM parsing, it may be necessary to use specialized libraries

	// Simple implementation: find Duration element
	// The Element ID for WebM Duration is 0x4489
	// This is a simplified version and may not work with all WebM files
	buf := make([]byte, 8192)
	n, err := r.Read(buf)
	if err != nil && err != io.EOF {
		return 0, errors.Wrap(err, "failed to read webm file")
	}

	// Try to find the Duration element (this is a simplified approach)
	// Actual WebM parsing requires a full EBML parser
	// An error is returned here, it is recommended to use a specialized library
	if n > 0 {
		// Check EBML Identity
		if len(buf) >= 4 && binary.BigEndian.Uint32(buf[0:4]) == 0x1A45DFA3 {
			// This is a valid EBML file
			// But complete parsing requires more complex logic
			return 0, errors.New("webm duration parsing requires full EBML parser (consider using ffprobe for webm files)")
		}
	}

	return 0, errors.New("failed to parse webm file")
}

// getAACDuration Parses an AAC (ADTS format) file to get the duration.
// Use gomedia library to parse AAC ADTS frames
func getAACDuration(r io.ReadSeeker) (float64, error) {
	if _, err := r.Seek(0, io.SeekStart); err != nil {
		return 0, errors.Wrap(err, "failed to seek aac file")
	}

	// Read the entire file content
	data, err := io.ReadAll(r)
	if err != nil {
		return 0, errors.Wrap(err, "failed to read aac file")
	}

	var totalFrames int64
	var sampleRate int

	// Use gomedia’s SplitAACFrame function to split AAC frames
	codec.SplitAACFrame(data, func(aac []byte) {
		// Parse ADTS header to obtain sample rate information
		if len(aac) >= 7 {
			// Use ConvertADTSToASC to obtain audio configuration information
			asc, err := codec.ConvertADTSToASC(aac)
			if err == nil && sampleRate == 0 {
				sampleRate = codec.AACSampleIdxToSample(int(asc.Sample_freq_index))
			}
			totalFrames++
		}
	})

	if sampleRate == 0 || totalFrames == 0 {
		return 0, errors.New("no valid aac frames found")
	}

	// Each AAC ADTS frame contains 1024 samples
	totalSamples := totalFrames * 1024
	duration := float64(totalSamples) / float64(sampleRate)
	return duration, nil
}
