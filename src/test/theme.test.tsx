import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider } from '@/app/theme';
import { useTheme } from '@/app/themeContext';

function ThemeTestConsumer() {
  const { theme, actualTheme, toggleTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="actual-theme">{actualTheme}</span>
      <button onClick={toggleTheme}>切換主題</button>
      <button onClick={() => setTheme('dark')}>強制深色</button>
      <button onClick={() => setTheme('light')}>強制淺色</button>
    </div>
  );
}

describe('Theme Context & Dark Mode (SPEC §2.2 FR-13)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('provides default theme and responds to explicit setting', async () => {
    render(
      <ThemeProvider>
        <ThemeTestConsumer />
      </ThemeProvider>
    );

    // 強制切換為深色
    await act(async () => {
      fireEvent.click(screen.getByText('強制深色'));
    });

    expect(screen.getByTestId('theme').textContent).toBe('dark');
    expect(screen.getByTestId('actual-theme').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // 強制切換為淺色
    await act(async () => {
      fireEvent.click(screen.getByText('強制淺色'));
    });

    expect(screen.getByTestId('theme').textContent).toBe('light');
    expect(screen.getByTestId('actual-theme').textContent).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('toggles theme between light and dark', async () => {
    render(
      <ThemeProvider>
        <ThemeTestConsumer />
      </ThemeProvider>
    );

    // 先強制設為 light
    await act(async () => {
      fireEvent.click(screen.getByText('強制淺色'));
    });
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    // 點擊切換
    await act(async () => {
      fireEvent.click(screen.getByText('切換主題'));
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(screen.getByTestId('actual-theme').textContent).toBe('dark');

    // 再次點擊切換
    await act(async () => {
      fireEvent.click(screen.getByText('切換主題'));
    });
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(screen.getByTestId('actual-theme').textContent).toBe('light');
  });
});
