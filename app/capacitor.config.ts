import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

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
    Keyboard: {
      resize: KeyboardResize.Body,
    },
  },
};

export default config;
