import { createSignal } from 'solid-js';

export interface ChatMessage {
  id: number;
  author: string;
  text: string;
  timestamp: Date;
  isOwn: boolean;
}

export const [roomId, setRoomId] = createSignal<string>('');
export const [isRoomCreator, setIsRoomCreator] = createSignal(false);
export const [userName, setUserName] = createSignal<string>('');
export const [userNames, setUserNames] = createSignal<Map<string, string>>(new Map());
export const [chatMessages, setChatMessages] = createSignal<ChatMessage[]>([]);
export const [isChatVisible, setIsChatVisible] = createSignal(true);
export const [screenStream, setScreenStream] = createSignal<MediaStream | null>(null);
export const [isScreenSharing, setIsScreenSharing] = createSignal(false);
export const [pendingChatText, setPendingChatText] = createSignal<string | null>(null);
export const [showProgress, setShowProgress] = createSignal(false);
export const [progressText, setProgressText] = createSignal('');
export const [progressPercent, setProgressPercent] = createSignal(0);
export const [error, setError] = createSignal<string | null>(null);
export const [showControls, setShowControls] = createSignal(false);
export const [showNameModal, setShowNameModal] = createSignal(false);
export const [useDirectConnection, setUseDirectConnection] = createSignal(false);

export function generateRoomId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function addChatMessage(author: string, text: string, isOwn = false) {
  const message: ChatMessage = {
    id: Date.now() + Math.random(),
    author,
    text,
    timestamp: new Date(),
    isOwn
  };
  setChatMessages([...chatMessages(), message]);
  return message;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function updateUserName(socketId: string, name: string) {
  const map = new Map(userNames());
  map.set(socketId, name);
  setUserNames(map);
}

export function removeUserName(socketId: string) {
  const map = new Map(userNames());
  map.delete(socketId);
  setUserNames(map);
}

// showNotification is imported directly from utils/notifications where needed

