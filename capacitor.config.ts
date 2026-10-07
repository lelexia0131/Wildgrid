import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wildgrid.game',
  appName: '野格',
  webDir: 'dist',
  backgroundColor: '#f4f3e9',
  plugins: {
    SystemBars: { insetsHandling: 'css', style: 'DARK' },
  },
};

export default config;
