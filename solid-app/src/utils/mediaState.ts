import { createMemo, createSignal } from 'solid-js';
import type { Accessor } from 'solid-js';

// Глобальный сигнал для принудительного обновления состояния медиа
const [mediaUpdateTrigger, setMediaUpdateTrigger] = createSignal(0);

export function triggerMediaUpdate() {
  setMediaUpdateTrigger(prev => prev + 1);
}

export function createMediaState(localStream: Accessor<MediaStream | null>) {
  const isAudioEnabled = createMemo(() => {
    // Подписываемся на триггер для принудительного обновления
    mediaUpdateTrigger();
    const stream = localStream();
    if (!stream) return false;
    const tracks = stream.getAudioTracks();
    return tracks.length > 0 && tracks.every(t => t.enabled);
  });

  const isVideoEnabled = createMemo(() => {
    // Подписываемся на триггер для принудительного обновления
    mediaUpdateTrigger();
    const stream = localStream();
    if (!stream) return false;
    const tracks = stream.getVideoTracks();
    return tracks.length > 0 && tracks.every(t => t.enabled);
  });

  return { isAudioEnabled, isVideoEnabled };
}




