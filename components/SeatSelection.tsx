"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Seat = {
    id: string;
    seat_label: string;
    row_name: string | null;
    seat_number: number | null;
    section: string | null;
    status: string;
    allowed_code_types: string[] | null;
    floor_name: string | null;
    seat_category: string | null;
    layout_x: number | null;
    layout_y: number | null;
    rotation_deg: number | null;
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
};

type EventData = {
    id: string;
    name: string;
    event_date: string | null;
    venue: string | null;
};

type SeatSelectionProps = {
    bookingCode: BookingCode;
    event: EventData;
    seats: Seat[];
};

export default function SeatSelection({
                                          bookingCode,
                                          event,
                                          seats,
                                      }: SeatSelectionProps) {
    const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const remainingSeats = bookingCode.max_seats - bookingCode.used_seats;

    const selectedSeats = seats.filter((seat) =>
        selectedSeatIds.includes(seat.id)
    );

    const seatsByRow = useMemo(() => {
        const grouped: Record<string, Seat[]> = {};

        for (const seat of seats) {
            const row = seat.row_name || "Other";

            if (!grouped[row]) {
                grouped[row] = [];
            }

            grouped[row].push(seat);
        }

        for (const row of Object.keys(grouped)) {
            grouped[row].sort((a, b) => {
                return (a.seat_number || 0) - (b.seat_number || 0);
            });
        }

        return grouped;
    }, [seats]);
    function isSeatAllowedForCode(seat: Seat) {
        if (!seat.allowed_code_types || seat.allowed_code_types.length === 0) {
            return true;
        }

        return seat.allowed_code_types.includes(bookingCode.code_type);
    }
    function toggleSeat(seat: Seat) {
        if (seat.status !== "available" || !isSeatAllowedForCode(seat)) {
            return;
        }

        const isSelected = selectedSeatIds.includes(seat.id);

        if (isSelected) {
            setSelectedSeatIds((current) =>
                current.filter((seatId) => seatId !== seat.id)
            );
            return;
        }

        if (selectedSeatIds.length >= remainingSeats) {
            return;
        }

        setSelectedSeatIds((current) => [...current, seat.id]);
    }

    function getSeatClass(seat: Seat) {
        const isSelected = selectedSeatIds.includes(seat.id);

        if (seat.status === "booked") {
            return "cursor-not-allowed bg-gray-300 text-gray-500";
        }

        if (seat.status === "blocked") {
            return "cursor-not-allowed bg-black text-white";
        }

        if (isSelected) {
            return "bg-blue-600 text-white";
        }
        if (!isSeatAllowedForCode(seat)) {
            return "cursor-not-allowed bg-red-100 text-red-400 border-red-200";
        }
        return "bg-white text-gray-900 hover:bg-blue-50";
    }

    async function handleConfirm() {
        if (selectedSeatIds.length === 0) {
            setErrorMessage("Please select at least one seat.");
            return;
        }

        setLoading(true);
        setErrorMessage("");

        try {
            const response = await fetch("/api/book", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    code: bookingCode.code,
                    seatIds: selectedSeatIds,
                }),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                setErrorMessage(result.message || "Could not complete booking.");
                return;
            }

            router.push(`/ticket/${encodeURIComponent(result.ticketId)}`);
        } catch (error) {
            console.error(error);
            setErrorMessage("Could not complete booking. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen bg-gray-50 p-6">
            <div className="mx-auto max-w-5xl">
                <div className="rounded-2xl bg-white p-6 shadow">
                    <h1 className="text-3xl font-bold text-gray-900">{event.name}</h1>

                    <div className="mt-2 text-gray-600">
                        {event.venue && <p>Venue: {event.venue}</p>}
                        {event.event_date && <p>Date: {event.event_date}</p>}
                    </div>

                    <div className="mt-6 rounded-xl bg-gray-100 p-4">
                        <p className="font-semibold text-gray-900">
                            Booking Code: {bookingCode.code}
                        </p>

                        {bookingCode.learner_name && (
                            <p className="text-gray-700">
                                Learner: {bookingCode.learner_name}
                            </p>
                        )}

                        {bookingCode.parent_name && (
                            <p className="text-gray-700">
                                Parent: {bookingCode.parent_name}
                            </p>
                        )}

                        <p className="mt-2 text-gray-700">
                            You can select up to{" "}
                            <span className="font-bold">{remainingSeats}</span> seat
                            {remainingSeats === 1 ? "" : "s"}.
                        </p>

                        <p className="text-sm text-gray-500">
                            Code type: {bookingCode.code_type}
                        </p>
                    </div>
                </div>

                <div className="mt-6 rounded-2xl bg-white p-6 shadow">
                    <div className="mx-auto mb-8 max-w-md rounded-lg bg-gray-900 px-6 py-3 text-center font-bold text-white">
                        STAGE
                    </div>

                    <div className="space-y-5">
                        {Object.entries(seatsByRow).map(([rowName, rowSeats]) => (
                            <div key={rowName} className="flex items-center gap-4">
                                <div className="w-12 font-bold text-gray-700">Row {rowName}</div>

                                <div className="flex flex-wrap gap-2">
                                    {rowSeats.map((seat) => (
                                        <button
                                            key={seat.id}
                                            type="button"
                                            onClick={() => toggleSeat(seat)}
                                            disabled={seat.status !== "available" || !isSeatAllowedForCode(seat)}
                                            className={`h-12 w-16 rounded-lg border border-gray-300 text-sm font-semibold transition ${getSeatClass(
                                                seat
                                            )}`}
                                        >
                                            {seat.seat_label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 flex flex-wrap gap-3 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="h-4 w-4 rounded border bg-white" />
                            Available
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="h-4 w-4 rounded bg-blue-600" />
                            Selected
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="h-4 w-4 rounded bg-gray-300" />
                            Booked
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="h-4 w-4 rounded bg-black" />
                            Blocked
                        </div>
                    </div>
                </div>

                <div className="sticky bottom-0 mt-6 rounded-2xl bg-white p-6 shadow">
                    <p className="font-semibold text-gray-900">
                        Selected Seats:{" "}
                        {selectedSeats.length > 0
                            ? selectedSeats.map((seat) => seat.seat_label).join(", ")
                            : "None"}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                        {selectedSeats.length} / {remainingSeats} selected
                    </p>
                    {errorMessage && (
                        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                            {errorMessage}
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={selectedSeats.length === 0 || loading}
                        className="mt-4 w-full rounded-lg bg-black px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {loading ? "Confirming..." : "Confirm Booking"}
                    </button>
                </div>
            </div>
        </main>
    );
}