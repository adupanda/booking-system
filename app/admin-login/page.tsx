"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
    const router = useRouter();

    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        setLoading(true);
        setMessage("");

        try {
            const response = await fetch("/api/admin-login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ password }),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                setMessage(result.message || "Invalid password.");
                return;
            }

            router.push("/admin");
            router.refresh();
        } catch (error) {
            console.error(error);
            setMessage("Could not log in. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
            <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow">
                <h1 className="text-3xl font-bold text-gray-900">Admin Login</h1>

                <p className="mt-2 text-gray-600">
                    Enter the admin password to access booking management.
                </p>

                <form onSubmit={handleLogin} className="mt-8 space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            Admin Password
                        </label>

                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password"
                            className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-lg outline-none focus:border-blue-500"
                        />
                    </div>

                    {message && (
                        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                            {message}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-lg bg-black px-4 py-3 font-semibold text-white disabled:opacity-50"
                    >
                        {loading ? "Logging in..." : "Login"}
                    </button>
                </form>
            </div>
        </main>
    );
}