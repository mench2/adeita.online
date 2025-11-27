import { io, Socket } from 'socket.io-client';
import { createEffect, onCleanup } from 'solid-js';
import { IS_TELEGRAM } from '../utils/detection';
import * as appStore from '../stores/appStore';
import * as peersStore from '../stores/peersStore';
import type { Peer } from '../stores/peersStore';

export interface SignalData {
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

let socket: Socket | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

export function createSocket(onSignal?: (from: string, data: SignalData) => Promise<void>, onPeerJoined?: (socketId: string) => void, onPeerLeft?: (socketId: string) => void, onChatMessage?: (author: string, text: string, timestamp: Date) => void) {
  const params = new URLSearchParams(window.location.search);
  // В dev режиме используем localhost:3001, в prod - текущий origin
  const isDev = import.meta.env.DEV;
  const SIGNAL_URL = params.get('signal') || (isDev ? 'http://localhost:3001' : window.location.origin);
  
  socket = io(SIGNAL_URL, {
    transports: ['polling', 'websocket'], // Сначала polling, потом upgrade на websocket
    path: '/socket.io',
    withCredentials: false, // В dev режиме не нужно
    timeout: 15000,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    forceNew: false, // Переиспользуем соединение
    autoConnect: true,
    upgrade: true,
    rememberUpgrade: true
  });

  function startHeartbeat() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
      if (socket?.connected) socket.emit('ping');
    }, 1000);
  }

  function stopHeartbeat() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  }

  socket.on('connect', () => {
    appStore.setError(null);
    console.log('Connected to signaling server');
    startHeartbeat();
  });

  socket.on('disconnect', () => {
    appStore.setShowControls(false);
    console.log('Disconnected from signaling server');
    stopHeartbeat();
  });

  socket.on('connect_error', (err) => {
    appStore.setError('Failed to connect to signaling server');
    console.error('Connection error:', err);
  });

  socket.on('peers-list', ({ peers: peerList }: { peers: string[] }) => {
    console.log('Received peers list:', peerList);
    console.log('Our socket ID:', socket?.id);
    peerList.forEach(peerId => {
      console.log(`Adding peer: ${peerId}`);
      if (onPeerJoined) onPeerJoined(peerId);
    });
  });

  socket.on('peer-joined', ({ socketId }: { socketId: string }) => {
    console.log('Peer joined:', socketId);
    console.log('Our socket ID:', socket?.id);
    if (onPeerJoined) onPeerJoined(socketId);
  });

  socket.on('peer-left', ({ socketId }: { socketId: string }) => {
    console.log('Peer left:', socketId);
    appStore.removeUserName(socketId);
    if (onPeerLeft) onPeerLeft(socketId);
  });

  socket.on('user-name-set', ({ socketId, userName: peerUserName }: { socketId: string; userName: string }) => {
    console.log(`User ${socketId} set name to: ${peerUserName}`);
    appStore.updateUserName(socketId, peerUserName);
  });

  socket.on('chat-message', ({ author, text, timestamp }: { author: string; text: string; timestamp: Date }) => {
    console.log(`Chat message from ${author}: ${text}`);
    if (onChatMessage) onChatMessage(author, text, new Date(timestamp));
  });

  socket.on('signal', async ({ from, data }: { from: string; data: SignalData }) => {
    if (onSignal) await onSignal(from, data);
  });

  socket.on('pong', () => {
    // Подтверждение heartbeat
  });

  // Telegram auto-join
  if (IS_TELEGRAM && typeof window !== 'undefined') {
    const tryAutoJoinTelegramRoom = () => {
      const tg = (window as any).Telegram;
      if (tg && tg.WebApp && tg.WebApp.initDataUnsafe && tg.WebApp.initDataUnsafe.start_param) {
        const telegramRoomId = tg.WebApp.initDataUnsafe.start_param;
        appStore.setRoomId(telegramRoomId);
        appStore.setIsRoomCreator(false);
        // Вызов joinExistingRoom должен быть вне этого хука
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('load', tryAutoJoinTelegramRoom);
      setTimeout(tryAutoJoinTelegramRoom, 500);
    }
  }

  onCleanup(() => {
    stopHeartbeat();
    socket?.disconnect();
    socket = null;
  });

  return {
    socket: () => socket,
    emit: (event: string, data?: any) => socket?.emit(event, data),
    id: () => socket?.id
  };
}

export function getSocket(): Socket | null {
  return socket;
}

