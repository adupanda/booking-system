import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function AdminSeatsPage() {
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
        status
      )
    `
        );

    if (seatsError || bookingSeatsError) {
        return (
            <main className="min-h-screen bg-gray-50 p-8">
                <h1 className="text-3xl font-bold text-red-600">
                    Could not load seats
                </h1>

                <pre className="mt-4 rounded bg-white p-4 text-sm text-red-600">
          {seatsError?.message || bookingSeatsError?.message}
        </pre>
            </main>
        );
    }

    const bookingBySeatId = new Map<string, any>();

    for (const item of bookingSeats || []) {
        bookingBySeatId.set(item.seat_id, item.bookings);
    }

    const totalSeats = seats?.length || 0;
    const availableSeats =
        seats?.filter((seat: any) => seat.status === "available").length || 0;
    const bookedSeats =
        seats?.filter((seat: any) => seat.status === "booked").length || 0;
    const blockedSeats =
        seats?.filter((seat: any) => seat.status === "blocked").length || 0;

    function getStatusClass(status: string) {
        if (status === "available") {
            return "bg-green-100 text-green-700";
        }

        if (status === "booked") {
            return "bg-orange-100 text-orange-700";
        }

        if (status === "blocked") {
            return "bg-black text-white";
        }

        return "bg-gray-100 text-gray-700";
    }

    return (
        <main className="min-h-screen bg-gray-50 p-6">
            <div className="mx-auto max-w-7xl">
                <div className="flex flex-col justify-between gap-4 rounded-2xl bg-white p-6 shadow sm:flex-row sm:items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            Seat Overview
                        </h1>

                        <p className="mt-1 text-gray-600">
                            Check seat availability and which ticket owns each booked seat.
                        </p>
                    </div>

                    <Link
                        href="/admin"
                        className="rounded-lg bg-black px-4 py-3 text-center font-semibold text-white"
                    >
                        Admin Home
                    </Link>
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

                <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow">
                    <table className="min-w-full border-collapse text-sm">
                        <thead className="bg-gray-100 text-left text-gray-700">
                        <tr>
                            <th className="whitespace-nowrap px-4 py-3">Seat</th>
                            <th className="whitespace-nowrap px-4 py-3">Row</th>
                            <th className="whitespace-nowrap px-4 py-3">Number</th>
                            <th className="whitespace-nowrap px-4 py-3">Section</th>
                            <th className="whitespace-nowrap px-4 py-3">Status</th>
                            <th className="whitespace-nowrap px-4 py-3">Ticket</th>
                            <th className="whitespace-nowrap px-4 py-3">Learner / Guest</th>
                            <th className="whitespace-nowrap px-4 py-3">Parent</th>
                        </tr>
                        </thead>

                        <tbody>
                        {seats && seats.length > 0 ? (
                            seats.map((seat: any) => {
                                const booking = bookingBySeatId.get(seat.id);
                                const bookingData = Array.isArray(booking)
                                    ? booking[0]
                                    : booking;

                                return (
                                    <tr key={seat.id} className="border-t border-gray-200">
                                        <td className="whitespace-nowrap px-4 py-3 text-lg font-bold text-gray-900">
                                            {seat.seat_label}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                                            {seat.row_name || "-"}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                                            {seat.seat_number || "-"}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                                            {seat.section || "-"}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3">
                        <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusClass(
                                seat.status
                            )}`}
                        >
                          {seat.status}
                        </span>
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3 font-mono text-gray-700">
                                            {bookingData?.ticket_id || "-"}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                                            {bookingData?.learner_name || "-"}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                                            {bookingData?.parent_name || "-"}
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td
                                    colSpan={8}
                                    className="px-4 py-10 text-center text-gray-500"
                                >
                                    No seats found.
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    );
}