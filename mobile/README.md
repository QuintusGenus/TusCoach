# TusCoach Mobile App

React Native mobile application for TUS Medical Residency Exam coaching, built with Expo.

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI
- iOS Simulator (macOS) or Android Emulator
- Expo Go app (for physical device testing)

### Installation

```bash
cd mobile
npm install
```

## Running the App

### iOS Simulator (Default)

For iOS Simulator, the app will connect to `http://127.0.0.1:8000` by default:

```bash
npx expo start
# Press 'i' to open iOS Simulator
```

### Physical Device (iPhone/Android)

For physical devices, you need to set the backend URL to your Mac's LAN IP address:

**Step 1: Find your Mac's IP address**

```bash
# macOS
ipconfig getifaddr en0

# Or check System Preferences > Network
```

**Step 2: Start Expo with the API URL**

```bash
# Replace <YOUR_MAC_IP> with your actual IP (e.g., 192.168.1.172)
EXPO_PUBLIC_API_BASE_URL="http://<YOUR_MAC_IP>:8000/v1" npx expo start --clear
```

**Example:**
```bash
EXPO_PUBLIC_API_BASE_URL="http://192.168.1.172:8000/v1" npx expo start --clear
```

**Step 3: Open in Expo Go**
- Scan the QR code with your iPhone Camera (iOS) or Expo Go app (Android)
- The app will connect to your backend using the specified IP

### Android Emulator

```bash
npx expo start
# Press 'a' to open Android Emulator
```

## Environment Variables

The app supports the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `EXPO_PUBLIC_API_BASE_URL` | Backend API base URL | `http://127.0.0.1:8000/v1` |

**Note:** Environment variables in Expo must be prefixed with `EXPO_PUBLIC_` to be accessible in the app.

## Project Structure

```
mobile/
├── app/                    # Expo Router screens
│   ├── (auth)/            # Authentication screens (login, register)
│   ├── (tabs)/            # Main app tabs (dashboard, plan, messages, etc.)
│   └── _layout.tsx        # Root layout with auth check
├── src/
│   ├── api/               # API client and endpoints
│   │   ├── client.ts      # Axios client with auth interceptor
│   │   ├── auth.ts        # Authentication endpoints
│   │   └── coach.ts       # Coach/student endpoints
│   ├── components/        # Reusable components
│   └── state/             # Zustand state management
│       └── authStore.ts   # Authentication state
└── package.json
```

## Features

### Authentication
- Login with email/password
- Registration
- JWT token storage (SecureStore)
- Automatic token validation on app start
- Logout functionality

### Dashboard
- Latest coach message display
- Daily plan with tasks
- Quick add study session form
- Pull to refresh

### Plan Screen
- View daily tasks
- Date navigation (Yesterday/Today/Tomorrow)
- Complete tasks
- Task status tracking

### Messages
- Message history from coach
- Workflow-based messaging
- Message metadata (subject, body, tone)
- Pull to refresh

### Progress
- Weekly study statistics
- Total minutes studied
- Current streak (consecutive days)
- Daily breakdown
- Visual stats cards

## API Configuration

The app communicates with the FastAPI backend. Ensure the backend is running before starting the mobile app.

### Backend Requirements
- Backend must be accessible from the mobile device
- For physical devices, backend must run with `--host 0.0.0.0`
- Default backend port: `8000`

### Starting Backend for Mobile Development

```bash
cd backend
./dev.sh  # Starts on 0.0.0.0:8000 (accessible from network)
```

## Troubleshooting

### Cannot connect to API

**Symptom:** "Network Error" or "Request failed"

**Solutions:**
1. Verify backend is running: `curl http://localhost:8000/v1/auth/login`
2. For physical device: Check that `EXPO_PUBLIC_API_BASE_URL` is set correctly
3. Ensure backend is running with `--host 0.0.0.0` (not just localhost)
4. Verify your device and Mac are on the same WiFi network
5. Check firewall settings aren't blocking port 8000

### API URL not updating

**Solution:** Clear the Metro bundler cache:
```bash
EXPO_PUBLIC_API_BASE_URL="http://<YOUR_IP>:8000/v1" npx expo start --clear
```

### Token expired errors

**Solution:** The app automatically validates tokens on startup. If expired, you'll be redirected to login. Simply log in again.

## Development

### View Logs

```bash
# iOS Simulator logs
npx react-native log-ios

# Android Emulator logs
npx react-native log-android

# Expo logs (all platforms)
# Logs appear in the terminal where you ran 'npx expo start'
```

### Clear Cache

```bash
npx expo start --clear
```

## Tech Stack

- **Framework:** Expo SDK 54
- **Navigation:** Expo Router (file-based routing)
- **State Management:** Zustand with persistence
- **API Client:** Axios
- **Data Fetching:** TanStack Query (React Query)
- **Secure Storage:** expo-secure-store
- **UI:** React Native core components
- **Icons:** @expo/vector-icons (FontAwesome)

## Build for Production

### iOS

```bash
eas build --platform ios
```

### Android

```bash
eas build --platform android
```

## Testing

The app is designed to work with the following test credentials:

- Email: `newuser5@example.com`
- Password: `TestPass123`

Or register a new account through the registration screen.
