import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, CheckCircle, AlertTriangle, Cloud, CloudOff } from 'lucide-react';
import { useSyncStore } from '../../store/syncStore';

export default function OfflineBanner() {
  const { syncStatus, isSyncing, sync, pendingConflicts } = useSyncStore();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowBanner(true);
      setTimeout(() => setShowBanner(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline && !isSyncing && pendingConflicts.length === 0) {
      setShowBanner(false);
    }
  }, [isOnline, isSyncing, pendingConflicts]);

  if (!showBanner && isOnline) {
    return null;
  }

  const getStatusConfig = () => {
    if (!isOnline) {
      return {
        bg: 'bg-gradient-to-r from-amber-500 to-orange-500',
        icon: WifiOff,
        text: 'Offline Mode — Changes will sync when connected',
        animate: true,
      };
    }

    if (syncStatus === 'syncing') {
      return {
        bg: 'bg-gradient-to-r from-blue-500 to-blue-600',
        icon: RefreshCw,
        text: 'Syncing...',
        animate: true,
      };
    }

    if (syncStatus === 'error') {
      return {
        bg: 'bg-gradient-to-r from-red-500 to-red-600',
        icon: AlertTriangle,
        text: 'Sync Error — Tap to retry',
        animate: false,
      };
    }

    if (pendingConflicts.length > 0) {
      return {
        bg: 'bg-gradient-to-r from-yellow-500 to-yellow-600',
        icon: AlertTriangle,
        text: `${pendingConflicts.length} conflict(s) need resolution`,
        animate: false,
      };
    }

    return {
      bg: 'bg-gradient-to-r from-green-500 to-green-600',
      icon: CheckCircle,
      text: 'Back Online — All changes synced',
      animate: false,
    };
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const handleClick = () => {
    if (isOnline && syncStatus !== 'syncing' && pendingConflicts.length === 0) {
      setShowBanner(false);
    } else if (isOnline && syncStatus !== 'syncing') {
      sync();
    }
  };

  return (
    <div
      className={`fixed top-0 left-0 right-0 ${config.bg} text-white px-4 py-3 text-sm font-medium flex items-center justify-center gap-3 z-[9999] cursor-pointer transition-all duration-300 shadow-lg`}
      onClick={handleClick}
    >
      <Icon className={`w-5 h-5 ${config.animate ? 'animate-pulse' : ''}`} />
      <span>{config.text}</span>
      {config.animate && (
        <div className="w-2 h-2 bg-white rounded-full animate-ping ml-1"></div>
      )}
    </div>
  );
}

export function NetworkStatusBadge() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="flex items-center gap-2">
      {isOnline ? (
        <>
          <Cloud className="w-4 h-4 text-green-500" />
          <span className="text-sm text-green-600 font-medium">Online</span>
        </>
      ) : (
        <>
          <CloudOff className="w-4 h-4 text-amber-500" />
          <span className="text-sm text-amber-600 font-medium">Offline</span>
        </>
      )}
    </div>
  );
}
