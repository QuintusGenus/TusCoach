import { client } from './client';

interface RegisterDeviceRequest {
    platform: 'ios' | 'android';
    expo_push_token: string;
}

interface DeviceResponse {
    id: number;
    user_id: number;
    platform: string;
    expo_push_token: string;
    created_at: string;
    last_seen_at: string | null;
}

/**
 * Register device for push notifications
 */
export const registerDevice = async (data: RegisterDeviceRequest): Promise<DeviceResponse> => {
    const res = await client.post('/devices/register', data);
    return res.data;
};

/**
 * Ping to update last_seen_at
 */
export const pingDevice = async (expo_push_token: string): Promise<DeviceResponse> => {
    const res = await client.post('/devices/ping', { expo_push_token });
    return res.data;
};
