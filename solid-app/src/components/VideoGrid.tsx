import { createEffect, onCleanup, For, createMemo, batch, onMount } from 'solid-js';
import * as peersStore from '../stores/peersStore';
import { createRemoteVideoElement } from '../hooks/useWebRTC';
import type { Accessor } from 'solid-js';

let layoutUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
let resizeObserver: ResizeObserver | null = null;

function recalcTileSize(videosGrid: HTMLElement) {
  const style = getComputedStyle(videosGrid);
  const gap = parseFloat(style.gap || '12');
  const paddingLeft = parseFloat(style.paddingLeft || '16');
  const paddingRight = parseFloat(style.paddingRight || '16');
  const paddingTop = parseFloat(style.paddingTop || '16');
  const paddingBottom = parseFloat(style.paddingBottom || '16');
  const availW = videosGrid.clientWidth - paddingLeft - paddingRight - gap;
  const availH = videosGrid.clientHeight - paddingTop - paddingBottom - gap;
  const tile = Math.max(80, Math.floor(Math.min(availW / 2, availH / 2)));
  videosGrid.style.setProperty('--tile-size', tile + 'px');
}

function updateVideoGridLayout() {
  if (layoutUpdateTimeout) clearTimeout(layoutUpdateTimeout);
  layoutUpdateTimeout = setTimeout(() => {
    const videosGrid = document.getElementById('videosGrid') as HTMLElement;
    if (!videosGrid) return;
    
    // Используем batch для группировки DOM операций
    requestAnimationFrame(() => {
      videosGrid.className = 'videos-grid';
      
      // Удаляем плейсхолдеры одним махом
      const placeholders = videosGrid.querySelectorAll('.video-container.placeholder');
      placeholders.forEach(n => n.remove());
      
      const localContainer = videosGrid.querySelector('.video-container.local-video');
      if (localContainer) {
        localContainer.classList.remove('placeholder');
        const localAv = localContainer.querySelector('#localAvatar');
        if (localAv) localAv.remove();
      }
      
      const realTiles = videosGrid.querySelectorAll('.video-container').length;
      const placeholdersToAdd = Math.max(0, 4 - realTiles);
      
      // Создаем fragment для batch вставки
      if (placeholdersToAdd > 0) {
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < placeholdersToAdd; i++) {
          const ph = document.createElement('div');
          ph.className = 'video-container placeholder';
          fragment.appendChild(ph);
        }
        videosGrid.appendChild(fragment);
      }
      
      recalcTileSize(videosGrid);
    });
  }, 100);
}

export default function VideoGrid(props: { 
  localStream: Accessor<MediaStream | null>;
  onEnablePiP: () => void;
}) {
  let videosGrid!: HTMLDivElement;
  let localVideoContainer!: HTMLDivElement;
  let localVideoEl!: HTMLVideoElement;

  const isAudioEnabled = createMemo(() => {
    const stream = props.localStream();
    if (!stream) return false;
    const tracks = stream.getAudioTracks();
    return tracks.length > 0 && tracks.every(t => t.enabled);
  });
  
  createEffect(() => {
    const peerIds = peersStore.getAllPeerIds();
    updateVideoGridLayout();
  });

  createEffect(() => {
    // Обновляем статус микрофона
    const micStatus = document.getElementById('localMicStatus');
    if (micStatus) {
      micStatus.className = `mic-status ${isAudioEnabled() ? '' : 'muted'}`;
    }
  });

  createEffect(() => {
    const stream = props.localStream();
    if (localVideoContainer) {
      let video = localVideoContainer.querySelector('#localVideo') as HTMLVideoElement;
      if (!video) {
        video = document.createElement('video');
        video.id = 'localVideo';
        video.autoplay = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.muted = true;
        localVideoContainer.appendChild(video);
        localVideoEl = video;
      }
      
      if (stream && video.srcObject !== stream) {
        video.srcObject = stream;
        video.play().catch(err => console.warn('Local video play failed:', err));
      }
    }
  });

  createEffect(() => {
    const peerIds = peersStore.getAllPeerIds();
    peerIds.forEach(peerId => {
      if (!document.getElementById(`video-${peerId}`)) {
        const container = createRemoteVideoElement(peerId);
        videosGrid.appendChild(container);
      }
    });
    updateVideoGridLayout();
  });

  onMount(() => {
    if (typeof window !== 'undefined' && videosGrid) {
      // Используем ResizeObserver для более эффективного отслеживания изменений размера
      resizeObserver = new ResizeObserver(() => {
        if (videosGrid) recalcTileSize(videosGrid);
      });
      resizeObserver.observe(videosGrid);
      
      onCleanup(() => {
        if (resizeObserver) {
          resizeObserver.disconnect();
          resizeObserver = null;
        }
      });
    }
  });

  return (
    <div class="video-section">
      <div class="videos-grid" id="videosGrid" ref={videosGrid}>
        <div class="video-container local-video" ref={localVideoContainer}>
          <button class="pip-button" onClick={props.onEnablePiP} title="Picture-in-Picture">
            📺
          </button>
          <div class="video-label">
            <div class="mic-status" id="localMicStatus"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

