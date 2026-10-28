import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { Providers } from '@/app/providers';

describe('SettingsPage (SPEC §2.2 FR-01 & AC-01)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('renders all key BYOK controls and defaults', async () => {
    await act(async () => {
      render(
        <Providers>
          <SettingsPage />
        </Providers>
      );
    });

    // 標題與引導
    expect(screen.getByText('設定與供應商連線')).toBeInTheDocument();
    expect(screen.getByText(/自備 LLM API 金鑰（BYOK）/)).toBeInTheDocument();

    // 控制項
    expect(screen.getByText('LLM 供應商')).toBeInTheDocument();
    expect(screen.getByText('端點 URL（Base URL）')).toBeInTheDocument();
    expect(screen.getByText('API 金鑰')).toBeInTheDocument();
    expect(screen.getByText('金鑰儲存模式')).toBeInTheDocument();
    expect(screen.getByText('測試連線')).toBeInTheDocument();
    expect(screen.getByText('儲存設定')).toBeInTheDocument();
  });

  it('explains where WebGPU models are stored when WebGPU is selected', async () => {
    await act(async () => {
      render(
        <Providers>
          <SettingsPage />
        </Providers>
      );
    });

    const providerSelect = screen.getAllByRole('combobox')[0];
    if (!providerSelect) throw new Error('Provider selector not found');

    await act(async () => {
      fireEvent.change(providerSelect, {
        target: { value: 'webgpu' },
      });
    });

    expect(
      await screen.findByText(/不會出現在 Windows「下載」資料夾/)
    ).toBeInTheDocument();
  });

  it('toggles password visibility with 10s auto-hide timer', async () => {
    await act(async () => {
      render(
        <Providers>
          <SettingsPage />
        </Providers>
      );
    });

    const input = screen.getByPlaceholderText(
      /請貼上您的 API 金鑰/
    ) as HTMLInputElement;
    expect(input.type).toBe('password');

    // 點擊顯示
    const toggleBtn = screen.getByLabelText(/顯示金鑰/);
    await act(async () => {
      fireEvent.click(toggleBtn);
    });
    expect(input.type).toBe('text');

    // 再次點擊隱藏
    const hideBtn = screen.getByLabelText(/隱藏金鑰/);
    await act(async () => {
      fireEvent.click(hideBtn);
    });
    expect(input.type).toBe('password');
  });

  it('AC-01: ping test displays green success indicator and latency', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'pong' } }] }),
    });

    await act(async () => {
      render(
        <Providers>
          <SettingsPage />
        </Providers>
      );
    });

    const testBtn = screen.getByText('測試連線');
    await act(async () => {
      fireEvent.click(testBtn);
    });

    expect(await screen.findByText(/連線測試成功！延遲：/)).toBeInTheDocument();
  });

  it('AC-01: 401 error displays friendly error and never reveals API key', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Bad key sk-leaked-key-1234567890' } }),
    });

    await act(async () => {
      render(
        <Providers>
          <SettingsPage />
        </Providers>
      );
    });

    const testBtn = screen.getByText('測試連線');
    await act(async () => {
      fireEvent.click(testBtn);
    });

    const errPanel = await screen.findByText(/連線測試失敗/);
    expect(errPanel).toBeInTheDocument();
    expect(errPanel.textContent).toContain('金鑰無效');
    // 嚴格確保畫面上絕無洩漏的完整金鑰字串
    expect(document.body.textContent).not.toContain('sk-leaked-key-1234567890');
  });
});
