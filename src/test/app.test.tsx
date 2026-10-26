import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '../App';

describe('App & Router Smoke Test', () => {
  it('renders top bar brand and home hero elements', () => {
    render(<App />);

    // 驗證品牌標題
    expect(screen.getByText('MapCraft')).toBeInTheDocument();
    expect(screen.getByText('地圖工坊')).toBeInTheDocument();

    // 驗證首頁核心標題與輸入框
    expect(
      screen.getByText('把任何主題，變成一張走得完的學習地圖')
    ).toBeInTheDocument();
    expect(screen.getByText('開始規劃地圖')).toBeInTheDocument();

    // 驗證導覽按鈕
    expect(screen.getByText('地圖庫')).toBeInTheDocument();
    expect(screen.getByText('設定')).toBeInTheDocument();
  });
});
