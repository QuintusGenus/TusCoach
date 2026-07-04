"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface User {
    id: number;
    email: string;
    is_active: boolean;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string) => void;
    logout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // Check localStorage on mount
        const storedToken = localStorage.getItem("access_token");
        if (storedToken) {
            setToken(storedToken);
            fetchUser(storedToken);
        } else {
            setIsLoading(false);
        }
    }, []);

    const fetchUser = async (authToken: string) => {
        try {
            const res = await fetch("http://localhost:8000/v1/auth/me", {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
            });
            if (res.ok) {
                const userData = await res.json();
                setUser(userData);
            } else {
                logout();
            }
        } catch (error) {
            logout();
        } finally {
            setIsLoading(false);
        }
    };

    const login = (newToken: string) => {
        localStorage.setItem("access_token", newToken);
        setToken(newToken);
        fetchUser(newToken);
        router.push("/");
    };

    const logout = () => {
        localStorage.removeItem("access_token");
        setToken(null);
        setUser(null);
        router.push("/login");
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
