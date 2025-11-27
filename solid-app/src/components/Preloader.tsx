import { Show } from 'solid-js';
import * as appStore from '../stores/appStore';

export default function Preloader() {
  return (
    <Show when={appStore.showProgress()}>
      <div class="preloader" id="preloader">
        <div class="logo">Adeita Vichat</div>
        <div class="spinner"></div>
        <Show when={appStore.progressText()}>
          <div>{appStore.progressText()}</div>
        </Show>
      </div>
    </Show>
  );
}

