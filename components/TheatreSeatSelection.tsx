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
};

function getSeatSortValue(seat: Seat) {
    return [
        seat.floor_name === "balcony" ? 0 : 1,
        seat.block_order ?? 999,
        seat.row_order ?? 999,
        seat.seat_number ?? 999,
    ].join("-");
}

export default function TheatreSeatSelection({ bookingCode, event, seats }: Props) {
    const router = useRouter();

    const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const remainingSeats = Math.max(bookingCode.max_seats - bookingCode.used_seats, 0);

    const selectedSeats = useMemo(() => {
        return seats
            .filter((seat) => selectedSeatIds.includes(seat.id))
            .sort((a, b) => getSeatSortValue(a).localeCompare(getSeatSortValue(b)));
    }, [seats, selectedSeatIds]);

    function isSeatAllowedForCode(seat: Seat) {
        if (!seat.is_bookable) return false;
        if (!seat.allowed_code_types || seat.allowed_code_types.length === 0) return false;
        return seat.allowed_code_types.includes(bookingCode.code_type);
    }

    function handleSeatClick(seat: Seat) {
        if (remainingSeats <= 0) {
            setErrorMessage("This booking code has no seats remaining.");
            return;
        }

        if (seat.status !== "available") return;
        if (!isSeatAllowedForCode(seat)) return;

        const alreadySelected = selectedSeatIds.includes(seat.id);

        if (alreadySelected) {
            setSelectedSeatIds((current) => current.filter((seatId) => seatId !== seat.id));
            setErrorMessage("");
            return;
        }

        if (selectedSeatIds.length >= remainingSeats) {
            setErrorMessage(`You can only select ${remainingSeats} seat(s).`);
            return;
        }

        setErrorMessage("");
        setSelectedSeatIds((current) => [...current, seat.id]);
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
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code: bookingCode.code,
                    seatIds: selectedSeatIds,
                }),
            });

            const responseText = await response.text();
            let result: { success?: boolean; message?: string; ticketId?: string };

            try {
                result = JSON.parse(responseText);
            } catch {
                console.error("Non-JSON response from /api/book:", responseText);
                setErrorMessage("The booking API returned an invalid response.");
                return;
            }

            if (!response.ok || !result.success || !result.ticketId) {
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

                        <p className="mt-2 text-gray-700">
                            You can select up to <span className="font-bold">{remainingSeats}</span> seat
                            {remainingSeats === 1 ? "" : "s"}.
                        </p>

                        <p className="text-sm text-gray-500">Code type: {bookingCode.code_type}</p>
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
                                <p className="mt-1 text-sm text-gray-600">
                                    Select seats from the main floor.
                                </p>
                            </div>

                            <TheatreSeatMap
                                seats={seats.filter((seat) => seat.floor_name === "ground")}
                                mode="booking"
                                selectedSeatIds={selectedSeatIds}
                                maxSelectable={remainingSeats}
                                codeType={bookingCode.code_type}
                                onSeatClick={handleSeatClick}
                            />
                        </section>

                        <section>
                            <div className="mb-4 rounded-xl bg-gray-100 p-4">
                                <h3 className="text-xl font-bold text-gray-900">Balcony / First Floor</h3>
                                <p className="mt-1 text-sm text-gray-600">
                                    Select seats from the upper floor or balcony.
                                </p>
                            </div>

                            <TheatreSeatMap
                                seats={seats.filter((seat) => seat.floor_name === "balcony")}
                                mode="booking"
                                selectedSeatIds={selectedSeatIds}
                                maxSelectable={remainingSeats}
                                codeType={bookingCode.code_type}
                                onSeatClick={handleSeatClick}
                            />
                        </section>
                    </div>
                </div>

                <div className="sticky bottom-0 z-30 mt-6 rounded-2xl bg-white p-6 shadow">
                    <p className="font-semibold text-gray-900">
                        Selected Seats: {selectedSeats.length > 0 ? selectedSeats.map((seat) => seat.display_label || seat.seat_label).join(", ") : "None"}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                        {selectedSeats.length} / {remainingSeats} selected
                    </p>

                    {errorMessage && (
                        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorMessage}</div>
                    )}

                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={selectedSeats.length === 0 || loading || remainingSeats <= 0}
                        className="mt-4 w-full rounded-lg bg-black px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {loading ? "Confirming..." : "Confirm Booking"}
                    </button>
                </div>
            </div>
        </main>
    );
}
