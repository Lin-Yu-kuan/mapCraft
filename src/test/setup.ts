import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';

// Ensure jsdom environment correctly routes fetch to Node globals
if (typeof window !== 'undefined') {
  window.fetch = globalThis.fetch;

  // Mock window.matchMedia for jsdom
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
