import { onCleanup, Accessor } from 'solid-js';
import { createPeerConnectionConfig, getVideoDeviceIdByFacing } from '../utils/webrtc';
import { IS_IOS, IS_SAFARI, IS_FIREFOX } from '../utils/detection';
import * as peersStore from '../stores/peersStore';
import * as appStore from '../stores/appStore';
import { getSocket } from './useSocket';
import type { Peer } from '../stores/peersStore';

export function createPeerConnection(peerId: string, localStream: MediaStream | null): Peer {
  const participantCount = 1 + peersStore.peers().size;
  const directOnly = appStore.useDirectConnection();
  const config = createPeerConnectionConfig(participantCount, directOnly);
  
  console.log(`Creating peer connection for ${peerId} with config:`, config);
  console.log(`Connection mode: ${directOnly ? '🔒 Секретное (STUN only)' : '🌐 Через сервер (STUN + TURN)'}`);
  
  const pc = new RTCPeerConnection(config);
  const remoteStream = new MediaStream();
  
  pc.onicecandidate = (e) => {
    if (e.candidate) {
      // Логируем тип соединения для отладки
      const candidateType = e.candidate.type;
      if (candidateType === 'relay') {
        console.log(`🔄 Используется TURN сервер для ${peerId}`);
      } else if (candidateType === 'srflx') {
        console.log(`⚡ Используется STUN (прямое через NAT) для ${peerId}`);
      } else if (candidateType === 'host') {
        console.log(`🏠 Используется локальное соединение для ${peerId}`);
      }
      
      const socket = getSocket();
      socket?.emit('signal', { to: peerId, data: { candidate: e.candidate } });
    }
  };
  
  pc.ontrack = (e) => {
    remoteStream.addTrack(e.track);
    const remoteVideo = document.getElementById(`remoteVideo-${peerId}`) as HTMLVideoElement;
    if (remoteVideo && remoteVideo.srcObject !== remoteStream) {
      remoteVideo.srcObject = remoteStream;
    }
    if (e.track && e.track.kind === 'video') {
      const av = document.querySelector(`#video-${peerId} .avatar`);
      if (av) av.remove();
    }
    if (e.track) {
      e.track.onended = () => {
        console.log(`INSTANT REMOVAL: Track ended for ${peerId}`);
        removePeer(peerId);
      };
    }
  };
  
  pc.onconnectionstatechange = () => {
    console.log(`pc.connectionState with ${peerId}:`, pc.connectionState);
    if (pc.connectionState === 'connecting') {
      appStore.setProgressPercent(70);
      appStore.setProgressText('Connecting...');
    } else if (pc.connectionState === 'connected') {
      appStore.setProgressPercent(100);
      appStore.setProgressText('Connected!');
      appStore.setShowControls(true);
      setTimeout(() => appStore.setShowProgress(false), 1000);
    } else if (pc.connectionState === 'failed') {
      console.error(`WebRTC connection failed with ${peerId} - attempting restart`);
      appStore.setShowProgress(false);
      setTimeout(async () => {
        if (peersStore.hasPeer(peerId)) {
          console.log(`Attempting to restart connection with ${peerId}`);
          try {
            await callPeerWithRetry(peerId, 2);
          } catch (error) {
            console.error(`Failed to restart connection with ${peerId}:`, error);
            removePeer(peerId);
          }
        }
      }, 3000);
    } else if (pc.connectionState === 'disconnected') {
      console.warn(`WebRTC connection disconnected with ${peerId}`);
      console.log(`INSTANT REMOVAL: WebRTC disconnected with ${peerId}`);
      removePeer(peerId);
    }
  };
  
  pc.oniceconnectionstatechange = () => {
    console.log(`pc.iceConnectionState with ${peerId}:`, pc.iceConnectionState);
    if (pc.iceConnectionState === 'failed') {
      console.error(`ICE connection failed for ${peerId}`);
      console.log(`INSTANT REMOVAL: ICE failed with ${peerId}`);
      removePeer(peerId);
    }
    if (pc.iceConnectionState === 'disconnected') {
      console.log(`INSTANT REMOVAL: ICE disconnected with ${peerId}`);
      removePeer(peerId);
    }
    if (pc.iceConnectionState === 'connected') {
      const peer = peersStore.getPeer(peerId);
      if (peer && (peer as any)._disconnectTimer) {
        clearTimeout((peer as any)._disconnectTimer);
        (peer as any)._disconnectTimer = null;
      }
    }
  };
  
  pc.onicegatheringstatechange = () => {
    console.log(`pc.iceGatheringState with ${peerId}:`, pc.iceGatheringState);
    if (pc.iceGatheringState === 'gathering') {
      appStore.setProgressPercent(30);
      appStore.setProgressText('Gathering ICE candidates...');
    } else if (pc.iceGatheringState === 'complete') {
      appStore.setProgressPercent(60);
      appStore.setProgressText('ICE gathering complete, checking connectivity...');
    }
  };
  
  if (localStream) {
    for (const track of localStream.getTracks()) {
      pc.addTrack(track, localStream);
    }
  } else {
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });
  }
  
  return { pc, remoteStream };
}

