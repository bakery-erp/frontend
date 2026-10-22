'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  AlertTriangle, 
  Package, 
  Truck, 
  BadgePercent, 
  Key, 
  FileText, 
  Sparkles,
  Smartphone,
  CheckCircle2,
  X
} from 'lucide-react';
import { api } from '@/lib/axios';
import { toast } from 'sonner';
import { useLanguage } from '../context/LanguageContext';
import { 
  getPushSubscriptionState, 
  subscribeToPushNotifications, 
  registerServiceWorker,
  syncPushSubscription
} from '../lib/pushNotifications';

interface NotificationItem {
  id: string;
  type: string;
  titleKey: string;
  bodyKey: string;
  variables: Record<string, any>;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationBell() {
  const { t } = useLanguage();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [pushStatus, setPushStatus] = useState<{
    isSupported: boolean;
    permission: NotificationPermission | 'unsupported';
    isSubscribed: boolean;
  }>({
    isSupported: false,
    permission: 'unsupported',
    isSubscribed: false,
  });
  const [isSubscribing, setIsSubscribing] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testSent, setTestSent] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);

  // Load push status, register service worker, and auto-sync subscription on mount
  useEffect(() => {
    registerServiceWorker().catch(() => {});
    syncPushSubscription()
      .then(() => getPushSubscriptionState().then(setPushStatus).catch(() => {}))
      .catch(() => getPushSubscriptionState().then(setPushStatus).catch(() => {}));
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications?limit=25');
      if (res.data) {
        const items: NotificationItem[] = res.data.items || [];
        setNotifications(items);
        setUnreadCount(res.data.unreadCount || 0);

        if (!initialLoadDoneRef.current) {
          items.forEach((item) => knownIdsRef.current.add(item.id));
          initialLoadDoneRef.current = true;
        } else {
          // Find newly arrived unread notifications and pop up immediate toast
          const newUnreads = items.filter((item) => !item.isRead && !knownIdsRef.current.has(item.id));
          for (const item of newUnreads) {
            knownIdsRef.current.add(item.id);
            const title = t(item.titleKey, item.variables);
            const body = t(item.bodyKey, item.variables);

            toast(title, {
              description: body,
              duration: 8000,
              icon: item.type.includes('OUT') || item.type.includes('LOW') ? '⚠️' : '🔔',
              action: item.link ? {
                label: t('common.view') || 'View',
                onClick: () => {
                  if (item.link) router.push(item.link);
                },
              } : undefined,
            });

            if (typeof window !== 'undefined' && 'vibrate' in navigator) {
              try {
                navigator.vibrate([150, 75, 150]);
              } catch {}
            }
          }
        }
      }
    } catch (err) {
      // Silently ignore if not logged in or network error
    }
  };

  // Listen to service worker push events for immediate popup
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const handleSwMessage = (event: MessageEvent) => {
        if (event.data?.type === 'PUSH_NOTIFICATION_RECEIVED') {
          fetchNotifications();
        }
      };
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      };
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    const handleFocusOrVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchNotifications();
      }
    };
    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);

    // Fast polling: 4s when tab is active/visible, 20s when in background
    let interval: NodeJS.Timeout;
    const startPolling = () => {
      clearInterval(interval);
      const isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
      interval = setInterval(fetchNotifications, isVisible ? 4000 : 20000);
    };

    startPolling();
    document.addEventListener('visibilitychange', startPolling);

    return () => {
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', startPolling);
      clearInterval(interval);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      fetchNotifications();
    }
  };

  const handleMarkAsRead = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setIsLoading(true);
      await api.post('/notifications/read-all');
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.isRead) {
      try {
        await api.patch(`/notifications/${item.id}/read`);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // ignore
      }
    }
    setIsOpen(false);
    if (item.link) {
      router.push(item.link);
    }
  };

  const handleEnablePush = async () => {
    setIsSubscribing(true);
    try {
      const res = await subscribeToPushNotifications();
      const nextState = await getPushSubscriptionState();
      setPushStatus(nextState);
    } catch (err) {
      console.error('Failed to enable push notifications:', err);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleSendTestPush = async () => {
    setIsTesting(true);
    try {
      await api.post('/notifications/test');
      setTestSent(true);
      setTimeout(() => setTestSent(false), 3000);
      fetchNotifications();
    } catch (err) {
      console.error('Failed to send test push:', err);
    } finally {
      setIsTesting(false);
    }
  };

  const formatRelativeTime = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 2) return t('notifications.justNow');
    if (diffMin < 60) return t('notifications.minutesAgo', { minutes: diffMin });
    if (diffHr < 24) return t('notifications.hoursAgo', { hours: diffHr });
    return t('notifications.daysAgo', { days: diffDay });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'LOW_STOCK':
      case 'OUT_OF_STOCK':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'DAILY_CLOSE_SUBMITTED':
      case 'DAILY_CLOSE_APPROVED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'STOCK_INWARD_ADDED':
      case 'STOCK_CONFIRMED':
        return <Package className="w-4 h-4 text-emerald-500" />;
      case 'PRODUCTION_COMPLETED':
        return <Sparkles className="w-4 h-4 text-purple-500" />;
      case 'UNPAID_DELIVERY':
      case 'DELIVERY_RETURN':
        return <Truck className="w-4 h-4 text-blue-500" />;
      case 'STOCK_PURCHASE_LOAN':
      case 'LOAN_REQUESTED':
      case 'LOAN_APPROVED':
      case 'LOAN_REJECTED':
        return <BadgePercent className="w-4 h-4 text-indigo-500" />;
      case 'PENALTY_ISSUED':
        return <AlertTriangle className="w-4 h-4 text-rose-500" />;
      case 'PAYROLL_GENERATED':
      case 'PAYROLL_SIGNED':
        return <FileText className="w-4 h-4 text-teal-500" />;
      case 'PASSWORD_RESET_REQUESTED':
        return <Key className="w-4 h-4 text-orange-500" />;
      default:
        return <Package className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        aria-label={t('notifications.title')}
        className="relative p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/30"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-rose-500 rounded-full ring-2 ring-white dark:ring-gray-900 animate-in zoom-in-50">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu & Mobile Backdrop */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] sm:hidden z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed inset-x-2.5 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 max-h-[82vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/50">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-gray-900 dark:text-white text-sm">
                  {t('notifications.title')}
                </span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-[11px] font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-full">
                    {t('notifications.unreadBadge', { count: unreadCount })}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    disabled={isLoading}
                    className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 font-semibold px-2 py-1 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors flex items-center gap-1"
                    title={t('notifications.markAllAsRead')}
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">{t('notifications.markAllAsRead')}</span>
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Web Push Prompt Banner */}
            {pushStatus.isSupported && (
              <div className="px-3.5 py-2.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-b border-amber-100/80 dark:border-amber-900/40 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Smartphone className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="text-gray-800 dark:text-gray-200 font-medium truncate">
                    {pushStatus.isSubscribed
                      ? t('notifications.pushEnabled')
                      : t('notifications.enablePush')}
                  </span>
                </div>
                {!pushStatus.isSubscribed && pushStatus.permission !== 'denied' && (
                  <button
                    onClick={handleEnablePush}
                    disabled={isSubscribing}
                    className="px-3 py-1 font-bold text-white bg-amber-600 hover:bg-amber-700 active:scale-95 rounded-xl shadow-sm transition-all shrink-0 text-xs"
                  >
                    {isSubscribing ? '...' : t('common.confirm')}
                  </button>
                )}
                {pushStatus.permission === 'denied' && (
                  <span className="text-[10px] text-rose-500 font-semibold shrink-0">
                    {t('notifications.pushBlocked')}
                  </span>
                )}
                {pushStatus.isSubscribed && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      <Check className="w-3.5 h-3.5" /> Active
                    </span>
                    <button
                      onClick={handleSendTestPush}
                      disabled={isTesting}
                      className="px-2 py-0.5 text-[10px] font-semibold bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-50 active:scale-95 transition-all shadow-xs"
                    >
                      {isTesting ? '...' : testSent ? t('notifications.testSent') : t('notifications.sendTest')}
                    </button>
                  </div>
                )}
              </div>
            )}

          {/* Notifications List */}
          <div className="overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60 max-h-[55vh] flex-1">
            {notifications.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <Bell className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2 stroke-[1.5]" />
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                  {t('notifications.noNotifications')}
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const title = t(item.titleKey, item.variables);
                const body = t(item.bodyKey, item.variables);

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                      !item.isRead
                        ? 'bg-amber-50/40 dark:bg-amber-950/10'
                        : ''
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 shrink-0 mt-0.5">
                      {getNotificationIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h4
                          className={`text-xs font-semibold truncate ${
                            !item.isRead
                              ? 'text-gray-900 dark:text-white'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {title}
                        </h4>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                        {body}
                      </p>
                    </div>
                    {!item.isRead && (
                      <button
                        onClick={(e) => handleMarkAsRead(e, item.id)}
                        className="w-2 h-2 rounded-full bg-amber-500 mt-2 shrink-0 hover:scale-125 transition-transform"
                        title={t('common.confirm')}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
        </>
      )}
    </div>
  );
}
