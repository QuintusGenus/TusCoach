import axios from 'axios';
import { useAuthStore } from '../state/authStore';

// Read API base URL from environment variable with fallback
// For physical devices: Set EXPO_PUBLIC_API_BASE_URL to your Mac's LAN IP
// For iOS Simulator: Default to localhost
const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000/v1';

// Log the API base URL once in development mode
if (__DEV__) {
    console.log('[API Client] Using base URL:', BASE_URL);
    if (!process.env.EXPO_PUBLIC_API_BASE_URL) {
        console.log('[API Client] Using default URL. For physical device, set EXPO_PUBLIC_API_BASE_URL');
    }
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
