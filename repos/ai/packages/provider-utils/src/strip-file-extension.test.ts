import { describe, expect, it } from 'vitest';
import { stripFileExtension } from './strip-file-extension';

describe('stripFileExtension', () => {
  it('should strip the extension from a filename', () => {
    expect(stripFileExtension('report.pdf')).toBe('report');
  });

  it('should return the input when there is no extension', () => {
    expect(stripFileExtension('report')).toBe('report');
  });

  it('should strip all extension segments for multi-dot filenames', () => {
    expect(stripFileExtension('archive.tar.gz')).toBe('archive');
  });

  it('should strip a trailing dot', () => {
    expect(stripFileExtension('report.')).toBe('report');
  });
});