export function removePeer(peerId: string) {
  const peer = peersStore.getPeer(peerId);
  if (peer) {
    if (peer.qualityInterval) {
      clearInterval(peer.qualityInterval);
    }
    try {
      peer.pc.close();
    } catch (e) {
      console.warn('Error closing peer connection:', e);
    }
    peersStore.removePeer(peerId);
    removeRemoteVideoElement(peerId);
  }
}

function removeRemoteVideoElement(peerId: string) {
  const videoContainer = document.getElementById(`video-${peerId}`);
  if (videoContainer) {
    videoContainer.remove();
  }
}

export async function callPeer(peerId: string) {
  const peer = peersStore.getPeer(peerId);
  if (!peer) {
    console.log(`Cannot call peer ${peerId}: peer not found in peers map`);
    return;
  }
  
  console.log(`Calling peer ${peerId}...`);
  try {
    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer);
    const socket = getSocket();
    socket?.emit('signal', { to: peerId, data: { sdp: peer.pc.localDescription } });
    console.log(`Offer sent to ${peerId}`);
  } catch (error) {
    console.error(`Error calling peer ${peerId}:`, error);
    throw error;
  }
}

export async function callPeerWithRetry(peerId: string, maxRetries = 3) {
  let attempts = 0;
  while (attempts < maxRetries) {
    try {
      await callPeer(peerId);
      console.log(`Successfully called peer ${peerId} on attempt ${attempts + 1}`);
      return;
    } catch (error) {
      attempts++;
      console.warn(`Failed to call peer ${peerId} on attempt ${attempts}:`, error);
      if (attempts < maxRetries) {
        const delay = Math.pow(2, attempts) * 1000;
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  console.error(`Failed to call peer ${peerId} after ${maxRetries} attempts`);
}

export async function handleSignal(from: string, data: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }) {
  console.log(`Received signal from ${from}:`, data);
  
  if (!peersStore.hasPeer(from)) {
    console.log(`Adding new peer ${from} from signal`);
    // addPeer должен вызываться извне с localStream
    return false;
  }
  
  const peer = peersStore.getPeer(from);
  if (!peer) {
    console.error(`Peer ${from} not found after adding`);
    return false;
  }
  
  if (data.sdp) {
    console.log(`Processing SDP from ${from}:`, data.sdp.type);
    try {
      let sdp = data.sdp;
      if (IS_IOS || IS_SAFARI) {
        sdp.sdp = (sdp.sdp || '').replace(/a=fmtp:111 profile-level-id=42e01f[\r\n]/g, '');
      }
      if (IS_FIREFOX) {
        sdp.sdp = (sdp.sdp || '').replace(/a=fmtp:111/g, 'a=fmtp:111 profile-level-id=42e01f');
      }
      await peer.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      if (sdp.type === 'offer') {
        console.log(`Creating answer for ${from}`);
        let answerOptions: RTCOfferOptions = {};
        if (IS_IOS || IS_SAFARI) {
          answerOptions.voiceActivityDetection = false;
        }
        const answer = await peer.pc.createAnswer(answerOptions);
        if (IS_IOS || IS_SAFARI) {
          answer.sdp = (answer.sdp || '').replace(/a=fmtp:111 profile-level-id=42e01f[\r\n]/g, '');
        }
        await peer.pc.setLocalDescription(answer);
        const socket = getSocket();
        socket?.emit('signal', { to: from, data: { sdp: peer.pc.localDescription } });
        console.log(`Answer sent to ${from}`);
      }
    } catch (e) {
      console.error(`Error processing SDP from ${from}:`, e);
      if ((e as Error).name === 'InvalidStateError' && (e as Error).message.includes('stable')) {
        console.log(`Skipping duplicate SDP from ${from}`);
        return false;
      }
      throw e;
    }
  } else if (data.candidate) {
    try {
      await peer.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      console.log(`ICE candidate added for ${from}`);
    } catch (e) {
      console.warn(`Failed to add ICE candidate for ${from}:`, e);
    }
  }
  return true;
}

export function createRemoteVideoElement(peerId: string): HTMLElement {
  const videoContainer = document.createElement('div');
  videoContainer.className = 'video-container remote-video';
  videoContainer.id = `video-${peerId}`;
  
  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  video.id = `remoteVideo-${peerId}`;
  
  videoContainer.appendChild(video);
  const av = document.createElement('div');
  av.className = 'avatar';
  const userName = appStore.userNames().get(peerId) || '•';
  av.textContent = userName.charAt(0).toUpperCase();
  videoContainer.appendChild(av);
  
  return videoContainer;
}

