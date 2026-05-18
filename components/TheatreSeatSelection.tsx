"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TheatreSeatMap from "@/components/TheatreSeatMap";

declare global {
    interface Window {
        Razorpay?: any;
    }
}

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
    orderId?: string;
    amount?: number;
    currency?: string;
    keyId?: string;
    paidGuestSeatCount?: number;
    guestSeatPriceRupees?: number;
};

type BookingResponse = {
    success?: boolean;
    message?: string;
    ticketId?: string;
};

function loadRazorpayScript() {
    return new Promise<boolean>((resolve) => {
        if (window.Razorpay) {
            resolve(true);
            return;
        }

        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
}

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

    const includedSeatLimit = Number(bookingCode.included_seat_limit ?? 2);
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
        return Math.max(nextSelectedSeats.length - includedSeatsRemaining, 0);
    }

    function canSelectionPassPaidSectionRule(nextSelectedSeats: Seat[]) {
        const paidGuestSeatCount = getPaidGuestSeatCount(nextSelectedSeats);
        const selectedPaidFamilySeats = nextSelectedSeats.filter(isPaidFamilySeat).length;

        return selectedPaidFamilySeats >= paidGuestSeatCount;
    }

    function handleSeatClick(seat: Seat) {
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

        if (!canSelectionPassPaidSectionRule(selectedSeats)) {
            setErrorMessage("Extra guest seats must be selected from the paid/family seating section.");
            return;
        }

        setLoading(true);
        setErrorMessage("");

        try {
            const paymentOrderResponse = await fetch("/api/payment/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code: bookingCode.code,
                    seatIds: selectedSeatIds,
                }),
            });

            const paymentOrderResult = await readJsonResponse<PaymentOrderResponse>(paymentOrderResponse);

            if (!paymentOrderResponse.ok || !paymentOrderResult.success) {
                throw new Error(paymentOrderResult.message || "Could not start payment.");
            }

            if (!paymentOrderResult.paymentRequired) {
                await confirmFreeBooking();
                return;
            }

            const razorpayLoaded = await loadRazorpayScript();

            if (!razorpayLoaded || !window.Razorpay) {
                throw new Error("Could not load payment gateway. Please try again.");
            }

            const options = {
                key: paymentOrderResult.keyId,
                amount: paymentOrderResult.amount,
                currency: paymentOrderResult.currency,
                name: event.name,
                description: `${paymentOrderResult.paidGuestSeatCount} paid guest seat(s)`,
                order_id: paymentOrderResult.orderId,
                handler: async function (response: any) {
                    try {
                        const verifyResponse = await fetch("/api/payment/verify", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                            }),
                        });

                        const verifyResult = await readJsonResponse<BookingResponse>(verifyResponse);

                        if (!verifyResponse.ok || !verifyResult.success || !verifyResult.ticketId) {
                            throw new Error(
                                verifyResult.message || "Payment completed, but booking could not be confirmed."
                            );
                        }

                        router.push(`/ticket/${encodeURIComponent(verifyResult.ticketId)}`);
                    } catch (error: any) {
                        console.error(error);
                        setErrorMessage(error?.message || "Payment completed, but booking could not be confirmed.");
                        setLoading(false);
                    }
                },
                prefill: {
                    name: bookingCode.parent_name || bookingCode.learner_name || "",
                },
                theme: {
                    color: "#111827",
                },
                modal: {
                    ondismiss: function () {
                        setLoading(false);
                    },
                },
            };

            const razorpay = new window.Razorpay(options);

            razorpay.on("payment.failed", function (response: any) {
                console.error("Razorpay payment failed:", response);
                setErrorMessage(
                    response?.error?.description ||
                        response?.error?.reason ||
                        "Payment failed. Please try again."
                );
                setLoading(false);
            });

            razorpay.open();
        } catch (error: any) {
            console.error(error);
            setErrorMessage(error?.message || "Could not complete booking. Please try again.");
            setLoading(false);
        }
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

                <div className="mt-6 rounded-2xl bg-white p-4 shadow sm:p-6">
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

                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={selectedSeats.length === 0 || loading}
                        className="mt-4 w-full rounded-lg bg-black px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {loading
                            ? "Confirming..."
                            : selectedPaidGuestSeatCount > 0
                              ? `Pay ₹${selectedPaymentAmountRupees} & Confirm Booking`
                              : "Confirm Booking"}
                    </button>
                </div>
            </div>
        </main>
    );
}
