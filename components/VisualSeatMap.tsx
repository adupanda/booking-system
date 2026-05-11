"use client";

type Seat = {
    id: string;
    seat_label: string;
    row_name: string | null;
    seat_number: number | null;
    section: string | null;
    status: string;
    layout_x: number | null;
    layout_y: number | null;
    rotation_deg: number | null;
};

type SeatBookingInfo = {
    seat_id: string;
    ticket_id: string | null;
    learner_name: string | null;
    parent_name: string | null;
    booking_code: string | null;
};

type VisualSeatMapProps = {
    seats: Seat[];
    bookingInfo?: SeatBookingInfo[];
};

export default function VisualSeatMap({
                                          seats,
                                          bookingInfo = [],
                                      }: VisualSeatMapProps) {
    const bookingBySeatId = new Map<string, SeatBookingInfo>();

    for (const info of bookingInfo) {
        bookingBySeatId.set(info.seat_id, info);
    }

    function getSeatColor(status: string) {
        if (status === "available") {
            return "bg-green-100 text-green-800 border-green-400";
        }

        if (status === "booked") {
            return "bg-orange-100 text-orange-800 border-orange-400";
        }

        if (status === "blocked") {
            return "bg-black text-white border-black";
        }

        if (status === "held") {
            return "bg-blue-100 text-blue-800 border-blue-400";
        }

        return "bg-gray-100 text-gray-700 border-gray-300";
    }

    const positionedSeats = seats.filter(
        (seat) => seat.layout_x !== null && seat.layout_y !== null
    );

    const unpositionedSeats = seats.filter(
        (seat) => seat.layout_x === null || seat.layout_y === null
    );

    return (
        <div className="space-y-6">
            <div className="overflow-auto rounded-2xl border border-gray-200 bg-white p-6 shadow">
                <div className="relative h-[650px] min-w-[900px] rounded-xl bg-gray-50">
                    <div className="absolute left-1/2 top-6 w-[420px] -translate-x-1/2 rounded-b-full bg-gray-900 px-6 py-4 text-center font-bold text-white shadow">
                        STAGE
                    </div>

                    {positionedSeats.map((seat) => {
                        const booking = bookingBySeatId.get(seat.id);

                        return (
                            <div
                                key={seat.id}
                                title={
                                    booking
                                        ? `${seat.seat_label}\nBooked by: ${
                                            booking.learner_name || "Guest"
                                        }\nTicket: ${booking.ticket_id || "-"}\nCode: ${
                                            booking.booking_code || "-"
                                        }`
                                        : `${seat.seat_label}\n${seat.status}`
                                }
                                className={`absolute flex h-10 w-12 items-center justify-center rounded-lg border text-xs font-bold shadow-sm ${getSeatColor(
                                    seat.status
                                )}`}
                                style={{
                                    left: `${seat.layout_x}px`,
                                    top: `${seat.layout_y}px`,
                                    transform: `rotate(${seat.rotation_deg || 0}deg)`,
                                }}
                            >
                                {seat.seat_label}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
                <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded border border-green-400 bg-green-100" />
                    Available
                </div>

                <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded border border-orange-400 bg-orange-100" />
                    Booked
                </div>

                <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded bg-black" />
                    Blocked
                </div>

                <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded border border-blue-400 bg-blue-100" />
                    Held
                </div>
            </div>

            {unpositionedSeats.length > 0 && (
                <div className="rounded-xl bg-yellow-50 p-4 text-sm text-yellow-800">
                    {unpositionedSeats.length} seats do not have layout positions yet.
                    They will not appear on the visual map until layout_x and layout_y are
                    added.
                </div>
            )}
        </div>
    );
}