import { createSignal, createEffect, onCleanup, Show } from 'solid-js';
import * as peersStore from '../stores/peersStore';

export default function ConnectionQualityIndicator() {
  const [quality, setQuality] = createSignal<'excellent' | 'good' | 'poor' | 'unknown'>('unknown');
  const [ping, setPing] = createSignal<number>(0);
  const [packetLoss, setPacketLoss] = createSignal<number>(0);
  
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const checkConnectionQuality = async () => {
    const peers = peersStore.peers();
    if (peers.size === 0) {
      setQuality('unknown');
      setPing(0);
      setPacketLoss(0);
      return;
    }

    let totalRtt = 0;
    let totalPacketLoss = 0;
    let count = 0;

    for (const [peerId, peer] of peers.entries()) {
      try {
        const stats = await peer.pc.getStats();
        stats.forEach((report: any) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            if (report.currentRoundTripTime) {
              totalRtt += report.currentRoundTripTime * 1000; // конвертируем в ms
              count++;
            }
          }
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            if (report.packetsLost && report.packetsReceived) {
              const loss = (report.packetsLost / (report.packetsLost + report.packetsReceived)) * 100;
              totalPacketLoss += loss;
            }
          }
        });
      } catch (error) {
        console.warn(`Failed to get stats for peer ${peerId}:`, error);
      }
    }

    if (count > 0) {
      const avgRtt = Math.round(totalRtt / count);
      const avgPacketLoss = totalPacketLoss / peers.size;
      
      setPing(avgRtt);
      setPacketLoss(Math.round(avgPacketLoss));

      // Определяем качество соединения
      if (avgRtt < 100 && avgPacketLoss < 2) {
        setQuality('excellent');
      } else if (avgRtt < 200 && avgPacketLoss < 5) {
        setQuality('good');
      } else {
        setQuality('poor');
      }
    }
  };

  createEffect(() => {
    // Запускаем проверку каждые 2 секунды
    intervalId = setInterval(checkConnectionQuality, 2000);
    
    onCleanup(() => {
      if (intervalId) clearInterval(intervalId);
    });
  });

  const getQualityIcon = () => {
    switch (quality()) {
      case 'excellent': return '📶';
      case 'good': return '📶';
      case 'poor': return '📵';
      default: return '⚪';
    }
  };

  const getQualityColor = () => {
    switch (quality()) {
      case 'excellent': return '#16a34a';
      case 'good': return '#d97706';
      case 'poor': return '#dc2626';
      default: return '#8a8a8a';
    }
  };

  const getQualityText = () => {
    switch (quality()) {
      case 'excellent': return 'Отлично';
      case 'good': return 'Хорошо';
      case 'poor': return 'Плохо';
      default: return '—';
    }
  };

  return (
    <Show when={peersStore.peers().size > 0}>
      <div class="connection-quality-indicator">
        <div class="quality-icon" style={{ color: getQualityColor() }}>
          {getQualityIcon()}
        </div>
        <div class="quality-details">
          <div class="quality-text" style={{ color: getQualityColor() }}>
            {getQualityText()}
          </div>
          <div class="quality-stats">
            <span class="ping">{ping()}ms</span>
            {packetLoss() > 0 && (
              <span class="packet-loss"> • {packetLoss()}% потерь</span>
            )}
          </div>
        </div>
      </div>
    </Show>
  );
}

