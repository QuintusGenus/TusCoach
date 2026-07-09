import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../state/authStore';

const API_PORT = 8000;

/**
 * Resolve the backend base URL.
 *
 * Priority:
 *   1. EXPO_PUBLIC_API_BASE_URL — explicit override (inlined at bundle time).
 *   2. Auto-derive from the Metro dev-server host. On a physical device the
 *      backend runs on the same Mac as Metro, so we reuse Metro's LAN IP and
 *      swap the port. This makes physical-device testing work with zero config
 *      even when the Mac's IP changes.
 *   3. Fallback to localhost (simulator / web).
 */
function resolveBaseUrl(): string {
    if (process.env.EXPO_PUBLIC_API_BASE_URL) {
        return process.env.EXPO_PUBLIC_API_BASE_URL;
    }

    // hostUri looks like "192.168.1.190:8081" (dev) — reuse the host, swap port.
    const hostUri =
        Constants.expoConfig?.hostUri ||
        (Constants.expoConfig as any)?.developer?.host ||
        (Constants as any).expoGoConfig?.hostUri;

    if (hostUri) {
        const host = hostUri.split(':')[0];
        if (host && host !== 'localhost' && host !== '127.0.0.1') {
            return `http://${host}:${API_PORT}/v1`;
        }
    }

    return `http://127.0.0.1:${API_PORT}/v1`;
}

const BASE_URL = resolveBaseUrl();

// Log the API base URL once in development mode
if (__DEV__) {
    console.log('[API Client] Using base URL:', BASE_URL);
    console.log('[API Client] Metro hostUri:', Constants.expoConfig?.hostUri);
}

export const client = axios.create({ baseURL: BASE_URL });

// Attach Authorization token from Zustand store to every request
client.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;
    if (__DEV__) {
        console.log(`[API] ${config.method?.toUpperCase()} ${config.url} token=${token ? token.slice(0, 20) + '...' : 'NONE'}`);
    }
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Auto-logout on 401 (expired/invalid token)
client.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            const url = error.config?.url || '';
            // Don't logout on login/register 401s — those are credential errors
            if (!url.includes('/auth/login') && !url.includes('/auth/register')) {
                if (__DEV__) {
                    console.log('[API] 401 received — clearing stale token');
                }
                useAuthStore.getState().logout();
            }
        }
        return Promise.reject(error);
    }
);
