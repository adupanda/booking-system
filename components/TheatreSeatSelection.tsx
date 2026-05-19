"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TheatreSeatMap from "@/components/TheatreSeatMap";

type Seat = {
    id: string;
    seat_label: string;
    display_label: string | null;
    row_name: string | null;
    seat_number: number | null;
    section: string | null;
    status: string;
    layout_x: number | null;
    layout_y: number | null;
    rotation_deg: number | null;
    floor_name: string | null;
    seat_category: string | null;
    allowed_code_types: string[] | null;
    block_name: string | null;
    block_order: number | null;
    row_order: number | null;
    is_bookable: boolean | null;
};

type BookingCode = {
    id: string;
    code: string;
    learner_name: string | null;
    parent_name: string | null;
    max_seats: number;
    used_seats: number;
    code_type: string;
    status: string;
    included_seat_limit?: number | null;
    allow_paid_extra_seats?: boolean | null;
    guest_seat_price_paise?: number | null;
    max_paid_extra_seats?: number | null;
};

type EventData = {
    id: string;
    name: string;
    event_date: string | null;
    venue: string | null;
};

type Props = {
    bookingCode: BookingCode;
    event: EventData;
    seats: Seat[];
    existingTicketId?: string | null;
};

type PaymentOrderResponse = {
    success?: boolean;
    message?: string;
    paymentRequired?: boolean;
    manualPaymentRequired?: boolean;
    paymentOrderId?: string;
    amount?: number;
    amountRupees?: number;
    currency?: string;
    paidGuestSeatCount?: number;
    guestSeatPriceRupees?: number;
    holdExpiresAt?: string;
    upiId?: string;
    upiPayeeName?: string;
    upiQrImageUrl?: string;
    razorpayPaymentLinkUrl?: string;
};

type BookingResponse = {
    success?: boolean;
    message?: string;
    ticketId?: string;
};

type ManualPaymentInfo = {
    paymentOrderId: string;
    amountRupees: number;
    paidGuestSeatCount: number;
    holdExpiresAt: string;
    upiId: string;
    upiPayeeName: string;
    upiQrImageUrl: string;
    razorpayPaymentLinkUrl: string;
};

function getSeatSortValue(seat: Seat) {
    return [
        seat.floor_name === "balcony" ? 0 : 1,
        seat.block_order ?? 999,
        seat.row_order ?? 999,
        seat.seat_number ?? 999,
    ].join("-");
}

function isPaidFamilySeat(seat: Seat) {
    const category = String(seat.seat_category || "").trim().toLowerCase();
    return category === "paid" || category === "family_paid";
}

