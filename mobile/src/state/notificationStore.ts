import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';

interface NotificationState {
    expoPushToken: string | null;
    permissionStatus: 'granted' | 'denied' | 'undetermined';
    lastRegisteredAt: string | null;
    pendingNavigation: string | null;
    setExpoPushToken: (token: string | null) => void;
    setPermissionStatus: (status: 'granted' | 'denied' | 'undetermined') => void;
    setLastRegisteredAt: (timestamp: string) => void;
    setPendingNavigation: (path: string | null) => void;
    clearPendingNavigation: () => void;
    clear: () => void;
}

export const useNotificationStore = create<NotificationState>()(
    persist(
        (set) => ({
            expoPushToken: null,
            permissionStatus: 'undetermined',
            lastRegisteredAt: null,
            pendingNavigation: null,
            setExpoPushToken: (token) => set({ expoPushToken: token }),
            setPermissionStatus: (status) => set({ permissionStatus: status }),
            setLastRegisteredAt: (timestamp) => set({ lastRegisteredAt: timestamp }),
            setPendingNavigation: (path) => set({ pendingNavigation: path }),
            clearPendingNavigation: () => set({ pendingNavigation: null }),
            clear: () => set({
                expoPushToken: null,
                permissionStatus: 'undetermined',
                lastRegisteredAt: null,
                pendingNavigation: null
            }),
        }),
        {
            name: 'notification-storage',
            storage: createJSONStorage(() => ({
                getItem: (name) => SecureStore.getItemAsync(name),
                setItem: (name, value) => SecureStore.setItemAsync(name, value),
                removeItem: (name) => SecureStore.deleteItemAsync(name),
            })),
        }
    )
);
