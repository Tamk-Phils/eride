# eRide | PWA & APK Deployment Guide

This guide explains how to deploy the web version of eRide for iOS users and build the Android APK.

## 1. Web App (PWA) for iOS Users
The web app is located in the `/web` directory and is built with React + Vite. It is fully PWA-enabled with service workers and an offline manifest.

### Netlify Deployment Steps
1. **Prepare the code**:
   - Ensure the `/web` directory contains the `netlify.toml` file.
2. **Deploy via Netlify CLI** (or connect GitHub):
   - Run `npm run build` inside `/web`.
   - The build output will be in `/web/dist`.
   - Deploy the `dist` folder.
3. **PWA Features**:
   - When opened in Safari on an iPhone, users can tap **Share** > **Add to Home Screen**.
   - The app will then appear on their home screen as a native-like app without the Safari browser UI.

### Demo Mode
The web app includes a "Try Demo Ride" button that simulates the entire ride lifecycle (finding driver, accepted, arrived, ongoing) using a virtual GPS movement system.

---

## 2. Android APK Build
The mobile app is built with Expo.

### Build Instructions
1. Navigate to the `/mobile` directory.
2. Install EAS CLI: `npm install -g eas-cli`.
3. Login to Expo: `eas login`.
4. Configure the build: `eas build:configure`.
5. Run the build command for APK:
   ```bash
   eas build --platform android --profile preview
   ```
   *Note: The `preview` profile should be configured in `eas.json` to produce an APK instead of an AAB.*

### Sample `eas.json` snippet:
```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

---

## 3. Tech Stack Summary
- **Frontend**: React + Vite + Leaflet (OSM)
- **Mobile**: React Native + Expo
- **Backend**: Node.js + Express + Prisma + Socket.io
- **Hosting**: Netlify (Frontend) / Render (Backend)
