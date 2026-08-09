import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { HelpDialog } from './HelpDialog';
import { Topbar } from './Topbar';
import './AppShell.scss';

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [helpTrigger, setHelpTrigger] = useState<HTMLElement | null>(null);

  return (
    <div className="app-shell app-shell--active">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-main">
        <Topbar
          onMenu={() => setSidebarOpen(true)}
          onHelp={(trigger) => setHelpTrigger(trigger)}
        />
        <main className="page-wrap"><Outlet /></main>
      </div>
      {helpTrigger ? (
        <HelpDialog
          returnFocusTo={helpTrigger}
          onClose={() => setHelpTrigger(null)}
        />
      ) : null}
    </div>
  );
}
