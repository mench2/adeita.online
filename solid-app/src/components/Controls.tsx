import { createSignal, Show, onMount, onCleanup, createEffect } from 'solid-js';
import * as appStore from '../stores/appStore';
import { createMediaState } from '../utils/mediaState';
import type { Accessor } from 'solid-js';

export default function Controls(props: {
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleFlashlight: () => void;
  onSwapCamera: () => void;
  onToggleScreenShare: () => void;
  onCopyLink: () => void;
  onHangup: () => void;
  flashlightEnabled: boolean;
  localStream: Accessor<MediaStream | null>;
}) {
  const mediaState = createMediaState(props.localStream);
  const [showSettings, setShowSettings] = createSignal(false);
  let settingsSubmenu!: HTMLDivElement;
  let flashlightBtn!: HTMLButtonElement;
  let transBtn!: HTMLButtonElement;

  const openSettingsMenu = () => {
    if (!settingsSubmenu) return;
    settingsSubmenu.classList.remove('hiding');
    settingsSubmenu.classList.add('show');
    setShowSettings(true);
  };

  const closeSettingsMenu = () => {
    if (!settingsSubmenu || !settingsSubmenu.classList.contains('show')) return;
    settingsSubmenu.classList.remove('show');
    settingsSubmenu.classList.add('hiding');
    const onEnd = () => {
      if (!settingsSubmenu) return;
      settingsSubmenu.classList.remove('hiding');
      settingsSubmenu.removeEventListener('animationend', onEnd);
      setShowSettings(false);
    };
    settingsSubmenu.addEventListener('animationend', onEnd, { once: true });
  };

  const toggleSettingsMenu = () => {
    if (showSettings()) closeSettingsMenu();
    else openSettingsMenu();
  };

  // Обновляем текст кнопки flashlight при изменении состояния
  createEffect(() => {
    if (flashlightBtn) {
      const textEl = flashlightBtn.querySelector('span');
      if (textEl) {
        textEl.textContent = props.flashlightEnabled ? 'OFF' : 'ON';
      }
      if (props.flashlightEnabled) {
        flashlightBtn.classList.add('active');
      } else {
        flashlightBtn.classList.remove('active');
      }
    }
  });

  // Обновляем текст кнопки Trans при изменении состояния
  createEffect(() => {
    if (transBtn) {
      const textEl = transBtn.querySelector('span');
      if (textEl) {
        textEl.textContent = appStore.isScreenSharing() ? 'Stop' : 'Trans';
      }
      if (appStore.isScreenSharing()) {
        transBtn.classList.add('active');
      } else {
        transBtn.classList.remove('active');
      }
    }
  });

  onMount(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const settingsBtn = document.getElementById('settingsBtn');
      const clickedInside = settingsSubmenu?.contains(target) || settingsBtn?.contains(target);
      if (!clickedInside && showSettings()) {
        closeSettingsMenu();
      }
    };
    document.addEventListener('click', handleClick);
    onCleanup(() => document.removeEventListener('click', handleClick));
  });

  return (
    <Show when={appStore.showControls()}>
      <div class="call-controls" id="callControls">
        <div class="control-group">
          <button class={`control-btn round mic primary ${mediaState.isAudioEnabled() ? 'enabled' : ''}`} id="toggleMic" onClick={props.onToggleMic} title="Mic">
            <img src="/icon/mic_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg" alt="Mic" width="24" height="24" />
          </button>
          <button class={`control-btn round video ${mediaState.isVideoEnabled() ? 'enabled' : ''}`} id="toggleCam" onClick={props.onToggleCam} title="Video">
            <img src="/icon/videocam_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg" alt="Video" width="24" height="24" />
          </button>
          <div class="settings-fab-wrap">
            <button class="control-btn round settings" id="settingsBtn" onClick={toggleSettingsMenu} title="Settings">
              <img src="/icon/settings_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg" alt="Settings" width="24" height="24" />
            </button>
            <div class="settings-submenu" id="settingsSubmenu" ref={settingsSubmenu}>
              <button class={`settings-pill ${appStore.isScreenSharing() ? 'active' : ''}`} id="transBtn" ref={transBtn} onClick={props.onToggleScreenShare}>
                <img src="/icon/screen_share_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg" alt="Screen Share" width="20" height="20" />
                <span>{appStore.isScreenSharing() ? 'Stop' : 'Trans'}</span>
              </button>
              <button class={`settings-pill ${props.flashlightEnabled ? 'active' : ''}`} id="flashlightToggle" ref={flashlightBtn} onClick={props.onToggleFlashlight}>
                <img src="/icon/flashlight_on_24dp_345D2F_FILL0_wght400_GRAD0_opsz24.svg" alt="Flashlight" width="20" height="20" />
                <span>{props.flashlightEnabled ? 'OFF' : 'ON'}</span>
              </button>
              <button class="settings-pill" id="swapCameraBtn" onClick={props.onSwapCamera}>
                <img src="/icon/cameraswitch_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg" alt="Swap Camera" width="20" height="20" />
                <span>Swap</span>
              </button>
            </div>
          </div>
          <button class="control-btn round copy-link" id="copyLinkBtn" onClick={props.onCopyLink} title="Share">
            <img src="/icon/share_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg" alt="Share" width="24" height="24" />
          </button>
        </div>
        <div class="hangup-wrap">
          <button class="control-btn leave" id="hangupBtn" onClick={props.onHangup} title="Leave">
            <img src="/icon/call_end_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg" alt="Leave" width="32" height="32" />
          </button>
        </div>
      </div>
    </Show>
  );
}

