import { describe, it, expect, vi } from 'vitest';
import { toggleFullscreen } from '../fullscreen.js';

describe('toggleFullscreen', () => {
  it('passe en plein écran depuis le mode fenêtré', () => {
    const api = { fullscreen: vi.fn(() => false) };
    toggleFullscreen(api);
    expect(api.fullscreen).toHaveBeenLastCalledWith(true);
  });

  it('sort du plein écran quand il est actif', () => {
    const api = { fullscreen: vi.fn(() => true) };
    toggleFullscreen(api);
    expect(api.fullscreen).toHaveBeenLastCalledWith(false);
  });
});
