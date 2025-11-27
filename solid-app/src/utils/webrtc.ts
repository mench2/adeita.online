import { IS_IOS, IS_SAFARI, IS_ANDROID, IS_TELEGRAM, IS_FIREFOX } from './detection';

// STUN серверы - для прямого соединения (секретное подключение)
export const stunOnlyServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' }
];

// TURN серверы - для подключения через сервер
export const turnServers = [
  { urls: 'turn:95.81.117.141:3478', username: 'adeita', credential: 'TeFmLD44bTHMQeyuWgyFcB0fuRnuS3QklMb3ObxHPQM=' },
  { urls: 'turns:95.81.117.141:5349', username: 'adeita', credential: 'TeFmLD44bTHMQeyuWgyFcB0fuRnuS3QklMb3ObxHPQM=' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turns:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' }
];

// Полный набор серверов (STUN + TURN)
export const stunServers = [...stunOnlyServers, ...turnServers];

// Функция для получения серверов в зависимости от режима
export function getIceServers(directOnly: boolean): RTCIceServer[] {
  if (directOnly) {
    console.log('🔒 Используется секретное подключение (только STUN)');
    return stunOnlyServers;
  } else {
    console.log('🌐 Используется подключение через сервер (STUN + TURN)');
    return stunServers;
  }
}

export const videoQualitySettings = {
  high: { width: 1920, height: 1080, frameRate: 30 },
  medium: { width: 1280, height: 720, frameRate: 30 },
  low: { width: 640, height: 480, frameRate: 15 }
};

export function createPeerConnectionConfig(participantCount: number, directOnly: boolean = false): RTCConfiguration {
  let iceCandidatePoolSize = 10;
  if (participantCount >= 4) {
    iceCandidatePoolSize = 3;
  } else if (participantCount >= 3) {
    iceCandidatePoolSize = 5;
  }

  let config: RTCConfiguration = {
    iceServers: getIceServers(directOnly),
    iceCandidatePoolSize: iceCandidatePoolSize,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceTransportPolicy: 'all',
    iceConnectionReceivingTimeout: participantCount >= 4 ? 15000 : 20000,
    iceBackupCandidatePairPingInterval: 2000,
    continualGatheringPolicy: participantCount >= 4 ? 'gather_once' : 'gather_continually',
    sdpSemantics: 'unified-plan',
    iceGatheringTimeout: participantCount >= 4 ? 10000 : 15000
  };

  if (IS_IOS || IS_SAFARI) {
    config.iceCandidatePoolSize = 5;
    config.iceConnectionReceivingTimeout = 25000;
    config.iceGatheringTimeout = 20000;
  }

  if (IS_ANDROID && IS_TELEGRAM) {
    config.iceCandidatePoolSize = 8;
    config.iceConnectionReceivingTimeout = 18000;
  }

  if (IS_FIREFOX) {
    config.iceCandidatePoolSize = 12;
    config.iceConnectionReceivingTimeout = 22000;
  }

  return config;
}

export async function getVideoDeviceIdByFacing(preferFacing: 'user' | 'environment'): Promise<string | null> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videos = devices.filter(d => d.kind === 'videoinput');
    if (videos.length === 0) return null;
    const preferNeedle = preferFacing === 'environment' ? ['back', 'rear', 'environment'] : ['front', 'user'];
    const altNeedle = preferFacing === 'environment' ? ['front', 'user'] : ['back', 'rear', 'environment'];
    const byNeedle = (arr: string[]) => videos.find(v => (v.label || '').toLowerCase().includes(arr[0]) || (v.label || '').toLowerCase().includes(arr[1]) || (v.label || '').toLowerCase().includes(arr[2] || ''));
    const preferred = byNeedle(preferNeedle);
    if (preferred) return preferred.deviceId;
    const alt = byNeedle(altNeedle);
    if (alt) return alt.deviceId;
    return videos[0].deviceId;
  } catch (e) {
    console.warn('enumerateDevices failed:', e);
    return null;
  }
}

