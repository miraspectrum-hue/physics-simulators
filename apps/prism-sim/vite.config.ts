import { defineConfig } from 'vitest/config';

// GitHub Pages はリポジトリ名のサブパス配下（/physics-simulators/）で配信されるため、
// ビルド時のみ base を合わせる（開発サーバはルート直下のままでよい）。
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/physics-simulators/' : '/',
  server: {
    port: 5173,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}));
