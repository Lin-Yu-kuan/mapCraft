import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '../App';

describe('App', () => {
  it('renders MapCraft title and tagline', () => {
    render(<App />);
    expect(screen.getByText(/MapCraft/i)).toBeInTheDocument();
    expect(screen.getByText(/AI drafts the map. You craft the learning./i)).toBeInTheDocument();
  });
});
