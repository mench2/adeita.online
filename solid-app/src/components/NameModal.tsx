import { createSignal, Show, onMount } from 'solid-js';
import * as appStore from '../stores/appStore';
import { getSocket } from '../hooks/useSocket';
import { showNotification } from '../utils/notifications';

export default function NameModal() {
  const [name, setName] = createSignal('');
  let inputEl!: HTMLInputElement;

  onMount(() => {
    if (appStore.showNameModal() && inputEl) {
      setTimeout(() => {
        inputEl.focus();
        inputEl.select();
      }, 100);
    }
  });

  const confirm = () => {
    const n = name().trim();
    if (n.length < 2) {
      showNotification('Имя должно содержать минимум 2 символа');
      return;
    }
    if (n.length > 20) {
      showNotification('Имя не должно превышать 20 символов');
      return;
    }
    appStore.setUserName(n);
    appStore.setShowNameModal(false);
    const socket = getSocket();
    socket?.emit('set-user-name', { userName: n });
    const pending = appStore.pendingChatText();
    if (pending && pending.trim()) {
      socket?.emit('chat-message', {
        author: n,
        text: pending,
        timestamp: new Date()
      });
      appStore.addChatMessage(n, pending, true);
      appStore.setPendingChatText(null);
    }
    setName('');
  };

  return (
    <Show when={appStore.showNameModal()}>
      <div class="name-modal" id="nameModal" style="display: flex;">
        <div class="name-modal-content">
          <h3>Как вас зовут?</h3>
          <p>Введите ваше имя для участия в чате</p>
          <input
            type="text"
            id="userNameInput"
            placeholder="Ваше имя"
            maxLength={20}
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            onKeyPress={(e) => e.key === 'Enter' && confirm()}
            ref={inputEl}
          />
          <div class="name-modal-buttons">
            <button class="btn-primary" id="confirmNameBtn" onClick={confirm}>Продолжить</button>
          </div>
        </div>
      </div>
    </Show>
  );
}

