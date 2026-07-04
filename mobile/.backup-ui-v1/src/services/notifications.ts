import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Configure how notifications are handled when the app is in the foreground
 */
export function configureNotificationHandler() {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
        }),
    });
}

/**
 * Request notification permissions from the user
 */
export async function requestNotificationPermissions(): Promise<boolean> {
    if (!Device.isDevice) {
        console.log('[Notifications] Not a physical device, skipping permissions');
        return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.log('[Notifications] Permission denied');
        return false;
    }

    console.log('[Notifications] Permission granted');
    return true;
}

/**
 * Get the Expo push token for this device
 */
export async function getExpoPushToken(): Promise<string | null> {
    if (!Device.isDevice) {
        console.log('[Notifications] Not a physical device, cannot get push token');
        return null;
    }

    try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;

        const token = await Notifications.getExpoPushTokenAsync({
            projectId: projectId,
        });

        console.log('[Notifications] Expo push token:', token.data);
        return token.data;
    } catch (error) {
        console.error('[Notifications] Error getting push token:', error);
        return null;
    }
}

/**
 * Get the current platform
 */
export function getPlatform(): 'ios' | 'android' {
    return Platform.OS === 'ios' ? 'ios' : 'android';
}

/**
 * Check current permission status
 */
export async function getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
    if (!Device.isDevice) {
        return 'undetermined';
    }

    const { status } = await Notifications.getPermissionsAsync();
    return status;
}
