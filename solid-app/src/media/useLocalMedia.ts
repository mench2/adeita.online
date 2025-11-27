import { createSignal, onCleanup, Accessor } from 'solid-js';
import { IS_MOBILE, IS_ANDROID, IS_IOS, IS_SAFARI, IS_FIREFOX, IS_EDGE, IS_TELEGRAM } from '../utils/detection';
import { videoQualitySettings, getVideoDeviceIdByFacing } from '../utils/webrtc';
import { showNotification } from '../utils/notifications';
import * as peersStore from '../stores/peersStore';
import * as appStore from '../stores/appStore';

export function createLocalMedia() {
  const [localStream, setLocalStream] = createSignal<MediaStream | null>(null);
  const [flashlightEnabled, setFlashlightEnabled] = createSignal(false);
  const [currentVideoQuality, setCurrentVideoQuality] = createSignal<keyof typeof videoQualitySettings>('medium');

  const torchAux: {
    stream: MediaStream | null;
    track: MediaStreamTrack | null;
    videoEl: HTMLVideoElement | null;
  } = { stream: null, track: null, videoEl: null };

  const getFacing = () => {
    try { return (localStream()?.getVideoTracks()[0]?.getSettings().facingMode as any) ?? null; } catch { return null; }
  };

  const enableTorchOnCurrentTrack = async () => {
    const track = localStream()?.getVideoTracks()[0];
    if (!track) return false;
    const caps: any = (track as any).getCapabilities?.();
    if (!caps || !('torch' in caps)) return false;
    try { await (track as any).applyConstraints({ advanced: [{ torch: true }] }); return true; } catch { return false; }
  };

  const disableTorchOnCurrentTrack = async () => {
    const track = localStream()?.getVideoTracks()[0];
    if (!track) return false;
    const caps: any = (track as any).getCapabilities?.();
    if (!caps || !('torch' in caps)) return false;
    try { await (track as any).applyConstraints({ advanced: [{ torch: false }] }); return true; } catch { return false; }
  };

  const ensureAuxTorch = async () => {
    if (torchAux.track && torchAux.stream) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { exact: 'environment' },
          width: { ideal: 160, max: 320 },
          height: { ideal: 120, max: 240 },
          frameRate: { ideal: 5, max: 10 },
          advanced: [{ torch: false }]
        }
      });
      const track = stream.getVideoTracks()[0];
      const caps: any = (track as any).getCapabilities?.();
      if (!caps || !('torch' in caps)) {
        stream.getTracks().forEach(t => t.stop());
        return false;
      }
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.setAttribute('playsinline', '');
      v.style.position = 'fixed'; v.style.width = '1px'; v.style.height = '1px'; v.style.opacity = '0'; v.style.pointerEvents = 'none';
      document.body.appendChild(v);
      v.srcObject = stream; try { await v.play(); } catch {}
      torchAux.stream = stream; torchAux.track = track; torchAux.videoEl = v;
      return true;
    } catch {
      return false;
    }
  };

  const enableAuxTorch = async () => {
    if (!torchAux.track) return false;
    try { await (torchAux.track as any).applyConstraints({ advanced: [{ torch: true }] }); return true; } catch { return false; }
  };

  const disableAuxTorch = async () => {
    try { await (torchAux.track as any)?.applyConstraints?.({ advanced: [{ torch: false }] }); } catch {}
    try { torchAux.stream?.getTracks().forEach(t => t.stop()); } catch {}
    try { torchAux.videoEl?.pause(); } catch {}
    if (torchAux.videoEl?.parentNode) torchAux.videoEl.parentNode.removeChild(torchAux.videoEl);
    torchAux.stream = null; torchAux.track = null; torchAux.videoEl = null;
  };

  const applyWhiteBg = (on: boolean) => {
    const videoSection = document.querySelector('.video-section');
    const wrap = document.querySelector('.wrap');
    if (on) {
      videoSection?.classList.add('flashlight-on');
      document.body.classList.add('flashlight-bg');
      wrap?.classList.add('flashlight-bg');
    } else {
      videoSection?.classList.remove('flashlight-on');
      document.body.classList.remove('flashlight-bg');
      wrap?.classList.remove('flashlight-bg');
    }
  };

  const updateFlashlightForFacing = async () => {
    if (!flashlightEnabled()) return;
    const facing = getFacing();
    if (facing === 'environment') {
      let ok = await enableTorchOnCurrentTrack();
      if (!ok) ok = (await ensureAuxTorch()) && (await enableAuxTorch());
      if (ok) applyWhiteBg(false); else applyWhiteBg(true);
    } else {
      await disableTorchOnCurrentTrack();
      await disableAuxTorch();
      applyWhiteBg(true);
    }
  };

  const toggleFlashlight = async () => {
    const enabled = !flashlightEnabled();
    
    if (!enabled) {
      // Выключаем фонарик
      await disableTorchOnCurrentTrack();
      await disableAuxTorch();
      applyWhiteBg(false);
      setFlashlightEnabled(false);
      return;
    }
    
    // Включаем фонарик
    setFlashlightEnabled(true);
    await updateFlashlightForFacing();
  };

  async function getLocalStream(quality: keyof typeof videoQualitySettings = 'medium') {
    try {
      const participantCount = 1 + peersStore.peers().size;
      let videoConstraints: MediaTrackConstraints;
      
      if (participantCount >= 4) {
        videoConstraints = {
          width: { ideal: 480, max: 640 },
          height: { ideal: 360, max: 480 },
          frameRate: { ideal: 15, max: 20 },
          facingMode: { ideal: 'user' }
        };
      } else if (participantCount >= 3) {
        videoConstraints = {
          width: { ideal: 640, max: 800 },
          height: { ideal: 480, max: 600 },
          frameRate: { ideal: 20, max: 25 },
          facingMode: { ideal: 'user' }
        };
      } else {
        videoConstraints = {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: { ideal: 'user' }
        };
      }
      
      let constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        },
        video: videoConstraints
      };

      if (IS_IOS || IS_SAFARI) {
        constraints.video = {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 24, max: 30 },
          facingMode: { ideal: 'user' }
        };
        constraints.audio = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        };
      }

      if (IS_ANDROID && IS_TELEGRAM) {
        constraints.video = {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 15, max: 24 },
          facingMode: { ideal: 'user' }
        };
      }

      if (IS_FIREFOX) {
        constraints.video = {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          facingMode: { ideal: 'user' }
        };
      }

      if (IS_EDGE) {
        constraints.video = {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30 },
          facingMode: { ideal: 'user' }
        };
      }

      console.log('Requesting media with platform-specific constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      setCurrentVideoQuality(quality);
      appStore.setError(null);
      console.log('Local stream obtained successfully');
      return stream;
    } catch (e) {
      console.error('Failed to get local stream:', e);
      if (IS_ANDROID && IS_TELEGRAM) {
        try {
          console.log('Trying audio-only fallback for Android');
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          setLocalStream(audioStream);
          showNotification('Подключен только микрофон (камера недоступна)');
          return audioStream;
        } catch (audioError) {
          console.error('Audio fallback also failed:', audioError);
        }
      }
      appStore.setError(`Нет доступа к камере/микрофону: ${(e as Error).name || String(e)}`);
      setLocalStream(null);
      throw e;
    }
  }

  const swapCamera = async () => {
    try {
      const current = localStream()?.getVideoTracks()[0]?.getSettings().facingMode as any;
      const next = current === 'environment' ? 'user' : 'environment';
      const constraints = videoQualitySettings[currentVideoQuality()] || videoQualitySettings.medium;
      const deviceId = await getVideoDeviceIdByFacing(next);
      const video = deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: constraints.width }, height: { ideal: constraints.height }, frameRate: { ideal: constraints.frameRate } }
        : { facingMode: { ideal: next }, width: { ideal: constraints.width }, height: { ideal: constraints.height }, frameRate: { ideal: constraints.frameRate } };
      const newStream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
      const newVideo = newStream.getVideoTracks()[0];
      const newAudio = newStream.getAudioTracks()[0];
      for (const [, peer] of peersStore.peers().entries()) {
        const vs = peer.pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (vs) await vs.replaceTrack(newVideo);
        const as = peer.pc.getSenders().find(s => s.track && s.track.kind === 'audio');
        if (as && newAudio) await as.replaceTrack(newAudio);
      }
      localStream()?.getTracks().forEach(t => t.stop());
      setLocalStream(newStream);
      await updateFlashlightForFacing();
    } catch (e) {
      showNotification('Не удалось переключить камеру');
      console.warn(e);
    }
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        audio: true
      });
      stream.getVideoTracks()[0].onended = () => stopScreenShare();
      for (const [, peer] of peersStore.peers().entries()) {
        const sender = peer.pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) sender.replaceTrack(stream.getVideoTracks()[0]);
      }
      appStore.setScreenStream(stream);
      appStore.setIsScreenSharing(true);
    } catch (error) {
      console.error('Error starting screen share:', error);
      showNotification('Не удалось начать демонстрацию экрана');
    }
  };

  const stopScreenShare = async () => {
    try {
      if (appStore.screenStream()) {
        appStore.screenStream()!.getTracks().forEach(t => t.stop());
        appStore.setScreenStream(null);
      }
      if (localStream()) {
        for (const [, peer] of peersStore.peers().entries()) {
          const sender = peer.pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) sender.replaceTrack(localStream()!.getVideoTracks()[0]);
        }
      }
      appStore.setIsScreenSharing(false);
    } catch (error) {
      console.error('Error stopping screen share:', error);
    }
  };

  const toggleScreenShare = () => {
    if (appStore.isScreenSharing()) stopScreenShare(); else startScreenShare();
  };

  onCleanup(() => {
    // Очищаем все ресурсы
    disableAuxTorch();
    applyWhiteBg(false);
    
    // Останавливаем локальный стрим
    const stream = localStream();
    if (stream) {
      stream.getTracks().forEach(t => {
        try {
          t.stop();
        } catch (e) {
          console.warn('Error stopping track:', e);
        }
      });
    }
    
    // Останавливаем screen stream
    const screen = appStore.screenStream();
    if (screen) {
      screen.getTracks().forEach(t => {
        try {
          t.stop();
        } catch (e) {
          console.warn('Error stopping screen track:', e);
        }
      });
    }
    
    // Сбрасываем состояние
    setFlashlightEnabled(false);
  });

  return {
    localStream,
    setLocalStream,
    getLocalStream,
    swapCamera,
    toggleFlashlight: () => toggleFlashlight(),
    flashlightEnabled,
    toggleScreenShare,
    getFacing
  };
}
