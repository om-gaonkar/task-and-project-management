import { describe, expect, it } from 'vitest';
import { parseUserAgent } from '../../modules/auth/user-agent';

const CASES = [
  {
    name: 'Chrome on Windows',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    expected: { browser: 'Chrome 126', os: 'Windows', deviceType: 'desktop' },
  },
  {
    name: 'Edge, which also says Chrome',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.2592.81',
    expected: { browser: 'Edge 126', os: 'Windows', deviceType: 'desktop' },
  },
  {
    name: 'Firefox on Linux',
    ua: 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
    expected: { browser: 'Firefox 127', os: 'Linux', deviceType: 'desktop' },
  },
  {
    name: 'Safari on iPhone',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    expected: { browser: 'Safari 17', os: 'iOS', deviceType: 'mobile' },
  },
  {
    name: 'Chrome on an Android tablet',
    ua: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    expected: { browser: 'Chrome 126', os: 'Android', deviceType: 'tablet' },
  },
  {
    name: 'Chrome on an Android phone',
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    expected: { browser: 'Chrome 126', os: 'Android', deviceType: 'mobile' },
  },
];

describe('parseUserAgent', () => {
  it.each(CASES)('recognises $name', ({ ua, expected }) => {
    expect(parseUserAgent(ua, '203.0.113.9')).toMatchObject({
      ...expected,
      ipAddress: '203.0.113.9',
    });
  });

  it('copes with a missing or unrecognisable header', () => {
    expect(parseUserAgent(undefined)).toEqual({
      userAgent: null,
      browser: null,
      os: null,
      deviceType: 'unknown',
      ipAddress: null,
    });
    expect(parseUserAgent('curl/8.5.0')).toMatchObject({
      browser: null,
      os: null,
      deviceType: 'desktop',
    });
  });

  it('truncates absurdly long headers', () => {
    expect(parseUserAgent('a'.repeat(5000)).userAgent).toHaveLength(512);
  });
});
