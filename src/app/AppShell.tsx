import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import './AppShell.scss';

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return <div className="app-shell app-shell--active"><Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} /><div className="app-main"><Topbar onMenu={() => setSidebarOpen(true)} /><main className="page-wrap"><Outlet /></main></div></div>;
}
