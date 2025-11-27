export const IS_MOBILE = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.matchMedia('(max-width: 768px)').matches;
export const IS_ANDROID = /Android/i.test(navigator.userAgent);
export const IS_IOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
export const IS_SAFARI = /Safari/i.test(navigator.userAgent) && !/Chrome/i.test(navigator.userAgent);
export const IS_CHROME = /Chrome/i.test(navigator.userAgent);
export const IS_FIREFOX = /Firefox/i.test(navigator.userAgent);
export const IS_EDGE = /Edg/i.test(navigator.userAgent);
export const IS_WINDOWS = /Windows/i.test(navigator.userAgent);
export const IS_MACOS = /Macintosh|Mac OS X/i.test(navigator.userAgent);
export const IS_TELEGRAM = typeof window !== 'undefined' && !!(window as any).Telegram && !!(window as any).Telegram.WebApp;

console.log('Platform detection:', {
  mobile: IS_MOBILE,
  android: IS_ANDROID,
  ios: IS_IOS,
  safari: IS_SAFARI,
  chrome: IS_CHROME,
  firefox: IS_FIREFOX,
  edge: IS_EDGE,
  windows: IS_WINDOWS,
  macos: IS_MACOS,
  telegram: IS_TELEGRAM
});

