import { useEffect, useState } from "react";

type CoachMessage = {
    workflow_run_id: number;
    workflow_name: string;
    created_at: string;
    subject: string;
    body: string;
    tone?: string | null;
};

import { useAuth } from "@/context/AuthContext";

export function useLatestCoachMessage(studentId: number) {
    const [msg, setMsg] = useState<CoachMessage | null>(null);
    const { token, logout } = useAuth();

    useEffect(() => {
        let alive = true;

        async function fetchMsg() {
            if (!token) return; // Don't fetch if no token

            try {
                // Use the new mobile-friendly /me endpoint
                const res = await fetch(`http://127.0.0.1:8000/v1/students/me/messages/latest`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                if (res.status === 401) {
                    // Token expired or invalid - logout to stop polling
                    logout();
                    return;
                }

                if (res.status === 404) {
                    // No message found, just ignore (keep null)
                    return;
                }

                if (!res.ok) return;
                const data = await res.json();
                if (alive) setMsg(data);
            } catch { }
        }

        fetchMsg();
        const id = setInterval(fetchMsg, 15000); // 15 sn
        return () => {
            alive = false;
            clearInterval(id);
        };
    }, [token, logout]); // Removed studentId dependency as we use /me

    return msg;
}
