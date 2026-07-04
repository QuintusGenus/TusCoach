import { client } from './client';
import { useAuthStore } from '../state/authStore';

// ── Types ──

export interface ChatMessage {
    id: number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    created_at: string;
    meta?: Record<string, unknown> | null;
}

export interface ToolEvent {
    name: string;
    result: Record<string, unknown>;
}

export interface ChatSendResponse {
    thread_id: number;
    assistant_message: ChatMessage;
    tool_events?: ToolEvent[] | null;
}

export interface ChatHistoryResponse {
    thread_id: number;
    messages: ChatMessage[];
}

// ── SSE event types ──

export type SSEEvent =
    | { type: 'token'; content: string }
    | { type: 'tool_event'; name: string; result: Record<string, unknown> }
    | { type: 'done'; thread_id: number; message_id: number };

// ── API functions ──

export const fetchChatHistory = async (limit: number = 50): Promise<ChatHistoryResponse> => {
    const res = await client.get('/students/me/chat/history', { params: { limit } });
    return res.data;
};

export const sendChatMessage = async (text: string): Promise<ChatSendResponse> => {
    const res = await client.post('/students/me/chat/send', { text });
    return res.data;
};

/**
 * Stream chat response via SSE.
 * Calls onEvent for each parsed SSE data line.
 * Uses XMLHttpRequest for React Native streaming support
 * (fetch ReadableStream is not available in RN).
 */
export function streamChatMessage(
    text: string,
    onEvent: (event: SSEEvent) => void,
    signal?: AbortSignal,
): Promise<void> {
    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000/v1';
    const token = useAuthStore.getState().token;

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        let lastIndex = 0;

        xhr.open('POST', `${baseUrl}/students/me/chat/send/stream`);
        xhr.setRequestHeader('Content-Type', 'application/json');
        if (token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }

        // Handle abort signal
        if (signal) {
            signal.addEventListener('abort', () => xhr.abort());
        }

        xhr.onprogress = () => {
            const newData = xhr.responseText.substring(lastIndex);
            lastIndex = xhr.responseText.length;

            const lines = newData.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('data: ')) {
                    const data = trimmed.slice(6);
                    if (data === '[DONE]') return;
                    try {
                        const event: SSEEvent = JSON.parse(data);
                        onEvent(event);
                    } catch {
                        // Skip malformed lines
                    }
                }
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                // Process any remaining data
                const remaining = xhr.responseText.substring(lastIndex);
                const lines = remaining.split('\n');
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('data: ')) {
                        const data = trimmed.slice(6);
                        if (data === '[DONE]') continue;
                        try {
                            const event: SSEEvent = JSON.parse(data);
                            onEvent(event);
                        } catch {
                            // Skip malformed lines
                        }
                    }
                }
                resolve();
            } else {
                reject(new Error(`Stream request failed: ${xhr.status}`));
            }
        };

        xhr.onerror = () => reject(new Error('Network error during streaming'));
        xhr.onabort = () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
        };

        xhr.send(JSON.stringify({ text }));
    });
}
