import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../state/authStore';
import { useNotificationStore } from '../state/notificationStore';

interface NotificationData {
    kind?: string;
    route?: string;          // Generic deep-link route (e.g. "/(tabs)/practice")
    message_id?: number;
    workflow_run_id?: number;
    student_id?: number;
}

/**
 * Hook to handle notification taps and navigate to the appropriate screen
 *
 * Works in all app states:
 * - Foreground: User taps notification while app is open
 * - Background: User taps notification while app is in background
 * - Killed: User taps notification to launch the app (cold start)
 * - Logged out: Stores pending navigation and redirects to login
 */
export function useNotificationHandler() {
    const router = useRouter();
    const navigationInitialized = useRef(false);
    const { token } = useAuthStore();
    const { pendingNavigation, setPendingNavigation, clearPendingNavigation } = useNotificationStore();
    const queryClient = useQueryClient();

    useEffect(() => {
        // Handle notification tap when app is in foreground or background
        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
            const data = response.notification.request.content.data as NotificationData;

            console.log('[NotificationHandler] Notification tapped:', data);

            handleNotificationTap(data);
        });

        // Handle cold start - check if app was launched by tapping a notification
        const checkColdStart = async () => {
            const response = await Notifications.getLastNotificationResponseAsync();

            if (response && !navigationInitialized.current) {
                const data = response.notification.request.content.data as NotificationData;

                console.log('[NotificationHandler] App launched from notification:', data);

                // Add a small delay to ensure navigation is ready
                setTimeout(() => {
                    handleNotificationTap(data);
                    navigationInitialized.current = true;
                }, 1000);
            }
        };

        checkColdStart();

        // Cleanup subscription on unmount
        return () => {
            subscription.remove();
        };
    }, []);

    // Handle pending navigation after login
    useEffect(() => {
        if (token && pendingNavigation) {
            console.log('[NotificationHandler] User logged in, navigating to pending destination:', pendingNavigation);

            // Small delay to ensure navigation is ready after login
            setTimeout(() => {
                try {
                    router.push(pendingNavigation as any);
                    clearPendingNavigation();
                } catch (error) {
                    console.error('[NotificationHandler] Failed to navigate to pending destination:', error);
                    clearPendingNavigation();
                }
            }, 500);
        }
    }, [token, pendingNavigation]);

    /**
     * Handle notification tap and navigate to appropriate screen
     */
    const handleNotificationTap = (data: NotificationData) => {
        if (!data) {
            console.log('[NotificationHandler] No data in notification, ignoring');
            return;
        }

        // Determine target destination
        let destination = '/(tabs)/inbox'; // default fallback

        // Generic route override from notification data (e.g. morning_reminder → /practice)
        if (data.route) {
            destination = data.route;
        } else if (data.kind === 'coach_message' || data.kind === 'weekly_plan') {
            // Update cache so UI reflects new message immediately
            queryClient.invalidateQueries({ queryKey: ['messages'] });
            queryClient.invalidateQueries({ queryKey: ['message'] });
            queryClient.invalidateQueries({ queryKey: ['unreadCount'] });

            if (data.kind === 'weekly_plan') {
                destination = '/(tabs)/plan';
            } else if (data.message_id) {
                destination = `/message/${data.message_id}`;
            } else if (data.workflow_run_id) {
                destination = `/message/workflow_run/${data.workflow_run_id}`;
            } else {
                destination = '/(tabs)/inbox';
            }
        } else if (data.kind === 'morning_reminder') {
            destination = '/(tabs)/practice';
        }

        // Check if user is logged in
        if (!token) {
            console.log('[NotificationHandler] User not logged in, storing pending navigation and redirecting to login');
            // Store pending navigation for after login (MVP: always inbox)
            setPendingNavigation('/(tabs)/inbox');
            // Navigate to login
            try {
                router.push('/(auth)/login');
            } catch (error) {
                console.error('[NotificationHandler] Failed to navigate to login:', error);
            }
            return;
        }

        // User is logged in, navigate to destination
        try {
            router.push(destination as any);
            console.log('[NotificationHandler] Navigated to:', destination);
        } catch (error) {
            console.error('[NotificationHandler] Failed to navigate:', error);
            // Fallback to inbox
            navigateToInbox();
        }
    };

    /**
     * Fallback navigation to inbox
     */
    const navigateToInbox = () => {
        try {
            router.push('/(tabs)/inbox');
            console.log('[NotificationHandler] Navigated to inbox');
        } catch (error) {
            console.error('[NotificationHandler] Failed to navigate to inbox:', error);
        }
    };
}
