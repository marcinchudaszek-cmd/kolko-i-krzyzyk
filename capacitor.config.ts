import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.beagleappsstudio.kolkoikrzyzyk',
  appName: 'Kółko i Krzyżyk',
  webDir: 'dist',
  android: {
    // Malowane pod WebView zanim pojawi sie pierwsza klatka. Musi zgadzac sie
    // z tlem body w src/index.css, inaczej start aplikacji mignie innym kolorem.
    backgroundColor: '#0b1120',
  },
};

export default config;
