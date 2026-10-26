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
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 antialiased dark:bg-slate-900 dark:text-slate-100">
      <TopBar
        mapTitle={mapInfo?.title}
        progressPercent={mapInfo?.progressPercent}
      />
      <ProgressBar
        progress={mapInfo?.progressPercent || 0}
        isVisible={Boolean(mapInfo?.isVisible)}
      />
      <main className="flex-1 flex flex-col">
        <Outlet context={{ setMapInfo }} />
      </main>
    </div>
  );
}

export default Layout;
