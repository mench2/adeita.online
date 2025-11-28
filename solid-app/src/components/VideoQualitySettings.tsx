import { createSignal } from 'solid-js';
import * as appStore from '../stores/appStore';

export type VideoQualityPreset = '1080p' | '720p' | '480p' | 'auto';

interface VideoQualitySettingsProps {
  onQualityChange: (quality: VideoQualityPreset) => void;
  currentQuality: () => VideoQualityPreset;
  showQualityMenu: () => boolean;
  onToggleQualityMenu: () => void;
}

export default function VideoQualitySettings(props: VideoQualitySettingsProps) {
  const qualities: { value: VideoQualityPreset; label: string; icon: string }[] = [
    { value: '1080p', label: '1080p', icon: '🎬' },
    { value: '720p', label: '720p', icon: '📹' },
    { value: '480p', label: '480p', icon: '📱' },
    { value: 'auto', label: 'Авто', icon: '⚡' }
  ];

  const getCurrentLabel = () => {
    const current = qualities.find(q => q.value === props.currentQuality());
    return current ? `${current.label}` : 'Качество';
  };

  const handleQualitySelect = (quality: VideoQualityPreset) => {
    props.onQualityChange(quality);
    // Не закрываем меню, пользователь сам закроет кнопкой "Назад"
  };

  return (
    <>
      {/* Показываем либо кнопку "Качество", либо варианты качества */}
      {!props.showQualityMenu() ? (
        <button class="settings-pill" onClick={props.onToggleQualityMenu}>
          <span class="icon">📹</span>
          <span>{getCurrentLabel()}</span>
        </button>
      ) : (
        <>
          {qualities.map(q => (
            <button
              class={`settings-pill quality-option ${props.currentQuality() === q.value ? 'active' : ''}`}
              onClick={() => handleQualitySelect(q.value)}
            >
              <span class="icon">{q.icon}</span>
              <span>{q.label}</span>
            </button>
          ))}
          {/* Кнопка "Назад" */}
          <button class="settings-pill back-button" onClick={props.onToggleQualityMenu}>
            <span class="icon">←</span>
            <span>Назад</span>
          </button>
        </>
      )}
    </>
  );
}

