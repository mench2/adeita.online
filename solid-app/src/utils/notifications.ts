let currentToast: HTMLElement | null = null;
let toastTimeout: ReturnType<typeof setTimeout> | null = null;

export function showNotification(message: string = '') {
  const nameModalEl = document.getElementById('nameModal');
  if (nameModalEl) {
    const modalVisible = getComputedStyle(nameModalEl).display !== 'none' && nameModalEl.offsetParent !== null;
    if (modalVisible) return;
  }

  // Удаляем предыдущий toast если он есть
  if (currentToast) {
    currentToast.remove();
    currentToast = null;
  }
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }

  const toast = document.createElement('div');
  toast.className = 'copy-popover';
  // Используем textContent для безопасности вместо innerHTML
  const check = document.createElement('div');
  check.className = 'check';
  check.textContent = '✓';
  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = message;
  toast.appendChild(check);
  toast.appendChild(label);
  
  document.body.appendChild(toast);
  currentToast = toast;

  const controls = document.getElementById('callControls');
  const controlsRect = controls ? controls.getBoundingClientRect() : null;
  const toastRect = toast.getBoundingClientRect();
  const left = Math.max(8, (window.innerWidth - toastRect.width) / 2);
  const top = controlsRect ? Math.max(8, controlsRect.top - 16 - toastRect.height) : Math.max(8, window.innerHeight - 110 - toastRect.height);
  toast.style.left = left + 'px';
  toast.style.top = top + 'px';

  requestAnimationFrame(() => toast.classList.add('show'));
  
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
      if (currentToast === toast) currentToast = null;
    }, 150);
  }, 1800);
}

