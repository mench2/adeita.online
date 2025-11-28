import { createSignal, Show, onMount, onCleanup } from 'solid-js';
import * as appStore from '../stores/appStore';

export type VideoQualityPreset = '1080p' | '720p' | '480p' | 'auto';

interface VideoQualitySettingsProps {
  onQualityChange: (quality: VideoQualityPreset) => void;
  currentQuality: () => VideoQualityPreset;
}

export default function VideoQualitySettings(props: VideoQualitySettingsProps) {
  const [showQualityMenu, setShowQualityMenu] = createSignal(false);
  let qualitySubmenu!: HTMLDivElement;

  const qualities: { value: VideoQualityPreset; label: string; icon: string }[] = [
    { value: '1080p', label: '1080p', icon: '🎬' },
    { value: '720p', label: '720p', icon: '📹' },
    { value: '480p', label: '480p', icon: '📱' },
    { value: 'auto', label: 'Авто', icon: '⚡' }
  ];

  const getCurrentLabel = () => {
    const current = qualities.find(q => q.value === props.currentQuality());
    return current ? `${current.icon} ${current.label}` : '📹 Качество';
  };

  const openQualityMenu = () => {
    if (!qualitySubmenu) return;
    qualitySubmenu.classList.remove('hiding');
    qualitySubmenu.classList.add('show');
    setShowQualityMenu(true);
  };

  const closeQualityMenu = () => {
    if (!qualitySubmenu || !qualitySubmenu.classList.contains('show')) return;
    qualitySubmenu.classList.remove('show');
    qualitySubmenu.classList.add('hiding');
    const onEnd = () => {
      if (!qualitySubmenu) return;
      qualitySubmenu.classList.remove('hiding');
      qualitySubmenu.removeEventListener('animationend', onEnd);
      setShowQualityMenu(false);
    };
    qualitySubmenu.addEventListener('animationend', onEnd, { once: true });
  };

  const toggleQualityMenu = () => {
    if (showQualityMenu()) closeQualityMenu();
    else openQualityMenu();
  };

  const handleQualitySelect = (quality: VideoQualityPreset) => {
    props.onQualityChange(quality);
    closeQualityMenu();
  };

  onMount(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const clickedInside = qualitySubmenu?.contains(target);
      if (!clickedInside && showQualityMenu()) {
        closeQualityMenu();
      }
    };
    document.addEventListener('click', handleClick);
    onCleanup(() => document.removeEventListener('click', handleClick));
  });

  return (
    <div class="video-quality-wrap">
      <button class="settings-pill" onClick={toggleQualityMenu}>
        <span class="icon">📹</span>
        <span>{getCurrentLabel()}</span>
      </button>
      <div class="quality-submenu" ref={qualitySubmenu}>
        {qualities.map(q => (
          <button
            class={`settings-pill quality-item ${props.currentQuality() === q.value ? 'active' : ''}`}
            onClick={() => handleQualitySelect(q.value)}
          >
            <span class="icon">{q.icon}</span>
            <span>{q.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

