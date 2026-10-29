import { createHashRouter, RouterProvider } from 'react-router-dom';
import Layout from './layout/Layout';
import HomePage from '@/features/generation/HomePage';
import LibraryPage from '@/features/library/LibraryPage';
import SettingsPage from '@/features/settings/SettingsPage';
import MapPage from '@/features/map/MapPage';
import SharedMapPage from '@/features/map/SharedMapPage';
import { captureOAuthRedirectTokenIfPresent } from '@/lib/cloud/googleDrive';

// 若為 Google OAuth 2.0 彈窗回呼，立即擷取 access_token 並關閉彈窗
captureOAuthRedirectTokenIfPresent();

const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'library',
        element: <LibraryPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: 'map/:id',
        element: <MapPage />,
      },
      {
        path: 'share',
        element: <SharedMapPage />,
      },
      {
        path: '*',
        element: <HomePage />,
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}

export default AppRouter;
