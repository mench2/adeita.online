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
      
      const localContainer = videosGrid.querySelector('.video-container.local-video');
      if (localContainer) {
        localContainer.classList.remove('placeholder');
        const localAv = localContainer.querySelector('#localAvatar');
        if (localAv) localAv.remove();
      }
      
      // Подсчитываем реальные видео (локальное + удаленные, без placeholder'ов)
      const realTiles = videosGrid.querySelectorAll('.video-container:not(.placeholder)').length;
      const currentPlaceholders = videosGrid.querySelectorAll('.video-container.placeholder').length;
      const targetPlaceholders = Math.max(0, 4 - realTiles);
      
      console.log('[updateVideoGridLayout] Real tiles:', realTiles);
      console.log('[updateVideoGridLayout] Current placeholders:', currentPlaceholders);
      console.log('[updateVideoGridLayout] Target placeholders:', targetPlaceholders);
      
      // Удаляем лишние placeholder'ы
      if (currentPlaceholders > targetPlaceholders) {
        const placeholdersToRemove = videosGrid.querySelectorAll('.video-container.placeholder');
        const removeCount = currentPlaceholders - targetPlaceholders;
        console.log('[updateVideoGridLayout] Removing', removeCount, 'placeholders');
        for (let i = 0; i < removeCount; i++) {
          if (placeholdersToRemove[i]) {
            placeholdersToRemove[i].remove();
          }
        }
      }
      
      // Добавляем недостающие placeholder'ы
      if (currentPlaceholders < targetPlaceholders) {
        const fragment = document.createDocumentFragment();
        const addCount = targetPlaceholders - currentPlaceholders;
        console.log('[updateVideoGridLayout] Adding', addCount, 'placeholders');
        for (let i = 0; i < addCount; i++) {
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
    console.log('[VideoGrid] Peers changed:', peerIds);
    peerIds.forEach(peerId => {
      const existingElement = document.getElementById(`video-${peerId}`);
      if (!existingElement) {
        const container = createRemoteVideoElement(peerId);
        videosGrid.appendChild(container);
        console.log('[VideoGrid] Added video element for peer:', peerId);
      } else {
        console.log('[VideoGrid] Video element already exists for peer:', peerId);
      }
    });
    
    // Логируем текущее состояние grid
    const allContainers = videosGrid.querySelectorAll('.video-container');
    const realVideos = videosGrid.querySelectorAll('.video-container:not(.placeholder)');
    const placeholders = videosGrid.querySelectorAll('.video-container.placeholder');
    
    console.log('[VideoGrid] Total containers:', allContainers.length);
    console.log('[VideoGrid] Real videos:', realVideos.length);
    console.log('[VideoGrid] Placeholders:', placeholders.length);
    console.log('[VideoGrid] Grid computed style:', window.getComputedStyle(videosGrid).gridTemplateColumns);
    
    // Логируем все контейнеры
    allContainers.forEach((container, index) => {
      console.log(`[VideoGrid] Container ${index}:`, container.className, container.id);
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

