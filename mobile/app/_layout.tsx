import "../global.css";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../src/state/authStore';
import { useNotificationStore } from '../src/state/notificationStore';
import { fetchMe } from '../src/api/auth';
import { fetchOnboardingStatus } from '../src/api/coach';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import {
  configureNotificationHandler,
  requestNotificationPermissions,
  getExpoPushToken,
  getPlatform,
  getPermissionStatus,
} from '../src/services/notifications';
import { registerDevice } from '../src/api/devices';
import { useNotificationHandler } from '../src/hooks/useNotificationHandler';
import { colors, shadows, typography } from '../src/ui/theme';

const queryClient = new QueryClient();

// Configure notification handler globally
configureNotificationHandler();

function RootLayoutNav() {
  const { token, user, setAuth, logout, onboardingDone, setOnboardingDone } = useAuthStore();
  const {
    setExpoPushToken,
    setPermissionStatus,
    setLastRegisteredAt,
    expoPushToken,
  } = useNotificationStore();
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  // Handle notification taps and deep linking
  useNotificationHandler();

  // On app start, verify token and fetch user data
  useEffect(() => {
    async function initAuth() {
      if (token && !user) {
        try {
          // Token exists but no user data, fetch it
          const userData = await fetchMe();
          setAuth(token, userData);
        } catch (e) {
          // Token invalid or expired, clear it
          console.error('Token validation failed:', e);
          logout();
        }
      }
      setIsReady(true);
    }

    initAuth();
  }, []);

  // Check onboarding status when authenticated
  useEffect(() => {
    async function checkOnboarding() {
      if (!token || !user || onboardingDone) return;

      try {
        const status = await fetchOnboardingStatus();
        if (status.exam_date_set && status.daily_target_set) {
          setOnboardingDone(true);
        }
      } catch (e) {
        // If the check fails, don't block the user — assume not done
        console.error('[App] Onboarding status check failed:', e);
      }
    }

    if (isReady && token && user) {
      checkOnboarding();
    }
  }, [isReady, token, user]);

  // Register for push notifications when authenticated
  useEffect(() => {
    async function registerForNotifications() {
      // Only register if authenticated and no token yet
      if (!token || !user) {
        return;
      }

      try {
        // Check permission status
        const status = await getPermissionStatus();
        setPermissionStatus(status);

        // Request permissions
        const granted = await requestNotificationPermissions();
        if (!granted) {
          console.log('[App] Notification permissions not granted');
          setPermissionStatus('denied');
          return;
        }

        setPermissionStatus('granted');

        // Get push token
        const pushToken = await getExpoPushToken();
        if (!pushToken) {
          console.log('[App] Could not get push token');
          return;
        }

        // Save to store
        setExpoPushToken(pushToken);

        // Register with backend
        await registerDevice({
          platform: getPlatform(),
          expo_push_token: pushToken,
        });

        setLastRegisteredAt(new Date().toISOString());
        console.log('[App] Device registered successfully');
      } catch (error) {
        console.error('[App] Failed to register for notifications:', error);
      }
    }

    // Only register if we don't have a token yet or if it's been a while
    if (token && user && !expoPushToken) {
      registerForNotifications();
    }
  }, [token, user, expoPushToken]);

  // Navigation guard
  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    // Auth Guard
    if (!token && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (token && inAuthGroup) {
      // Logged in but in auth screens — redirect based on onboarding
      if (!onboardingDone) {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)');
      }
    } else if (token && !onboardingDone && !inOnboarding && !inAuthGroup) {
      // Logged in, onboarding not done, not on onboarding screen
      router.replace('/onboarding');
    } else if (token && onboardingDone && inOnboarding) {
      // Onboarding done but still on onboarding screen — go to tabs
      router.replace('/(tabs)');
    }
  }, [token, segments, isReady, onboardingDone]);

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="preferences" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootLayoutNav />
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background
  }
});
