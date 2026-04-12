import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useNetworkStore } from '../../store/networkStore';
import {
  LayoutDashboard,
  Route,
  Package,
  RefreshCw,
  Plane,
  FileText,
  Warehouse,
  Menu,
  X,
  WifiOff,
  Wifi,
  Droplets
} from 'lucide-react';
import { useState, useEffect } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['volunteer', 'manager', 'drone_operator', 'commander', 'admin'] },
  { name: 'Routes', href: '/routes', icon: Route, roles: ['volunteer', 'manager', 'drone_operator', 'commander', 'admin'] },
  { name: 'Deliveries', href: '/deliveries', icon: Package, roles: ['volunteer', 'manager', 'commander', 'admin'] },
  { name: 'Sync', href: '/sync', icon: RefreshCw, roles: ['admin'] },
  { name: 'Fleet', href: '/fleet', icon: Plane, roles: ['drone_operator', 'commander', 'admin'] },
  { name: 'Audit Log', href: '/audit', icon: FileText, roles: ['commander', 'admin'] },
  { name: 'Inventory', href: '/inventory', icon: Warehouse, roles: ['manager', 'commander', 'admin'] },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const { isOnline, initNetworkListeners } = useNetworkStore();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    initNetworkListeners();
  }, [initNetworkListeners]);

  const filteredNav = navigation.filter(item => 
    user?.role && item.roles.includes(user.role)
  );

  const roleColors = {
    admin: 'bg-purple-500',
    commander: 'bg-blue-500',
    manager: 'bg-green-500',
    drone_operator: 'bg-cyan-500',
    volunteer: 'bg-amber-500',
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 z-50 shadow-lg">
          <WifiOff className="w-4 h-4" />
          <span>Offline Mode — Changes will sync when connected</span>
          <div className="w-2 h-2 bg-white rounded-full animate-pulse ml-2"></div>
        </div>
      )}

      <nav className="bg-gradient-to-r from-[#1B4F72] to-[#1e3a5f] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link to="/dashboard" className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Droplets className="w-6 h-6" />
                </div>
                <div>
                  <span className="font-bold text-xl tracking-tight">Digital Delta</span>
                  <span className="hidden sm:inline text-xs text-white/60 ml-2">v1.0</span>
                </div>
              </Link>
              <div className="hidden lg:flex gap-1">
                {filteredNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <span className="text-white/60">Logged in as</span>
                <span className="font-medium">{user?.username || 'User'}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${roleColors[user?.role] || 'bg-slate-500'}`}>
                  {user?.role || 'guest'}
                </span>
              </div>
              <div className="flex items-center">
                {isOnline ? (
                  <div className="flex items-center gap-1.5 text-green-300">
                    <Wifi className="w-4 h-4" />
                    <span className="hidden sm:inline text-xs">Online</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-amber-300">
                    <WifiOff className="w-4 h-4" />
                    <span className="hidden sm:inline text-xs">Offline</span>
                  </div>
                )}
              </div>
              <button
                onClick={logout}
                className="text-sm text-white/70 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10"
              >
                Logout
              </button>
              <button
                className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {sidebarOpen && (
        <div className="lg:hidden bg-[#1B4F72] border-t border-white/10">
          <div className="px-4 py-3 space-y-1">
            {filteredNav.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <main className={`${!isOnline ? 'pt-10' : ''} min-h-[calc(100vh-64px)]`}>
        <Outlet />
      </main>
    </div>
  );
}