function formatHoldTime(value: string) {
    if (!value) return "";

    return new Date(value).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

export default function TheatreSeatSelection({
    bookingCode,
    event,
    seats,
    existingTicketId,
}: Props) {
    const router = useRouter();

    const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [manualPaymentInfo, setManualPaymentInfo] = useState<ManualPaymentInfo | null>(null);

    const rawIncludedSeatLimit = Number(bookingCode.included_seat_limit ?? 2);
    const includedSeatLimit = bookingCode.code_type === "paid" ? 0 : rawIncludedSeatLimit;
    const allowPaidExtraSeats = Boolean(bookingCode.allow_paid_extra_seats ?? true);
    const guestSeatPricePaise = Number(bookingCode.guest_seat_price_paise ?? 50000);

    const selectedSeats = useMemo(() => {
        return seats
            .filter((seat) => selectedSeatIds.includes(seat.id))
            .sort((a, b) => getSeatSortValue(a).localeCompare(getSeatSortValue(b)));
    }, [seats, selectedSeatIds]);

    const availableSelectableSeats = useMemo(() => {
        return seats.filter((seat) => seat.status === "available" && isSeatAllowedForCode(seat)).length;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [seats, bookingCode.code_type]);

    const includedSeatsAlreadyUsed = Math.min(Number(bookingCode.used_seats || 0), includedSeatLimit);
    const includedSeatsRemaining = Math.max(includedSeatLimit - includedSeatsAlreadyUsed, 0);

    const maxSelectable = allowPaidExtraSeats ? availableSelectableSeats : includedSeatsRemaining;

    const selectedPaidGuestSeatCount = getPaidGuestSeatCount(selectedSeats);
    const selectedPaymentAmountPaise = selectedPaidGuestSeatCount * guestSeatPricePaise;
    const selectedPaymentAmountRupees = selectedPaymentAmountPaise / 100;

    function isSeatAllowedForCode(seat: Seat) {
        if (!seat.is_bookable) return false;
        if (!seat.allowed_code_types || seat.allowed_code_types.length === 0) return false;
        return seat.allowed_code_types.includes(bookingCode.code_type);
    }

    function getPaidGuestSeatCount(nextSelectedSeats: Seat[]) {
        return nextSelectedSeats.filter(isPaidFamilySeat).length;
    }

    function canSelectionPassPaidSectionRule(nextSelectedSeats: Seat[]) {
        const paidSectionSeats = nextSelectedSeats.filter(isPaidFamilySeat).length;
        const nonPaidSectionSeats = nextSelectedSeats.length - paidSectionSeats;

        return nonPaidSectionSeats <= includedSeatsRemaining;
    }

    function handleSeatClick(seat: Seat) {
        if (manualPaymentInfo) return;
        if (seat.status !== "available") return;
        if (!isSeatAllowedForCode(seat)) return;

        const alreadySelected = selectedSeatIds.includes(seat.id);

        if (alreadySelected) {
            setSelectedSeatIds((current) => current.filter((seatId) => seatId !== seat.id));
            setErrorMessage("");
            return;
        }

        if (selectedSeatIds.length >= maxSelectable) {
            setErrorMessage("No more seats can be selected.");
            return;
        }

        const nextSelectedSeatIds = [...selectedSeatIds, seat.id];
        const nextSelectedSeats = seats.filter((currentSeat) => nextSelectedSeatIds.includes(currentSeat.id));

        if (!canSelectionPassPaidSectionRule(nextSelectedSeats)) {
            setErrorMessage("Extra guest seats must be selected from the paid/family seating section.");
            return;
        }

        setErrorMessage("");
        setSelectedSeatIds(nextSelectedSeatIds);
    }

    async function readJsonResponse<T>(response: Response): Promise<T> {
        const responseText = await response.text();

        try {
            return JSON.parse(responseText) as T;
        } catch {
            console.error("Non-JSON response:", responseText);
            throw new Error("The server returned an invalid response.");
        }
    }

    async function confirmFreeBooking() {
        const response = await fetch("/api/book", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                code: bookingCode.code,
                seatIds: selectedSeatIds,
            }),
        });

        const result = await readJsonResponse<BookingResponse>(response);

        if (!response.ok || !result.success || !result.ticketId) {
            throw new Error(result.message || "Could not complete booking.");
        }

        router.push(`/ticket/${encodeURIComponent(result.ticketId)}`);
    }

    async function handleConfirm() {
        if (selectedSeatIds.length === 0) {
            setErrorMessage("Please select at least one seat.");
            return;
        }

        setLoading(true);
        setErrorMessage("");

        try {
            // Let the backend decide whether this exact selection needs payment.
            // This prevents the frontend from wrongly sending normal/free bookings to payment.
            const paymentResponse = await fetch("/api/payment/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code: bookingCode.code,
                    seatIds: selectedSeatIds,
                }),
            });

            const paymentResult = await readJsonResponse<PaymentOrderResponse>(paymentResponse);

            if (!paymentResponse.ok || !paymentResult.success) {
                setErrorMessage(paymentResult.message || "Could not check payment requirement.");
                setLoading(false);
                return;
            }

            if (!paymentResult.paymentRequired) {
                await confirmFreeBooking();
                return;
            }

            if (!paymentResult.paymentOrderId) {
                setErrorMessage("Payment is required, but no payment request was created. Please try again.");
                setLoading(false);
                return;
            }

            router.push(`/payment/${encodeURIComponent(paymentResult.paymentOrderId)}`);
        } catch (error) {
            console.error(error);
            setErrorMessage("Could not complete booking. Please try again.");
            setLoading(false);
        }
    }

    async function cancelManualHold() {
        if (!manualPaymentInfo?.paymentOrderId) return;

        setLoading(true);
        await fetch("/api/payment/release-hold", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentOrderId: manualPaymentInfo.paymentOrderId }),
        }).catch(() => null);

        setManualPaymentInfo(null);
        setSelectedSeatIds([]);
        setLoading(false);
        router.refresh();
    }

    return (
        <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
            <div className="mx-auto max-w-7xl">
                <div className="rounded-2xl bg-white p-6 shadow">
                    <h1 className="text-3xl font-bold text-gray-900">{event.name}</h1>

                    <div className="mt-2 text-gray-600">
                        {event.venue && <p>Venue: {event.venue}</p>}
                        {event.event_date && <p>Date: {event.event_date}</p>}
                    </div>

                    <div className="mt-6 rounded-xl bg-gray-100 p-4">
                        <p className="font-semibold text-gray-900">Booking Code: {bookingCode.code}</p>

                        {bookingCode.learner_name && (
                            <p className="text-gray-700">Learner / Guest: {bookingCode.learner_name}</p>
                        )}

                        {bookingCode.parent_name && (
                            <p className="text-gray-700">Parent / Contact: {bookingCode.parent_name}</p>
                        )}

                        {existingTicketId && (
                            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
                                <p className="font-semibold">Existing ticket found</p>

                                <p className="mt-1">
                                    This code already has a confirmed ticket. You can view it anytime, or continue
                                    booking additional guest seats below.
                                </p>

                                <button
                                    type="button"
                                    onClick={() => router.push(`/ticket/${encodeURIComponent(existingTicketId)}`)}
                                    className="mt-3 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white"
                                >
                                    View Existing Ticket
                                </button>
                            </div>
                        )}

                        <div className="mt-3 rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm text-purple-950">
                            <p className="font-semibold">Important seating rule</p>
                            <p className="mt-1">
                                This booking code includes {includedSeatLimit} parent seat
                                {includedSeatLimit === 1 ? "" : "s"}. These can be booked without payment.
                            </p>
                            <p className="mt-1">
                                Extra guest seats can be booked now or later by entering the same code again. Extra
                                guest seats are paid and must be selected from the purple paid/family seating sections.
                            </p>
                            <p className="mt-1 font-semibold">
                                If you want parents and guests to sit together, please choose seats from the purple sections.
                            </p>
                        </div>

                        <p className="mt-3 text-sm text-gray-500">Code type: {bookingCode.code_type}</p>
                    </div>
                </div>

                {manualPaymentInfo && (
                    <div className="mt-6 rounded-2xl border border-purple-200 bg-purple-50 p-6 shadow">
                        <h2 className="text-2xl font-bold text-purple-950">Payment Required</h2>
                        <p className="mt-2 text-purple-900">
                            Your selected seats are temporarily held. Please pay and wait for the school team to confirm your payment.
                        </p>

                        <div className="mt-4 grid gap-4 md:grid-cols-[260px_1fr]">
                            <div className="rounded-xl bg-white p-4 text-center shadow-sm">
                                {manualPaymentInfo.razorpayPaymentLinkUrl ? (
                                    <div className="flex h-full min-h-48 flex-col items-center justify-center rounded-lg border border-purple-200 bg-purple-50 p-4">
                                        <p className="text-sm font-semibold text-purple-950">Pay using Razorpay</p>
                                        <p className="mt-2 text-xs text-purple-800">
                                            This opens the school payment link in a new tab.
                                        </p>
                                        <a
                                            href={manualPaymentInfo.razorpayPaymentLinkUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-4 rounded-lg bg-purple-700 px-4 py-3 font-semibold text-white"
                                        >
                                            Open Payment Link
                                        </a>
                                    </div>
                                ) : manualPaymentInfo.upiQrImageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={manualPaymentInfo.upiQrImageUrl}
                                        alt="Payment QR code"
                                        className="mx-auto h-48 w-48 rounded-lg object-contain"
                                    />
                                ) : (
                                    <div className="flex h-48 w-full items-center justify-center rounded-lg border border-dashed border-purple-300 text-sm text-purple-700">
                                        Add RAZORPAY_PAYMENT_LINK_URL or UPI_QR_IMAGE_URL to show payment details here
                                    </div>
                                )}
                            </div>

                            <div className="rounded-xl bg-white p-4 shadow-sm">
                                <p className="text-sm text-gray-500">Amount to pay</p>
                                <p className="mt-1 text-4xl font-bold text-purple-900">₹{manualPaymentInfo.amountRupees}</p>

                                <div className="mt-4 space-y-2 text-sm text-gray-700">
                                    <p>
                                        <span className="font-semibold">Paid guest seats:</span>{" "}
                                        {manualPaymentInfo.paidGuestSeatCount}
                                    </p>
                                    {manualPaymentInfo.razorpayPaymentLinkUrl && (
                                        <p>
                                            <span className="font-semibold">Payment method:</span> Razorpay payment link
                                        </p>
                                    )}
                                    {!manualPaymentInfo.razorpayPaymentLinkUrl && (
                                        <>
                                            <p>
                                                <span className="font-semibold">UPI ID:</span>{" "}
                                                {manualPaymentInfo.upiId || "Use the QR code shown by the school"}
                                            </p>
                                            <p>
                                                <span className="font-semibold">Payee:</span> {manualPaymentInfo.upiPayeeName}
                                            </p>
                                        </>
                                    )}
                                    <p>
                                        <span className="font-semibold">Payment request ID:</span>{" "}
                                        <span className="font-mono">{manualPaymentInfo.paymentOrderId}</span>
                                    </p>
                                    <p>
                                        <span className="font-semibold">Seats held until:</span>{" "}
                                        {formatHoldTime(manualPaymentInfo.holdExpiresAt)}
                                    </p>
                                </div>

                                <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                                    After payment, save the payment request ID. Your ticket will be available only after the admin confirms the payment in the admin panel.
                                </div>

                                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                                    {manualPaymentInfo.razorpayPaymentLinkUrl && (
                                        <a
                                            href={manualPaymentInfo.razorpayPaymentLinkUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="rounded-lg bg-purple-700 px-4 py-2 text-center font-semibold text-white"
                                        >
                                            Open Payment Link
                                        </a>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => router.push("/")}
                                        className="rounded-lg bg-black px-4 py-2 font-semibold text-white"
                                    >
                                        Done, I Have Paid
                                    </button>

                                    <button
                                        type="button"
                                        onClick={cancelManualHold}
                                        disabled={loading}
                                        className="rounded-lg border border-red-300 bg-white px-4 py-2 font-semibold text-red-700 disabled:opacity-50"
                                    >
                                        Cancel & Release Seats
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className={`mt-6 rounded-2xl bg-white p-4 shadow sm:p-6 ${manualPaymentInfo ? "opacity-60" : ""}`}>
                    <h2 className="mb-2 text-2xl font-bold text-gray-900">Select Your Seats</h2>

                    <p className="mb-4 text-sm text-gray-600">
                        Balcony and ground floor are shown separately. On the ground floor, the stage is shown at the bottom.
                        Scroll sideways inside each section if needed.
                    </p>

                    <div className="space-y-10">
                        <section>
                            <div className="mb-4 rounded-xl bg-gray-100 p-4">
                                <h3 className="text-xl font-bold text-gray-900">Ground Floor</h3>
                                <p className="mt-1 text-sm text-gray-600">Select seats from the main floor.</p>
                            </div>

                            <TheatreSeatMap
                                seats={seats.filter((seat) => seat.floor_name === "ground")}
                                mode="booking"
                                selectedSeatIds={selectedSeatIds}
                                maxSelectable={maxSelectable}
                                codeType={bookingCode.code_type}
                                onSeatClick={handleSeatClick}
                            />
                        </section>

                        <section>
                            <div className="mb-4 rounded-xl bg-gray-100 p-4">
                                <h3 className="text-xl font-bold text-gray-900">Balcony / First Floor</h3>
                                <p className="mt-1 text-sm text-gray-600">Select seats from the upper floor or balcony.</p>
                            </div>

                            <TheatreSeatMap
                                seats={seats.filter((seat) => seat.floor_name === "balcony")}
                                mode="booking"
                                selectedSeatIds={selectedSeatIds}
                                maxSelectable={maxSelectable}
                                codeType={bookingCode.code_type}
                                onSeatClick={handleSeatClick}
                            />
                        </section>
                    </div>
                </div>

                <div className="sticky bottom-0 z-30 mt-6 rounded-2xl bg-white p-6 shadow">
                    <p className="font-semibold text-gray-900">
                        Selected Seats:{" "}
                        {selectedSeats.length > 0
                            ? selectedSeats.map((seat) => seat.display_label || seat.seat_label).join(", ")
                            : "None"}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                        {selectedSeats.length} selected · Included parent seats remaining: {includedSeatsRemaining}
                    </p>

                    {selectedPaidGuestSeatCount > 0 && (
                        <p className="mt-1 text-sm font-semibold text-purple-700">
                            Paid guest seats selected: {selectedPaidGuestSeatCount} · Amount: ₹
                            {selectedPaymentAmountRupees}
                        </p>
                    )}

                    {errorMessage && (
                        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorMessage}</div>
                    )}

                    {manualPaymentInfo && (
                        <div className="mt-4 rounded-lg bg-purple-50 p-3 text-sm text-purple-900">
                            Seats are held while payment is pending. Admin confirmation is required before ticket generation.
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={selectedSeats.length === 0 || loading || Boolean(manualPaymentInfo)}
                        className="mt-4 w-full rounded-lg bg-black px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {loading
                            ? "Processing..."
                            : selectedPaidGuestSeatCount > 0
                              ? `Hold Seats & Continue to Payment for ₹${selectedPaymentAmountRupees}`
                              : "Confirm Booking"}
                    </button>
                </div>
            </div>
        </main>
    );
}
