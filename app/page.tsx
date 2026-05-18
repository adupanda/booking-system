"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
    const router = useRouter();

    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [existingTicketId, setExistingTicketId] = useState<string | null>(null);
    const [validatedCode, setValidatedCode] = useState<string | null>(null);

    async function handleContinue(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        setLoading(true);
        setMessage("");
        setExistingTicketId(null);
        setValidatedCode(null);

        try {
            const response = await fetch("/api/validate-code", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ code }),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                if (result.alreadyBooked && result.ticketId) {
                    setExistingTicketId(result.ticketId);
                    setValidatedCode(result.code || code.trim().toUpperCase());
                    return;
                }

                setMessage(result.message || "Invalid booking code.");
                return;
            }

            if (result.existingTicketId) {
                setExistingTicketId(result.existingTicketId);
                setValidatedCode(result.code);
                return;
            }

            router.push(`/book/${encodeURIComponent(result.code)}`);
        } catch (error) {
            console.error(error);
            setMessage("Could not check booking code. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
            <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow">
                <h1 className="text-3xl font-bold text-gray-900">
                    Spotlight 2026 Seat Booking
                </h1>

                <p className="mt-2 text-gray-600">
                    Enter the booking code shared by the school.
                </p>

                <form onSubmit={handleContinue} className="mt-8 space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            Booking Code
                        </label>

                        <input
                            value={code}
                            onChange={(e) => {
                                setCode(e.target.value.toUpperCase());
                                setExistingTicketId(null);
                                setValidatedCode(null);
                                setMessage("");
                            }}
                            placeholder="Example: TEST-REG-001"
                            className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-lg outline-none focus:border-blue-500"
                        />
                    </div>

                    {message && (
                        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                            {message}
                        </div>
                    )}

                    {existingTicketId && validatedCode && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
                            <p className="font-semibold">A ticket already exists for this code.</p>

                            <p className="mt-1">
                                You can view your existing ticket, or continue to book additional guest seats.
                            </p>

                            <div className="mt-4 grid gap-2">
                                <button
                                    type="button"
                                    onClick={() => router.push(`/ticket/${encodeURIComponent(existingTicketId)}`)}
                                    className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white"
                                >
                                    View Existing Ticket
                                </button>

                                <button
                                    type="button"
                                    onClick={() => router.push(`/book/${encodeURIComponent(validatedCode)}`)}
                                    className="rounded-lg bg-black px-4 py-2 font-semibold text-white"
                                >
                                    Book More Guest Seats
                                </button>
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-lg bg-black px-4 py-3 font-semibold text-white disabled:opacity-50"
                    >
                        {loading ? "Checking..." : "Continue"}
                    </button>
                </form>
            </div>
        </main>
    );
}
