import { onMount, onCleanup, createEffect, Show } from 'solid-js';
import { createLocalMedia } from './media/useLocalMedia';
import { createSocket, getSocket } from './hooks/useSocket';
import { createPeerConnection, handleSignal, callPeerWithRetry, removePeer as removePeerConn } from './hooks/useWebRTC';
import { createRemoteVideoElement } from './hooks/useWebRTC';
import * as appStore from './stores/appStore';
import * as peersStore from './stores/peersStore';
import { IS_MOBILE, IS_IOS, IS_ANDROID, IS_TELEGRAM, IS_SAFARI } from './utils/detection';
import { showNotification } from './utils/notifications';
import { triggerMediaUpdate } from './utils/mediaState';
import VideoGrid from './components/VideoGrid';
import Controls from './components/Controls';
import Chat from './components/Chat';
import NameModal from './components/NameModal';
import Preloader from './components/Preloader';
import ConnectionTypeSelector from './components/ConnectionTypeSelector';
import ConnectionQualityIndicator from './components/ConnectionQualityIndicator';
import type { VideoQualityPreset } from './components/VideoQualitySettings';
import './styles.css';

export default function App() {
  const media = createLocalMedia();
  let firstInteraction = true;

  const checkUrlParams = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    const directParam = urlParams.get('direct'); // Параметр типа подключения
    let tgStartParam = urlParams.get('tgWebAppStartParam') || urlParams.get('startapp');
    
    // Проверяем Telegram WebApp initDataUnsafe
    if (IS_TELEGRAM && typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;
      if (tg.initDataUnsafe && tg.initDataUnsafe.start_param) {
        tgStartParam = tg.initDataUnsafe.start_param;
      }
    }
    
    if (IS_MOBILE) {
      appStore.setIsChatVisible(false);
    }

    // Если есть параметр direct в URL - устанавливаем тип подключения
    if (directParam === '1' || directParam === 'true') {
      appStore.setUseDirectConnection(true);
      console.log('🔒 Тип подключения из URL: Секретное (P2P)');
    } else if (directParam === '0' || directParam === 'false') {
      appStore.setUseDirectConnection(false);
      console.log('🌐 Тип подключения из URL: Через сервер');
    }

    if (tgStartParam) {
      appStore.setRoomId(tgStartParam);
      appStore.setIsRoomCreator(false);
      // Автоматически присоединяемся к комнате
      setTimeout(() => joinExistingRoom(), 100);
    } else if (roomParam) {
      appStore.setRoomId(roomParam);
      appStore.setIsRoomCreator(false);
    } else {
      appStore.setIsRoomCreator(true);
    }
  };

  const joinExistingRoom = async () => {
    try {
      console.log(`Joining existing room: ${appStore.roomId()}`);
      appStore.setShowProgress(true);
      try {
        await media.getLocalStream();
        // VideoGrid автоматически обновит srcObject через createEffect
      } catch (streamError) {
        console.warn('Failed to get local stream, continuing without it:', streamError);
      }
      const socket = getSocket();
      socket?.emit('join', appStore.roomId());
      appStore.setShowControls(true);
      setTimeout(() => appStore.setShowProgress(false), 3000);
    } catch (e) {
      console.error('Failed to join existing room:', e);
      appStore.setError(`Failed to join room: ${(e as Error).message}`);
      appStore.setShowProgress(false);
    }
  };

  const createNewRoom = async () => {
    const newRoomId = appStore.generateRoomId();
    appStore.setRoomId(newRoomId);
    appStore.setIsRoomCreator(true);
    try {
      console.log(`Creating new room: ${newRoomId}`);
      appStore.setShowProgress(true);
      await media.getLocalStream();
      // VideoGrid автоматически обновит srcObject через createEffect
      const socket = getSocket();
      socket?.emit('join', newRoomId);
      appStore.setShowControls(true);
      setTimeout(() => appStore.setShowProgress(false), 2000);
    } catch (e) {
      console.error('Failed to create room:', e);
      appStore.setError(`Failed to create room: ${(e as Error).message}`);
      appStore.setShowProgress(false);
    }
  };

  const updateVideoQualityForParticipantCount = async () => {
    const participantCount = 1 + peersStore.peers().size;
    
    // Если у нас уже есть локальный стрим, обновляем его качество
    if (media.localStream() && participantCount >= 3) {
      try {
        console.log(`Updating video quality for ${participantCount} participants`);
        
        // Получаем новый стрим с адаптивным качеством
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
            channelCount: 1
          },
          video: participantCount >= 4 ? {
            width: { ideal: 480, max: 640 },
            height: { ideal: 360, max: 480 },
            frameRate: { ideal: 15, max: 20 },
            facingMode: { ideal: 'user' }
          } : {
            width: { ideal: 640, max: 800 },
            height: { ideal: 480, max: 600 },
            frameRate: { ideal: 20, max: 25 },
            facingMode: { ideal: 'user' }
          }
        });
        
        // Заменяем треки во всех соединениях
        for (const [peerId, peer] of peersStore.peers().entries()) {
          const videoSender = peer.pc.getSenders().find(s => s.track && s.track.kind === 'video');
          const audioSender = peer.pc.getSenders().find(s => s.track && s.track.kind === 'audio');
          
          if (videoSender && newStream.getVideoTracks()[0]) {
            await videoSender.replaceTrack(newStream.getVideoTracks()[0]);
          }
          if (audioSender && newStream.getAudioTracks()[0]) {
            await audioSender.replaceTrack(newStream.getAudioTracks()[0]);
          }
        }
        
        // Останавливаем старый стрим и устанавливаем новый
        const oldStream = media.localStream();
        if (oldStream) {
          oldStream.getTracks().forEach(track => track.stop());
        }
        // Обновляем стрим через hook
        media.setLocalStream(newStream);
        
        // Обновляем srcObject у видео элемента
        const videoEl = document.getElementById('localVideo') as HTMLVideoElement;
        if (videoEl) {
          videoEl.srcObject = newStream;
          videoEl.play().catch(err => console.warn('Play failed:', err));
        }
        
        console.log(`Video quality updated for ${participantCount} participants`);
      } catch (error) {
        console.warn('Failed to update video quality:', error);
      }
    }
  };

  const addPeer = async (peerId: string) => {
    if (peersStore.hasPeer(peerId)) {
      console.log(`[App] Peer ${peerId} already exists, skipping`);
      return;
    }
    console.log(`[App] Adding peer ${peerId}`);
    appStore.setShowProgress(true);
    appStore.setProgressPercent(10);
    appStore.setProgressText('Creating connection...');
    
    // НЕ добавляем видео элемент здесь - это делает VideoGrid.tsx через createEffect
    // Просто создаем peer connection и добавляем в store
    
    const peer = createPeerConnection(peerId, media.localStream() || null);
    peersStore.addPeer(peerId, peer);
    console.log(`[App] Peer ${peerId} added to store`);
    
    // Обновляем качество видео при добавлении участника
    await updateVideoQualityForParticipantCount();
  };

  const onPeerJoined = (socketId: string) => {
    console.log(`[App] onPeerJoined called for: ${socketId}`);
    const socket = getSocket();
    console.log(`[App] Our socket ID: ${socket?.id}`);
    console.log(`[App] Current peers:`, peersStore.getAllPeerIds());
    
    addPeer(socketId);
    
    setTimeout(async () => {
      const socket = getSocket();
      const shouldCall = socket?.id && socket.id < socketId;
      console.log(`[App] Should we call ${socketId}? ${shouldCall} (our ID: ${socket?.id})`);
      
      if (peersStore.hasPeer(socketId) && shouldCall) {
        console.log(`[App] Calling new peer ${socketId}`);
        await callPeerWithRetry(socketId);
      } else {
        console.log(`[App] Waiting for peer ${socketId} to call us`);
      }
    }, 1000);
  };

  const onPeerLeft = (socketId: string) => {
    removePeerConn(socketId);
  };

  const onChatMessage = (author: string, text: string, timestamp: Date) => {
    appStore.addChatMessage(author, text, false);
  };

  const onSignal = async (from: string, data: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }) => {
    if (!peersStore.hasPeer(from)) {
      console.log(`Adding new peer ${from} from signal`);
      addPeer(from);
    }
    await handleSignal(from, data);
  };

  const socketApi = createSocket(onSignal, onPeerJoined, onPeerLeft, onChatMessage);

  const copyRoomLink = async () => {
    // Добавляем параметр direct в URL если используется секретное подключение
    const directParam = appStore.useDirectConnection() ? '&direct=1' : '';
    const roomUrl = `${window.location.origin}${window.location.pathname}?room=${appStore.roomId()}${directParam}`;
    const tgAppLink = `https://t.me/AdeitaBot/Adeita_Vichat?startapp=${appStore.roomId()}${directParam}`;
    
    // Добавляем информацию о типе подключения в текст
    const connectionType = appStore.useDirectConnection() 
      ? '🔒 Секретное подключение (P2P)' 
      : '🌐 Через сервер';
    
    const shareText = `Привет! Приглашаю присоединиться к звонку\n\nТип подключения: ${connectionType}\n\nТы можешь это сделать либо:\n\n— Через Telegram Mini App: ${tgAppLink}\n\n— Через сайт: ${roomUrl}\n\n😿Если Telegram Mini App не открывается ты можешь присоединиться через сайт`;
    
    if (IS_TELEGRAM && typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      (window as any).Telegram.WebApp.sendData(shareText);
      (window as any).Telegram.WebApp.close();
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        showNotification('Скопировано');
      } catch (err) {
        const textArea = document.createElement('textarea');
        textArea.value = shareText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('Скопировано');
      }
    }
  };

  const hangup = () => {
    appStore.setShowProgress(true);
    const socket = getSocket();
    if (appStore.roomId()) {
      socket?.emit('leave', appStore.roomId());
    }
    
    if (IS_IOS || IS_SAFARI) {
      if (media.localStream()) {
        media.localStream()!.getAudioTracks().forEach(t => { t.stop(); t.enabled = false; });
        media.localStream()!.getVideoTracks().forEach(t => { t.stop(); t.enabled = false; });
      }
      setTimeout(() => continueHangup(), 500);
    } else {
      continueHangup();
    }
  };

  const continueHangup = () => {
    for (const [peerId, peer] of peersStore.peers().entries()) {
      peer.pc.getSenders().forEach(s => s.track?.stop());
      peer.pc.close();
    }
    peersStore.clearPeers();
    appStore.removeUserName('');
    appStore.setRoomId('');
    appStore.setIsRoomCreator(false);
    appStore.setUserName('');
    appStore.setChatMessages([]);
    appStore.setIsScreenSharing(false);
    if (media.localStream()) {
      media.localStream()!.getTracks().forEach(t => t.stop());
    }
    const videoEl = document.getElementById('localVideo') as HTMLVideoElement;
    if (videoEl) {
      videoEl.srcObject = null;
      videoEl.pause();
    }
    if (appStore.screenStream()) {
      appStore.screenStream()!.getTracks().forEach(t => t.stop());
      appStore.setScreenStream(null);
    }
    
    // Выключаем фонарик и убираем белый фон
    try {
      const videoSection = document.querySelector('.video-section');
      videoSection?.classList.remove('flashlight-on');
      document.body.classList.remove('flashlight-bg');
      document.querySelector('.wrap')?.classList.remove('flashlight-bg');
    } catch (e) {
      console.warn('Failed to cleanup flashlight:', e);
    }
    
    appStore.setShowControls(false);
    appStore.setError(null);
    appStore.setShowProgress(false);
    if (IS_IOS || IS_SAFARI) {
      showNotification('Звонок завершен. Микрофон освобожден.');
    }
  };

  const toggleMic = async () => {
    if (!media.localStream()) {
      try {
        await media.getLocalStream();
        if (media.localStream()) {
          for (const [peerId, peer] of peersStore.peers().entries()) {
            const audioSender = peer.pc.getSenders().find(s => s.track && s.track.kind === 'audio');
            if (audioSender && media.localStream()!.getAudioTracks()[0]) {
              await audioSender.replaceTrack(media.localStream()!.getAudioTracks()[0]);
            }
          }
        }
        triggerMediaUpdate();
      } catch (error) {
        console.error('Failed to get stream:', error);
      }
      return;
    }
    const audioTracks = media.localStream()!.getAudioTracks();
    const isAudioEnabled = audioTracks.some(t => t.enabled);
    
    // Переключаем состояние треков
    for (const t of audioTracks) t.enabled = !isAudioEnabled;
    
    // Триггерим обновление UI
    triggerMediaUpdate();
  };

  const toggleCam = async () => {
    if (!media.localStream()) {
      try {
        await media.getLocalStream();
        if (media.localStream()) {
          for (const [peerId, peer] of peersStore.peers().entries()) {
            const videoSender = peer.pc.getSenders().find(s => s.track && s.track.kind === 'video');
            if (videoSender && media.localStream()!.getVideoTracks()[0]) {
              await videoSender.replaceTrack(media.localStream()!.getVideoTracks()[0]);
            }
          }
        }
        triggerMediaUpdate();
      } catch (error) {
        console.error('Failed to get stream:', error);
      }
      return;
    }
    const videoTracks = media.localStream()!.getVideoTracks();
    const isVideoEnabled = videoTracks.some(t => t.enabled);
    
    // Переключаем состояние треков
    for (const t of videoTracks) t.enabled = !isVideoEnabled;
    
    // Триггерим обновление UI
    triggerMediaUpdate();
  };

  const tryActivateCamera = async (source: string) => {
    if (firstInteraction && !media.localStream()) {
      firstInteraction = false;
      console.log(`${source} detected, attempting to get camera access`);
      try {
        await media.getLocalStream();
        // VideoGrid автоматически обновит srcObject через createEffect
        showNotification('Камера активирована');
      } catch (error) {
        console.warn(`Failed to get camera on ${source}:`, error);
      }
    }
  };

  const handleQualityChange = async (quality: VideoQualityPreset) => {
    appStore.setVideoQuality(quality);
    showNotification(`Качество видео: ${quality}`);
    
    // Перезапускаем стрим с новым качеством
    if (media.localStream()) {
      try {
        await media.getLocalStream();
        
        // Обновляем треки во всех соединениях
        for (const [peerId, peer] of peersStore.peers().entries()) {
          const videoSender = peer.pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (videoSender && media.localStream()!.getVideoTracks()[0]) {
            await videoSender.replaceTrack(media.localStream()!.getVideoTracks()[0]);
          }
        }
      } catch (error) {
        console.error('Failed to change video quality:', error);
      }
    }
  };

  const enablePictureInPicture = async () => {
    const localVideo = document.getElementById('localVideo') as HTMLVideoElement;
    if (!localVideo) {
      showNotification('Видео не найдено');
      return;
    }

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        appStore.setPipEnabled(false);
        showNotification('PiP выключен');
      } else {
        await localVideo.requestPictureInPicture();
        appStore.setPipEnabled(true);
        showNotification('PiP включен');
      }
    } catch (error) {
      console.error('PiP error:', error);
      showNotification('PiP недоступен');
    }
  };

  onMount(() => {
    checkUrlParams();
    appStore.setShowProgress(true);
    if (IS_MOBILE) {
      appStore.setIsChatVisible(false);
    }
    setTimeout(() => {
      appStore.setShowProgress(false);
      document.body.classList.add('loaded');
    }, 100);

    // Telegram auto-join с задержкой для инициализации
    if (IS_TELEGRAM && typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      const tryAutoJoinTelegramRoom = () => {
        const tg = (window as any).Telegram.WebApp;
        if (tg.initDataUnsafe && tg.initDataUnsafe.start_param) {
          const telegramRoomId = tg.initDataUnsafe.start_param;
          appStore.setRoomId(telegramRoomId);
          appStore.setIsRoomCreator(false);
          setTimeout(() => joinExistingRoom(), 200);
        }
      };
      window.addEventListener('load', tryAutoJoinTelegramRoom);
      setTimeout(tryAutoJoinTelegramRoom, 500);
    }

    if (IS_TELEGRAM) {
      if (IS_MOBILE) {
        document.addEventListener('touchstart', () => tryActivateCamera('touch'), { once: true });
      }
      const buttons = document.querySelectorAll('button');
      buttons.forEach(btn => {
        btn.addEventListener('click', () => tryActivateCamera('button click'), { once: true });
      });
      if (IS_IOS) {
        document.addEventListener('visibilitychange', async () => {
          if (!document.hidden && !media.localStream()) {
            setTimeout(() => tryActivateCamera('visibility change'), 100);
          }
        });
      }
      if (IS_ANDROID) {
        window.addEventListener('focus', () => tryActivateCamera('window focus'));
      }
    }

    window.addEventListener('beforeunload', () => {
      const socket = getSocket();
      if (appStore.roomId() && socket?.connected) {
        socket.emit('leave', appStore.roomId());
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && appStore.roomId()) {
        const socket = getSocket();
        if (socket?.connected) socket.emit('ping');
      }
    });
  });

  return (
    <>
      <Preloader />
      <div class="wrap">
        <header style="display: none !important;">
          <div class="logo">
            <div class="room-title">{appStore.roomId() ? `Room ${appStore.roomId()}` : 'Adeita Vichat'}</div>
            <div class="participants-count">
              {1 + peersStore.peers().size} participant{(1 + peersStore.peers().size) !== 1 ? 's' : ''}
            </div>
          </div>
        </header>

        <div class="main-content">
          <VideoGrid localStream={media.localStream} onEnablePiP={enablePictureInPicture} />
          <div class="participants-section" id="participantsSection" style={IS_MOBILE ? 'display: none !important;' : ''}>
            <Chat />
          </div>
        </div>
        
        <ConnectionQualityIndicator />
        
        <Show when={appStore.error()}>
          <div id="errors">
            <div class="errors">{appStore.error()}</div>
          </div>
        </Show>

        <NameModal />

        <ConnectionTypeSelector />

        <Show when={!appStore.showControls()}>
          <div class="call-button-container" id="callButtonContainer">
            <button class="call-button" id="callButton" onClick={appStore.roomId() && !appStore.isRoomCreator() ? joinExistingRoom : createNewRoom}>
              <img src="/icon/connect_without_contact_24dp_FFFFFF_FILL0_wght400_GRAD0_opsz24.svg" alt="Connected" width="24" height="24" />
              <span>{appStore.roomId() && !appStore.isRoomCreator() ? 'Join call' : 'Start a call'}</span>
            </button>
          </div>
        </Show>

        <Controls
          onToggleMic={toggleMic}
          onToggleCam={toggleCam}
          onToggleFlashlight={media.toggleFlashlight}
          onSwapCamera={media.swapCamera}
          onToggleScreenShare={media.toggleScreenShare}
          onCopyLink={copyRoomLink}
          onHangup={hangup}
          flashlightEnabled={media.flashlightEnabled()}
          localStream={media.localStream}
          onToggleNoiseSuppression={media.toggleNoiseSuppression}
          onQualityChange={handleQualityChange}
        />
      </div>
    </>
  );
}
