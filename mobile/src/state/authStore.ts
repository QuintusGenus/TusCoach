import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';

interface User {
    id: number;
    email: string;
    is_active: boolean;
    student_id: number | null;
    display_name: string | null;
}

interface AuthState {
    token: string | null;
    user: User | null;
    lastSeenWorkflowRunId: number;
    onboardingDone: boolean;
    setAuth: (token: string, user: User) => void;
    setLastSeenWorkflowRunId: (id: number) => void;
    setOnboardingDone: (done: boolean) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            user: null,
            lastSeenWorkflowRunId: 0,
            onboardingDone: false,
            setAuth: (token, user) => set({ token, user }),
            setLastSeenWorkflowRunId: (id) => set({ lastSeenWorkflowRunId: id }),
            setOnboardingDone: (done) => set({ onboardingDone: done }),
            logout: () => set({ token: null, user: null, lastSeenWorkflowRunId: 0, onboardingDone: false }),
        }),
        {
            name: 'auth-storage',
            storage: createJSONStorage(() => ({
                getItem: (name) => SecureStore.getItemAsync(name),
                setItem: (name, value) => SecureStore.setItemAsync(name, value),
                removeItem: (name) => SecureStore.deleteItemAsync(name),
            })),
        }
    )
);
