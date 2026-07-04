"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

export default function Navbar() {
    const { user, logout } = useAuth();

    return (
        <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 z-50">
            <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        TUS Coach
                    </span>
                </Link>
                <div className="flex items-center gap-4">
                    {user ? (
                        <>
                            <span className="text-gray-600 font-medium hidden sm:block">
                                {user.email}
                            </span>
                            <button
                                onClick={logout}
                                className="text-gray-600 hover:text-red-600 transition-colors"
                            >
                                Çıkış
                            </button>
                        </>
                    ) : (
                        <>
                            <Link
                                href="/register"
                                className="text-gray-600 hover:text-gray-900 transition-colors mr-4"
                            >
                                Kayıt Ol
                            </Link>
                            <Link
                                href="/login"
                                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
                            >
                                Giriş Yap
                            </Link>
                        </>
                    )}
                </div>
            </nav>
        </header>
    );
}
