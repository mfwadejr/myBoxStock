// SERVICES / signins / device — turn a browser User-Agent string into a short label like "Chrome on Mac".
export function describeDevice(ua = '') {
  const s = String(ua);
  const browser = /Edg\//.test(s) ? 'Edge' : /OPR\/|Opera/.test(s) ? 'Opera' : /Firefox\//.test(s) ? 'Firefox' : /Chrome\/|CriOS\//.test(s) ? 'Chrome' : /Safari\//.test(s) ? 'Safari' : /curl|node|undici/i.test(s) ? 'API client' : 'Browser';
  const os = /iPhone|iPad|iPod/.test(s) ? 'iPhone/iPad' : /Android/.test(s) ? 'Android' : /Windows/.test(s) ? 'Windows' : /Mac OS X|Macintosh/.test(s) ? 'Mac' : /Linux|X11/.test(s) ? 'Linux' : 'unknown device';
  return `${browser} on ${os}`;
}
