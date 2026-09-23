const TG = window.Telegram?.WebApp;

export function initTelegram() {
  if (!TG) return { ready: false };
  try {
    TG.ready();
    TG.expand();
    if (TG.setHeaderColor) TG.setHeaderColor('#06080c');
    if (TG.setBackgroundColor) TG.setBackgroundColor('#06080c');
  } catch {
    /* ignore */
  }
  return { ready: true, webApp: TG };
}

export function getInitData() {
  return TG?.initData || '';
}

export function haptic(type = 'light') {
  try {
    TG?.HapticFeedback?.impactOccurred?.(type);
  } catch {
    /* ignore */
  }
}

export function hapticNotify(type = 'success') {
  try {
    TG?.HapticFeedback?.notificationOccurred?.(type);
  } catch {
    /* ignore */
  }
}
