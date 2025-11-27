import { Show, createSignal, onMount } from 'solid-js';
import * as appStore from '../stores/appStore';

export default function ConnectionTypeSelector() {
  const [isLockedByUrl, setIsLockedByUrl] = createSignal(false);

  onMount(() => {
    // Проверяем есть ли параметр direct в URL
    const urlParams = new URLSearchParams(window.location.search);
    const directParam = urlParams.get('direct');
    const roomParam = urlParams.get('room');
    
    // Если пришли по ссылке с комнатой и параметром direct - блокируем выбор
    if (roomParam && directParam !== null) {
      setIsLockedByUrl(true);
    }
  });

  return (
    <Show when={!appStore.showControls()}>
      <div class="connection-type-selector-compact">
        <div class="connection-compact-row">
          <div class="connection-compact-label">
            {appStore.useDirectConnection() ? '🔒 Секретное' : '🌐 Через сервер'}
          </div>
          <div class="connection-toggle-wrap">
            <button
              class={`connection-toggle ${isLockedByUrl() ? 'locked' : ''}`}
              onClick={() => !isLockedByUrl() && appStore.setUseDirectConnection(!appStore.useDirectConnection())}
              disabled={isLockedByUrl()}
              title={isLockedByUrl() ? 'Установлено создателем' : 'Переключить тип подключения'}
            >
              <div class={`toggle-slider ${appStore.useDirectConnection() ? 'direct' : 'relay'}`}>
                <div class="toggle-icon">
                  {appStore.useDirectConnection() ? '🔒' : '🌐'}
                </div>
              </div>
            </button>
          </div>
        </div>
        <div class="connection-compact-hint">
          {isLockedByUrl() 
            ? '🔐 Установлено создателем'
            : appStore.useDirectConnection() 
              ? 'Прямое P2P' 
              : 'Надежнее'}
        </div>
      </div>
    </Show>
  );
}

