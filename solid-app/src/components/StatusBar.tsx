import { Show } from 'solid-js';
import * as appStore from '../stores/appStore';
import * as peersStore from '../stores/peersStore';
import { createSignal, createEffect, onCleanup } from 'solid-js';

export default function StatusBar() {
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
              totalRtt += report.currentRoundTripTime * 1000;
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
    intervalId = setInterval(checkConnectionQuality, 2000);
    
    onCleanup(() => {
      if (intervalId) clearInterval(intervalId);
    });
  });

  const getQualityColor = () => {
    switch (quality()) {
      case 'excellent': return '#16a34a';
      case 'good': return '#d97706';
      case 'poor': return '#dc2626';
      default: return '#8a8a8a';
    }
  };

  const handleToggle = () => {
    if (appStore.roomId() && appStore.showControls()) {
      // Уже в комнате, не даем переключать
      return;
    }
    appStore.setUseDirectConnection(!appStore.useDirectConnection());
  };

  const isLocked = () => appStore.roomId() && appStore.showControls();

  return (
    <Show when={appStore.showControls()}>
      <div class="status-bar">
        {/* E2EE индикатор */}
        <div class="status-bar-item e2ee-status">
          <span class="status-icon">🔒</span>
          <span class="status-text">Зашифровано</span>
        </div>

        {/* Разделитель */}
        <div class="status-bar-divider"></div>

        {/* Тумблер или пинг */}
        <Show
          when={peersStore.peers().size > 0}
          fallback={
            <div class="status-bar-item connection-type">
              <span class="status-text">{appStore.useDirectConnection() ? 'Секретное' : 'Через сервер'}</span>
              <button 
                class={`connection-toggle-mini ${isLocked() ? 'locked' : ''}`}
                onClick={handleToggle}
                disabled={isLocked()}
                title={isLocked() ? 'Нельзя изменить во время звонка' : 'Переключить тип подключения'}
              >
                <div class={`toggle-slider-mini ${appStore.useDirectConnection() ? 'direct' : ''}`}>
                  <span class="toggle-icon-mini">{appStore.useDirectConnection() ? '🔒' : '🌐'}</span>
                </div>
              </button>
            </div>
          }
        >
          <div class="status-bar-item ping-status">
            <span class="status-icon" style={{ color: getQualityColor() }}>📶</span>
            <span class="status-text" style={{ color: getQualityColor() }}>
              {ping()}ms
              {packetLoss() > 0 && ` • ${packetLoss()}%`}
            </span>
          </div>
        </Show>
      </div>
    </Show>
  );
}

