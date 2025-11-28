import { createSignal, Show } from 'solid-js';
import * as appStore from '../stores/appStore';

export type VideoQualityPreset = '1080p' | '720p' | '480p' | 'auto';

interface VideoQualitySettingsProps {
  onQualityChange: (quality: VideoQualityPreset) => void;
  currentQuality: () => VideoQualityPreset;
}

export default function VideoQualitySettings(props: VideoQualitySettingsProps) {
  const qualities: { value: VideoQualityPreset; label: string; description: string }[] = [
    { value: '1080p', label: '1080p', description: 'Высокое качество' },
    { value: '720p', label: '720p', description: 'Среднее качество' },
    { value: '480p', label: '480p', description: 'Экономия трафика' },
    { value: 'auto', label: 'Авто', description: 'Адаптивное' }
  ];

  return (
    <div class="video-quality-settings">
      <div class="quality-title">Качество видео</div>
      <div class="quality-options">
        {qualities.map(q => (
          <button
            class={`quality-option ${props.currentQuality() === q.value ? 'active' : ''}`}
            onClick={() => props.onQualityChange(q.value)}
          >
            <div class="quality-label">{q.label}</div>
            <div class="quality-description">{q.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

