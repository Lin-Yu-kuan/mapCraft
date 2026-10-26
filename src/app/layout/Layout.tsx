import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';
import ProgressBar from './ProgressBar';

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 antialiased dark:bg-slate-900 dark:text-slate-100">
      <TopBar />
      <ProgressBar />
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
