import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import VisualSeatMap from "@/components/VisualSeatMap";

export default async function AdminSeatMapPage() {
    const { data: seats, error: seatsError } = await supabaseAdmin
        .from("seats")
        .select("*")
        .order("row_name", { ascending: true })
        .order("seat_number", { ascending: true });

    const { data: bookingSeats, error: bookingSeatsError } = await supabaseAdmin
        .from("booking_seats")
        .select(
            `
      seat_id,
      bookings (
        ticket_id,
        learner_name,
        parent_name,
        booking_codes (
          code
        )
      )
    `
        );

    if (seatsError || bookingSeatsError) {
        return (
            <main className="min-h-screen bg-gray-50 p-8">
                <h1 className="text-3xl font-bold text-red-600">
                    Could not load seat map
                </h1>

                <pre className="mt-4 rounded bg-white p-4 text-sm text-red-600">
          {seatsError?.message || bookingSeatsError?.message}
        </pre>
            </main>
        );
    }

    const bookingInfo =
        bookingSeats?.map((item: any) => {
            const booking = Array.isArray(item.bookings)
                ? item.bookings[0]
                : item.bookings;

            const bookingCode = Array.isArray(booking?.booking_codes)
                ? booking.booking_codes[0]
                : booking?.booking_codes;

            return {
                seat_id: item.seat_id,
                ticket_id: booking?.ticket_id || null,
                learner_name: booking?.learner_name || null,
                parent_name: booking?.parent_name || null,
                booking_code: bookingCode?.code || null,
            };
        }) || [];

    const totalSeats = seats?.length || 0;
    const availableSeats =
        seats?.filter((seat: any) => seat.status === "available").length || 0;
    const bookedSeats =
        seats?.filter((seat: any) => seat.status === "booked").length || 0;
    const blockedSeats =
        seats?.filter((seat: any) => seat.status === "blocked").length || 0;

    return (
        <main className="min-h-screen bg-gray-50 p-6">
            <div className="mx-auto max-w-7xl">
                <div className="flex flex-col justify-between gap-4 rounded-2xl bg-white p-6 shadow sm:flex-row sm:items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            Auditorium Seat Map
                        </h1>

                        <p className="mt-1 text-gray-600">
                            Visual layout of booked, available, and blocked seats.
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <Link
                            href="/admin/seats"
                            className="rounded-lg bg-gray-200 px-4 py-3 text-center font-semibold text-gray-900"
                        >
                            Seat Table
                        </Link>

                        <Link
                            href="/admin"
                            className="rounded-lg bg-black px-4 py-3 text-center font-semibold text-white"
                        >
                            Admin Home
                        </Link>
                    </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-4">
                    <div className="rounded-xl bg-white p-5 shadow">
                        <p className="text-sm text-gray-500">Total Seats</p>
                        <p className="mt-1 text-3xl font-bold text-gray-900">
                            {totalSeats}
                        </p>
                    </div>

                    <div className="rounded-xl bg-white p-5 shadow">
                        <p className="text-sm text-gray-500">Available</p>
                        <p className="mt-1 text-3xl font-bold text-green-600">
                            {availableSeats}
                        </p>
                    </div>

                    <div className="rounded-xl bg-white p-5 shadow">
                        <p className="text-sm text-gray-500">Booked</p>
                        <p className="mt-1 text-3xl font-bold text-orange-600">
                            {bookedSeats}
                        </p>
                    </div>

                    <div className="rounded-xl bg-white p-5 shadow">
                        <p className="text-sm text-gray-500">Blocked</p>
                        <p className="mt-1 text-3xl font-bold text-gray-900">
                            {blockedSeats}
                        </p>
                    </div>
                </div>

                <div className="mt-6">
                    <div className="space-y-10">
                        <section>
                            <h2 className="mb-4 text-2xl font-bold text-gray-900">
                                Ground Floor
                            </h2>

                            <VisualSeatMap
                                seats={(seats || []).filter((seat: any) => seat.floor_name === "ground")}
                                bookingInfo={bookingInfo}
                            />
                        </section>

                        <section>
                            <h2 className="mb-4 text-2xl font-bold text-gray-900">
                                First Floor
                            </h2>

                            <VisualSeatMap
                                seats={(seats || []).filter((seat: any) => seat.floor_name === "first")}
                                bookingInfo={bookingInfo}
                            />
                        </section>
                    </div>
                </div>
            </div>
        </main>
    );
}