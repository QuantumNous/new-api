import { replacePortPlaceholder, resolveUrl } from '../src/server/open';

describe('plugin-open', () => {
  it('#replacePortPlaceholder - should replace port number correctly', () => {
    expect(replacePortPlaceholder('http://localhost:8080', 3000)).toEqual('http://localhost:8080');
    expect(replacePortPlaceholder('http://localhost:<port>', 3000)).toEqual(
      'http://localhost:3000',
    );
    expect(replacePortPlaceholder('http://localhost:<port>/path/', 3000)).toEqual(
      'http://localhost:3000/path/',
    );
  });

  it('#resolveUrl - should resolve URL correctly', () => {
    const baseUrl = 'http://localhost';
    expect(resolveUrl('https://example.com', baseUrl)).toEqual('https://example.com');
    expect(resolveUrl('https://example.com/foo', baseUrl)).toEqual('https://example.com/foo');
    expect(resolveUrl('https://example.com/foo.html', baseUrl)).toEqual(
      'https://example.com/foo.html',
    );
    expect(resolveUrl('/path/to/resource', baseUrl)).toEqual('http://localhost/path/to/resource');
    expect(resolveUrl('//localhost', baseUrl)).toEqual('http://localhost/');
    expect(resolveUrl('path', baseUrl)).toEqual('http://localhost/path');
  });
});
