import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';
import ProgressBar from './ProgressBar';

export interface MapInfoState {
  title: string;
  progressPercent: number;
  isVisible: boolean;
}

export function Layout() {
  const [mapInfo, setMapInfo] = useState<MapInfoState | null>(null);

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-50 text-slate-900 antialiased dark:bg-slate-900 dark:text-slate-100 overflow-hidden">
      <TopBar
        mapTitle={mapInfo?.title}
        progressPercent={mapInfo?.progressPercent}
      />
      <ProgressBar
        progress={mapInfo?.progressPercent || 0}
        isVisible={Boolean(mapInfo?.isVisible)}
      />
      <main className="relative flex-1 flex flex-col w-full h-[calc(100vh-3.5rem)] min-h-0 overflow-auto">
        <Outlet context={{ setMapInfo }} />
      </main>
    </div>
  );
}

export default Layout;
