export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import PaymentActions from "./PaymentActions";

type PageProps = {
    params: Promise<{
        paymentOrderId: string;
    }>;
};

function formatCurrency(amountPaise: number) {
    return `₹${(Number(amountPaise || 0) / 100).toLocaleString("en-IN")}`;
}

function formatDate(value: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

function getSeatLabels(seats: any[]) {
    if (!seats.length) return "-";

    return seats
        .map((seat: any) => {
            const label = seat.display_label || seat.seat_label;
            return seat.section ? `${seat.section} - ${label}` : label;
        })
        .join(", ");
}

export default async function PaymentStatusPage({ params }: PageProps) {
    await supabaseAdmin.rpc("release_expired_seat_holds");

    const { paymentOrderId } = await params;
    const decodedPaymentOrderId = decodeURIComponent(paymentOrderId).trim();

    const { data: paymentOrder, error } = await supabaseAdmin
        .from("payment_orders")
        .select("*")
        .eq("id", decodedPaymentOrderId)
        .maybeSingle();

    if (error || !paymentOrder) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
                <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow">
                    <h1 className="text-2xl font-bold text-red-600">Payment request not found</h1>
                    <p className="mt-3 text-gray-600">Please re-enter your booking code and try again.</p>
                    <Link href="/" className="mt-6 inline-block rounded-lg bg-black px-4 py-3 font-semibold text-white">
                        Go Back
                    </Link>
                </div>
            </main>
        );
    }

    const isExpired = paymentOrder.hold_expires_at
        ? new Date(paymentOrder.hold_expires_at).getTime() < Date.now()
        : false;

    const isBooked = paymentOrder.status === "booked" && paymentOrder.ticket_id;
    const canPay = paymentOrder.status === "pending_payment" && !isExpired;

    const seatIds = paymentOrder.seat_ids || [];
    const { data: seats } = seatIds.length
        ? await supabaseAdmin
              .from("seats")
              .select("id, seat_label, display_label, section, row_name, seat_number, floor_name")
              .in("id", seatIds)
        : { data: [] as any[] };

    const { data: codeData } = await supabaseAdmin
        .from("booking_codes")
        .select("code, learner_name, parent_name, parent_email, parent_phone")
        .eq("code", paymentOrder.booking_code)
        .maybeSingle();

    const paymentLinkUrl = process.env.RAZORPAY_PAYMENT_LINK_URL || "";
    const upiQrImageUrl = process.env.UPI_QR_IMAGE_URL || "";
    const upiId = process.env.UPI_ID || "";
    const upiPayeeName = process.env.UPI_PAYEE_NAME || "School Payment";

    return (
        <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
            <div className="mx-auto max-w-3xl space-y-6">
                <section className="rounded-2xl bg-white p-6 shadow">
                    <h1 className="text-3xl font-bold text-gray-900">Payment Request</h1>
                    <p className="mt-2 text-gray-600">
                        Your seats are held while this payment request is active. The school team will confirm the ticket after receiving payment.
                    </p>

                    {isBooked && (
                        <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-green-900">
                            <p className="font-semibold">Payment confirmed and ticket generated.</p>
                            <Link
                                href={`/ticket/${encodeURIComponent(paymentOrder.ticket_id)}`}
                                className="mt-3 inline-block rounded-lg bg-green-700 px-4 py-2 font-semibold text-white"
                            >
                                View Ticket
                            </Link>
                        </div>
                    )}

                    {isExpired && !isBooked && (
                        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
                            <p className="font-semibold">This seat hold has expired.</p>
                            <p className="mt-1">Please enter your booking code again and select seats again.</p>
                        </div>
                    )}

                    {canPay && paymentOrder.customer_reported_paid_at && (
                        <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900">
                            <p className="font-semibold">Payment reported.</p>
                            <p className="mt-1">Please wait while the school team verifies the payment and confirms the ticket.</p>
                        </div>
                    )}
                </section>

                <section className="rounded-2xl bg-white p-6 shadow">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <p className="text-sm text-gray-500">Amount to pay</p>
                            <p className="mt-1 text-4xl font-bold text-purple-700">{formatCurrency(paymentOrder.amount_paise)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Seats held until</p>
                            <p className="mt-1 text-lg font-semibold text-gray-900">{formatDate(paymentOrder.hold_expires_at)}</p>
                        </div>
                    </div>

                    <div className="mt-5 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
                        <p><span className="font-semibold">Booking code:</span> {paymentOrder.booking_code}</p>
                        <p><span className="font-semibold">Guest seats:</span> {paymentOrder.paid_guest_seat_count}</p>
                        <p><span className="font-semibold">Learner / Guest:</span> {codeData?.learner_name || "-"}</p>
                        <p><span className="font-semibold">Parent / Contact:</span> {codeData?.parent_name || "-"}</p>
                    </div>

                    <p className="mt-4 text-sm text-gray-700">
                        <span className="font-semibold">Seats:</span> {getSeatLabels(seats || [])}
                    </p>

                    <p className="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                        Payment request ID: <span className="font-mono font-semibold">{paymentOrder.id}</span>
                    </p>
                </section>

                {canPay && (
                    <section className="rounded-2xl border border-purple-200 bg-purple-50 p-6 shadow">
                        <h2 className="text-2xl font-bold text-purple-950">Pay Now</h2>
                        <p className="mt-2 text-sm text-purple-900">
                            Pay exactly the amount shown above. After paying, copy the Razorpay payment ID / transaction reference and enter it below. The school team will use that reference to match your payment before confirming the ticket.
                        </p>

                        <div className="mt-5 grid gap-5 md:grid-cols-[220px_1fr]">
                            <div className="rounded-xl bg-white p-4 text-center shadow-sm">
                                {upiQrImageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={upiQrImageUrl} alt="Payment QR" className="mx-auto h-48 w-48 rounded-lg object-contain" />
                                ) : (
                                    <div className="flex h-48 items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-500">
                                        QR not configured
                                    </div>
                                )}
                            </div>

                            <div className="rounded-xl bg-white p-4 shadow-sm">
                                <div className="space-y-2 text-sm text-gray-700">
                                    {paymentLinkUrl && <p><span className="font-semibold">Payment method:</span> Razorpay payment link</p>}
                                    {upiId && <p><span className="font-semibold">UPI ID:</span> {upiId}</p>}
                                    <p><span className="font-semibold">Payee:</span> {upiPayeeName}</p>
                                </div>

                                <div className="mt-4">
                                    <PaymentActions
                                        paymentOrderId={paymentOrder.id}
                                        paymentLinkUrl={paymentLinkUrl}
                                    />
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                <div className="flex flex-col gap-2 sm:flex-row">
                    <Link href="/" className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-center font-semibold text-gray-800">
                        Back to Code Entry
                    </Link>
                    <Link href={`/book/${encodeURIComponent(paymentOrder.booking_code)}`} className="rounded-lg bg-black px-4 py-3 text-center font-semibold text-white">
                        Back to Seat Map
                    </Link>
                </div>
            </div>
        </main>
    );
}
