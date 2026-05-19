"use client";

import { useState } from "react";

export default function PaymentActions({
    paymentOrderId,
    paymentLinkUrl,
    disabled = false,
}: {
    paymentOrderId: string;
    paymentLinkUrl: string;
    disabled?: boolean;
}) {
    const [transactionReference, setTransactionReference] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    async function reportPaid() {
        const cleanedReference = transactionReference.trim();

        setMessage("");
        setError("");

        if (!cleanedReference) {
            setError("Please enter the transaction / UTR / Razorpay payment ID before submitting.");
            return;
        }

        if (cleanedReference.length < 4) {
            setError("Please enter a valid transaction reference.");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch("/api/payment/report-paid", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    paymentOrderId,
                    paymentReference: cleanedReference,
                }),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                setError(result.message || "Could not report payment.");
                return;
            }

            setMessage(result.message || "Payment reported. Please wait for admin confirmation.");
        } catch (err) {
            console.error(err);
            setError("Could not report payment. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-3">
            {paymentLinkUrl && (
                <a
                    href={paymentLinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg bg-purple-700 px-4 py-3 text-center font-semibold text-white"
                >
                    Open Payment Link
                </a>
            )}

            <div>
                <label className="text-xs font-bold uppercase text-gray-500">
                    Transaction / UTR / Razorpay payment ID <span className="text-red-600">*</span>
                </label>
                <input
                    value={transactionReference}
                    onChange={(event) => setTransactionReference(event.target.value)}
                    placeholder="Example: pay_xxxxx, UTR number, transaction ID"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    disabled={disabled || loading}
                    required
                />
                <p className="mt-1 text-xs text-gray-500">
                    This is required so the school team can match your payment in Razorpay before confirming your ticket.
                </p>
            </div>

            <button
                type="button"
                onClick={reportPaid}
                disabled={disabled || loading || !transactionReference.trim()}
                className="w-full rounded-lg bg-black px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
                {loading ? "Submitting..." : "I Have Paid"}
            </button>

            {message && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</div>}
            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        </div>
    );
}
