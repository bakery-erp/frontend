import { api } from './axios';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.warn('[Push] ServiceWorker registration failed:', err);
    return null;
  }
}

const DEFAULT_VAPID_PUBLIC_KEY = 'BNuLLLYPRoS_3gl__0KwuYjlmkAsAptU5fyEnGxZ4WDn4k94dBGsXDA2pFjpEid6SUztE4iVljbioypCbkzvdU8';

export async function getVapidPublicKey(): Promise<string> {
  // Use environment variable if available
  if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  }

  // Fallback to fetch from backend API
  try {
    const res = await api.get('/notifications/public-key');
    if (res.data?.vapidPublicKey) {
      return res.data.vapidPublicKey;
    }
  } catch (err) {
    console.warn('[Push] Failed to fetch VAPID public key:', err);
  }

  return DEFAULT_VAPID_PUBLIC_KEY;
}

export async function subscribeToPushNotifications(): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined') return { success: false, error: 'Window undefined' };

  if (!('Notification' in window)) {
    return { success: false, error: 'Notifications not supported by this browser' };
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { success: false, error: 'Push messaging is not supported by this browser' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { success: false, error: permission === 'denied' ? 'Permission denied' : 'Permission not granted' };
  }

  const registration = await registerServiceWorker();
  if (!registration) {
    return { success: false, error: 'Could not register service worker' };
  }

  const vapidKey = await getVapidPublicKey();
  if (!vapidKey) {
    return { success: false, error: 'VAPID public key unavailable' };
  }

  try {
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const convertedKey = urlBase64ToUint8Array(vapidKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });
    }

    // Send subscription to server
    await api.post('/notifications/subscribe', {
      subscription: subscription.toJSON(),
    });

    return { success: true };
  } catch (err: any) {
    console.error('[Push] Subscribe error:', err);
    return { success: false, error: err.message || 'Subscription failed' };
  }
}

export async function syncPushSubscription(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }
  try {
    const registration = await registerServiceWorker();
    if (!registration) return false;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const vapidKey = await getVapidPublicKey();
      if (!vapidKey) return false;
      const convertedKey = urlBase64ToUint8Array(vapidKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });
    }

    if (subscription) {
      await api.post('/notifications/subscribe', {
        subscription: subscription.toJSON(),
      });
      return true;
    }
  } catch (err) {
    console.warn('[Push] Auto-sync error:', err);
  }
  return false;
}

export async function unsubscribePush(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.post('/notifications/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
      }
    }
    return true;
  } catch {
    return false;
  }
}

export async function getPushSubscriptionState(): Promise<{
  isSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  isSubscribed: boolean;
}> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return { isSupported: false, permission: 'unsupported', isSubscribed: false };
  }

  const permission = Notification.permission;
  let isSubscribed = false;

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      isSubscribed = !!sub;
    }
  } catch {
    // ignore
  }

  return {
    isSupported: true,
    permission,
    isSubscribed,
  };
}
