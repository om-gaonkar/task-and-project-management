import type { DeviceInfo, DeviceType } from './auth.types';

/**
 * Deliberately tiny. The result is only a label in the "your devices" list, so a full parser
 * (and its licence and weight) is not worth it. Order matters: Edge and Opera also say "Chrome".
 */
const BROWSERS: Array<[string, RegExp]> = [
  ['Edge', /Edg(?:e|A|iOS)?\/(\d+)/],
  ['Opera', /OPR\/(\d+)/],
  ['Firefox', /(?:Firefox|FxiOS)\/(\d+)/],
  ['Chrome', /(?:Chrome|CriOS)\/(\d+)/],
  ['Safari', /Version\/(\d+)[\d.]*.*Safari/],
];

const SYSTEMS: Array<[string, RegExp]> = [
  ['iOS', /iPhone|iPad|iPod/],
  ['Android', /Android/],
  ['Windows', /Windows/],
  ['macOS', /Mac OS X|Macintosh/],
  ['ChromeOS', /CrOS/],
  ['Linux', /Linux/],
];

function detectDeviceType(ua: string): DeviceType {
  if (/iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) return 'tablet';
  if (/Mobi|iPhone|iPod|Android/.test(ua)) return 'mobile';
  return 'desktop';
}

export function parseUserAgent(userAgent: string | undefined, ipAddress?: string): DeviceInfo {
  const ua = (userAgent ?? '').slice(0, 512);
  if (!ua) {
    return {
      userAgent: null,
      browser: null,
      os: null,
      deviceType: 'unknown',
      ipAddress: ipAddress ?? null,
    };
  }

  let browser: string | null = null;
  for (const [name, pattern] of BROWSERS) {
    const match = pattern.exec(ua);
    if (match) {
      browser = `${name} ${match[1]}`;
      break;
    }
  }

  const os = SYSTEMS.find(([, pattern]) => pattern.test(ua))?.[0] ?? null;

  return {
    userAgent: ua,
    browser,
    os,
    deviceType: detectDeviceType(ua),
    ipAddress: ipAddress ?? null,
  };
}
