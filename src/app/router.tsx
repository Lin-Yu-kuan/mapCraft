import { createHashRouter, RouterProvider } from 'react-router-dom';
import Layout from './layout/Layout';
import HomePage from '@/features/generation/HomePage';
import LibraryPage from '@/features/library/LibraryPage';
import SettingsPage from '@/features/settings/SettingsPage';
import MapPage from '@/features/map/MapPage';

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
