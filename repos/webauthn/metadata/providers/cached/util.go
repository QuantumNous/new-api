package cached

import (
	"io"
	"os"

	"github.com/go-webauthn/webauthn/metadata"
	"github.com/go-webauthn/webauthn/metadata/providers/memory"
)

func doTruncateCopyAndSeekStart(f *os.File, rc io.ReadCloser) (err error) {
	if err = f.Truncate(0); err != nil {
		return err
	}

	if _, err = io.Copy(f, rc); err != nil {
		return err
	}

	if _, err = f.Seek(0, io.SeekStart); err != nil {
		return err
	}

	return rc.Close()
}

func doOpenOrCreate(name string) (f *os.File, created bool, err error) {
	if f, err = os.OpenFile(name, os.O_RDWR, 0); err == nil {
		return f, false, nil
	}

	if os.IsNotExist(err) {
		if f, err = os.Create(name); err != nil {
			return nil, false, err
		}

		return f, true, nil
	}

	return nil, false, err
}

func defaultNew(mds *metadata.Metadata) (provider metadata.Provider, err error) {
	return memory.New(
		memory.WithMetadata(mds.ToMap()),
		memory.WithValidateEntry(true),
		memory.WithValidateEntryPermitZeroAAGUID(false),
		memory.WithValidateTrustAnchor(true),
		memory.WithValidateStatus(true),
	)
}
