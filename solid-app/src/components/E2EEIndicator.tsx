import { Show } from 'solid-js';
import * as appStore from '../stores/appStore';

export default function E2EEIndicator() {
  return (
    <Show when={appStore.e2eeEnabled()}>
      <div class="e2ee-indicator" title="Соединение защищено сквозным шифрованием">
        🔒 Зашифровано
      </div>
    </Show>
  );
}


