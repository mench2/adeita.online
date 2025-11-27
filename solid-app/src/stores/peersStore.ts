import { createSignal, batch } from 'solid-js';

export interface Peer {
  pc: RTCPeerConnection;
  remoteStream: MediaStream;
  userName?: string;
  qualityInterval?: number;
  _disconnectTimer?: ReturnType<typeof setTimeout>;
}

export const [peers, setPeers] = createSignal<Map<string, Peer>>(new Map());

export function addPeer(peerId: string, peer: Peer) {
  batch(() => {
    const map = new Map(peers());
    map.set(peerId, peer);
    setPeers(map);
  });
}

export function removePeer(peerId: string) {
  batch(() => {
    const peer = peers().get(peerId);
    if (peer) {
      // Очищаем таймеры и интервалы
      if (peer.qualityInterval) {
        clearInterval(peer.qualityInterval);
      }
      if (peer._disconnectTimer) {
        clearTimeout(peer._disconnectTimer);
      }
      // Закрываем соединение
      try {
        peer.pc.close();
      } catch (e) {
        console.warn('Error closing peer connection:', e);
      }
    }
    const map = new Map(peers());
    map.delete(peerId);
    setPeers(map);
  });
}

export function updatePeer(peerId: string, updates: Partial<Peer>) {
  batch(() => {
    const map = new Map(peers());
    const peer = map.get(peerId);
    if (peer) {
      map.set(peerId, { ...peer, ...updates });
      setPeers(map);
    }
  });
}

export function getPeer(peerId: string): Peer | undefined {
  return peers().get(peerId);
}

export function hasPeer(peerId: string): boolean {
  return peers().has(peerId);
}

export function getAllPeerIds(): string[] {
  return Array.from(peers().keys());
}

export function clearPeers() {
  batch(() => {
    // Очищаем все соединения перед удалением
    for (const [peerId, peer] of peers().entries()) {
      if (peer.qualityInterval) clearInterval(peer.qualityInterval);
      if (peer._disconnectTimer) clearTimeout(peer._disconnectTimer);
      try {
        peer.pc.close();
      } catch (e) {
        console.warn(`Error closing peer ${peerId}:`, e);
      }
    }
    setPeers(new Map());
  });
}

