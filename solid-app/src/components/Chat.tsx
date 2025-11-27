import { createSignal, For, createEffect, Show, batch } from 'solid-js';
import { IS_MOBILE } from '../utils/detection';
import * as appStore from '../stores/appStore';
import { getSocket } from '../hooks/useSocket';

export default function Chat() {
  const [input, setInput] = createSignal('');
  let chatMessagesEl!: HTMLDivElement;
  let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

  createEffect(() => {
    appStore.chatMessages();
    
    // Debounce scroll для производительности
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      if (chatMessagesEl) {
        requestAnimationFrame(() => {
          chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
        });
      }
    }, 10);
  });

  const sendMessage = () => {
    const text = input().trim();
    if (!text) return;
    
    if (!appStore.userName() && !IS_MOBILE) {
      batch(() => {
        appStore.setPendingChatText(text);
        appStore.setShowNameModal(true);
      });
      return;
    }
    
    const socket = getSocket();
    socket?.emit('chat-message', {
      author: appStore.userName(),
      text: text,
      timestamp: new Date()
    });
    
    batch(() => {
      appStore.addChatMessage(appStore.userName(), text, true);
      setInput('');
    });
  };

  return (
    <Show when={appStore.isChatVisible() && !IS_MOBILE}>
      <div class="chat-section" id="chatSection">
        <div class="chat-header">
          <div class="chat-title">Chat</div>
        </div>
        <div class="chat-messages" id="chatMessages" ref={chatMessagesEl}>
          <For each={appStore.chatMessages()}>
            {(msg) => (
              <div class={`chat-message ${msg.isOwn ? 'own' : 'other'}`}>
                <div class="chat-message-author">{msg.author}</div>
                <div class="chat-message-text">{msg.text}</div>
                <div class="chat-message-time">{appStore.formatTime(msg.timestamp)}</div>
              </div>
            )}
          </For>
        </div>
        <div class="chat-input-container">
          <input
            type="text"
            id="chatInput"
            placeholder="Напишите сообщение..."
            maxLength={500}
            value={input()}
            onInput={(e) => setInput(e.currentTarget.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          />
          <button class="chat-send-btn" id="chatSendBtn" onClick={sendMessage}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>
    </Show>
  );
}
