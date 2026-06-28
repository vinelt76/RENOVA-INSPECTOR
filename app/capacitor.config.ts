import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.renova.inspector',
  appName: 'RENOVA Inspector',
  webDir: 'dist',
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      iosIsEncryption: false,
      androidBiometric: {
        biometricAuth: false,
        biometricTitle: 'Biometric authentication required',
        biometricSubtitle: 'Authenticate to access database',
      },
      electronIsEncryption: false,
      electronWindowsLocation: 'databases',
    },
    Camera: {
      permissions: ['camera', 'photos'],
    },
  },
};

export default config;
