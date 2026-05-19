export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

function getSeatLabels(order: any) {
    const seats = order.seats || [];
    if (!seats.length) return "-";

    return seats
        .map((seat: any) => {
            const label = seat.display_label || seat.seat_label;
            return seat.section ? `${seat.section} - ${label}` : label;
        })
        .join(", ");
}

export default async function AdminPaymentsPage({
    searchParams,
}: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
    const cookieStore = await cookies();
    const isAdminLoggedIn = cookieStore.get("admin_auth")?.value === "true";

    if (!isAdminLoggedIn) {
        redirect("/admin-login");
    }

    await supabaseAdmin.rpc("release_expired_seat_holds");

    const params = searchParams ? await searchParams : {};
    const confirmedTicket = typeof params.confirmed === "string" ? params.confirmed : null;
    const rejected = params.rejected === "true";

    const { data: paymentOrders, error } = await supabaseAdmin
        .from("payment_orders")
        .select("*")
        .in("status", ["pending_payment", "payment_confirmed_booking_failed"])
        .order("created_at", { ascending: true });

    if (error) {
        return (
            <main className="min-h-screen bg-gray-50 p-8">
                <h1 className="text-3xl font-bold text-red-600">Could not load payment requests</h1>
                <pre className="mt-4 rounded bg-white p-4 text-sm text-red-600">{error.message}</pre>
            </main>
        );
    }

    const seatIds = Array.from(
        new Set((paymentOrders || []).flatMap((order: any) => order.seat_ids || []))
    );

    const { data: seats } = seatIds.length
        ? await supabaseAdmin
              .from("seats")
              .select("id, seat_label, display_label, section, row_name, seat_number, floor_name")
              .in("id", seatIds)
        : { data: [] as any[] };

    const seatsById = new Map<string, any>();
    for (const seat of seats || []) {
        seatsById.set(seat.id, seat);
    }

    const bookingCodes = Array.from(new Set((paymentOrders || []).map((order: any) => order.booking_code)));

    const { data: codes } = bookingCodes.length
        ? await supabaseAdmin
              .from("booking_codes")
              .select("code, learner_name, parent_name, parent_email, parent_phone")
              .in("code", bookingCodes)
        : { data: [] as any[] };

    const codeByCode = new Map<string, any>();
    for (const code of codes || []) {
        codeByCode.set(code.code, code);
    }

    const enrichedOrders = (paymentOrders || []).map((order: any) => ({
        ...order,
        bookingCodeData: codeByCode.get(order.booking_code),
        seats: (order.seat_ids || []).map((seatId: string) => seatsById.get(seatId)).filter(Boolean),
    }));

    return (
        <main className="min-h-screen bg-gray-50 p-6">
            <div className="mx-auto max-w-7xl">
                <div className="flex flex-col justify-between gap-4 rounded-2xl bg-white p-6 shadow sm:flex-row sm:items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Pending Manual Payments</h1>
                        <p className="mt-1 text-gray-600">
                            Confirm payments after the money is received. Confirming generates or updates the ticket.
                        </p>
                    </div>

                    <Link href="/admin" className="rounded-lg bg-black px-4 py-3 text-center font-semibold text-white">
                        Admin Home
                    </Link>
                </div>

                {confirmedTicket && (
                    <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">
                        Payment confirmed. Ticket generated/updated: <span className="font-mono font-bold">{confirmedTicket}</span>
                    </div>
                )}

                {rejected && (
                    <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4 text-orange-800">
                        Payment request rejected and seats released.
                    </div>
                )}

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl bg-white p-5 shadow">
                        <p className="text-sm text-gray-500">Pending Requests</p>
                        <p className="mt-1 text-3xl font-bold text-gray-900">{enrichedOrders.length}</p>
                    </div>

                    <div className="rounded-xl bg-white p-5 shadow">
                        <p className="text-sm text-gray-500">Pending Amount</p>
                        <p className="mt-1 text-3xl font-bold text-purple-700">
                            {formatCurrency(enrichedOrders.reduce((sum: number, order: any) => sum + Number(order.amount_paise || 0), 0))}
                        </p>
                    </div>

                    <div className="rounded-xl bg-white p-5 shadow">
                        <p className="text-sm text-gray-500">Action Needed</p>
                        <p className="mt-1 text-3xl font-bold text-orange-600">
                            {enrichedOrders.filter((order: any) => order.status === "pending_payment").length}
                        </p>
                    </div>
                </div>

                <div className="mt-6 space-y-4">
                    {enrichedOrders.length > 0 ? (
                        enrichedOrders.map((order: any) => {
                            const codeData = order.bookingCodeData || {};
                            const isExpired = order.hold_expires_at
                                ? new Date(order.hold_expires_at).getTime() < Date.now()
                                : false;

                            return (
                                <section key={order.id} className="rounded-2xl bg-white p-5 shadow">
                                    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h2 className="text-xl font-bold text-gray-900">{order.booking_code}</h2>
                                                <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800">
                                                    {formatCurrency(order.amount_paise)}
                                                </span>
                                                <span
                                                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                                                        isExpired
                                                            ? "bg-red-100 text-red-700"
                                                            : order.customer_reported_paid_at
                                                              ? "bg-blue-100 text-blue-700"
                                                              : "bg-orange-100 text-orange-700"
                                                    }`}
                                                >
                                                    {isExpired
                                                        ? "Expired"
                                                        : order.customer_reported_paid_at
                                                          ? "Parent Marked Paid"
                                                          : "Pending Payment"}
                                                </span>
                                            </div>

                                            <div className="mt-3 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
                                                <p>
                                                    <span className="font-semibold">Learner / Guest:</span>{" "}
                                                    {codeData.learner_name || "-"}
                                                </p>
                                                <p>
                                                    <span className="font-semibold">Parent / Contact:</span>{" "}
                                                    {codeData.parent_name || "-"}
                                                </p>
                                                <p>
                                                    <span className="font-semibold">Email:</span> {codeData.parent_email || "-"}
                                                </p>
                                                <p>
                                                    <span className="font-semibold">Phone:</span> {codeData.parent_phone || "-"}
                                                </p>
                                                <p>
                                                    <span className="font-semibold">Guest seats:</span>{" "}
                                                    {order.paid_guest_seat_count}
                                                </p>
                                                <p>
                                                    <span className="font-semibold">Hold expires:</span>{" "}
                                                    {formatDate(order.hold_expires_at)}
                                                </p>
                                            </div>

                                            <p className="mt-3 text-sm text-gray-700">
                                                <span className="font-semibold">Seats:</span> {getSeatLabels(order)}
                                            </p>

                                            <p className="mt-2 text-xs text-gray-500">
                                                Payment request ID: <span className="font-mono">{order.id}</span>
                                            </p>

                                            {order.customer_reported_paid_at && (
                                                <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                                                    <p className="font-semibold">
                                                        Parent clicked “I Have Paid” at {formatDate(order.customer_reported_paid_at)}
                                                    </p>
                                                    {order.customer_payment_note && (
                                                        <p className="mt-1">
                                                            <span className="font-semibold">Transaction reference:</span> <span className="font-mono">{order.customer_payment_note}</span>
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                                            <form action="/api/admin/manual-payment/confirm" method="POST" className="space-y-3">
                                                <input type="hidden" name="paymentOrderId" value={order.id} />

                                                <div>
                                                    <label className="text-xs font-bold uppercase text-gray-500">
                                                        Verified transaction / UTR reference
                                                    </label>
                                                    <input
                                                        name="paymentReference"
                                                        defaultValue={order.customer_payment_note || ""}
                                                        placeholder="Paste/confirm transaction reference"
                                                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="text-xs font-bold uppercase text-gray-500">Admin note</label>
                                                    <input
                                                        name="paymentNote"
                                                        placeholder="Optional"
                                                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                                    />
                                                </div>

                                                <button
                                                    type="submit"
                                                    disabled={isExpired}
                                                    className="w-full rounded-lg bg-green-700 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    Confirm Payment & Generate Ticket
                                                </button>
                                            </form>

                                            <form action="/api/admin/manual-payment/reject" method="POST" className="mt-3 space-y-3">
                                                <input type="hidden" name="paymentOrderId" value={order.id} />
                                                <input
                                                    name="paymentNote"
                                                    placeholder="Reason / note, optional"
                                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                                />
                                                <button
                                                    type="submit"
                                                    className="w-full rounded-lg bg-red-700 px-4 py-2 font-semibold text-white"
                                                >
                                                    Reject / Release Seats
                                                </button>
                                            </form>
                                        </div>
                                    </div>
                                </section>
                            );
                        })
                    ) : (
                        <div className="rounded-2xl bg-white p-10 text-center text-gray-500 shadow">
                            No pending manual payments.
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
