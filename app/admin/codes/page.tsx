import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function AdminCodesPage() {
    const { data: codes, error: codesError } = await supabaseAdmin
        .from("booking_codes")
        .select("*")
        .order("created_at", { ascending: false });

    const { data: bookings, error: bookingsError } = await supabaseAdmin
        .from("bookings")
        .select(
            `
      booking_code_id,
      ticket_id,
      status,
      booking_seats (
        seats (
          seat_label
        )
      )
    `
        );

    if (codesError || bookingsError) {
        return (
            <main className="min-h-screen bg-gray-50 p-8">
                <h1 className="text-3xl font-bold text-red-600">
                    Could not load booking codes
                </h1>

                <pre className="mt-4 rounded bg-white p-4 text-sm text-red-600">
          {codesError?.message || bookingsError?.message}
        </pre>
            </main>
        );
    }

    const bookingByCodeId = new Map<string, any>();

    for (const booking of bookings || []) {
        bookingByCodeId.set(booking.booking_code_id, booking);
    }

    const totalCodes = codes?.length || 0;
    const unusedCodes =
        codes?.filter((code: any) => code.status === "unused").length || 0;
    const bookedCodes =
        codes?.filter((code: any) => code.status === "booked").length || 0;
    const paidCodes =
        codes?.filter((code: any) => code.code_type === "paid").length || 0;
    const vipCodes =
        codes?.filter((code: any) => code.code_type === "vip").length || 0;

    function getStatusClass(status: string) {
        if (status === "unused") {
            return "bg-green-100 text-green-700";
        }

        if (status === "booked") {
            return "bg-orange-100 text-orange-700";
        }

        if (status === "cancelled") {
            return "bg-red-100 text-red-700";
        }

        if (status === "partially_booked") {
            return "bg-blue-100 text-blue-700";
        }

        return "bg-gray-100 text-gray-700";
    }

    function getSeatsForBooking(booking: any) {
        return (
            booking?.booking_seats
                ?.map((item: any) => item.seats?.seat_label)
                .filter(Boolean)
                .join(", ") || "-"
        );
    }

    return (
        <main className="min-h-screen bg-gray-50 p-6">
            <div className="mx-auto max-w-7xl">
                <div className="flex flex-col justify-between gap-4 rounded-2xl bg-white p-6 shadow sm:flex-row sm:items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            Booking Codes
                        </h1>

                        <p className="mt-1 text-gray-600">
                            View regular, paid, VIP, used, and unused booking codes.
                        </p>
                    </div>

                    <Link
                        href="/admin"
                        className="rounded-lg bg-black px-4 py-3 text-center font-semibold text-white"
                    >
                        Admin Home
                    </Link>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-5">
                    <div className="rounded-xl bg-white p-5 shadow">
                        <p className="text-sm text-gray-500">Total Codes</p>
                        <p className="mt-1 text-3xl font-bold text-gray-900">
                            {totalCodes}
                        </p>
                    </div>

                    <div className="rounded-xl bg-white p-5 shadow">
                        <p className="text-sm text-gray-500">Unused</p>
                        <p className="mt-1 text-3xl font-bold text-green-600">
                            {unusedCodes}
                        </p>
                    </div>

                    <div className="rounded-xl bg-white p-5 shadow">
                        <p className="text-sm text-gray-500">Booked</p>
                        <p className="mt-1 text-3xl font-bold text-orange-600">
                            {bookedCodes}
                        </p>
                    </div>

                    <div className="rounded-xl bg-white p-5 shadow">
                        <p className="text-sm text-gray-500">Paid Codes</p>
                        <p className="mt-1 text-3xl font-bold text-gray-900">
                            {paidCodes}
                        </p>
                    </div>

                    <div className="rounded-xl bg-white p-5 shadow">
                        <p className="text-sm text-gray-500">VIP Codes</p>
                        <p className="mt-1 text-3xl font-bold text-gray-900">
                            {vipCodes}
                        </p>
                    </div>
                </div>

                <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow">
                    <table className="min-w-full border-collapse text-sm">
                        <thead className="bg-gray-100 text-left text-gray-700">
                        <tr>
                            <th className="whitespace-nowrap px-4 py-3">Code</th>
                            <th className="whitespace-nowrap px-4 py-3">Type</th>
                            <th className="whitespace-nowrap px-4 py-3">Status</th>
                            <th className="whitespace-nowrap px-4 py-3">Max Seats</th>
                            <th className="whitespace-nowrap px-4 py-3">Used Seats</th>
                            <th className="whitespace-nowrap px-4 py-3">Learner / Guest</th>
                            <th className="whitespace-nowrap px-4 py-3">Parent</th>
                            <th className="whitespace-nowrap px-4 py-3">Ticket</th>
                            <th className="whitespace-nowrap px-4 py-3">Seats</th>
                            <th className="whitespace-nowrap px-4 py-3">Actions</th>
                        </tr>
                        </thead>

                        <tbody>
                        {codes && codes.length > 0 ? (
                            codes.map((code: any) => {
                                const booking = bookingByCodeId.get(code.id);

                                return (
                                    <tr key={code.id} className="border-t border-gray-200">
                                        <td className="whitespace-nowrap px-4 py-3 font-mono font-bold text-gray-900">
                                            {code.code}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                                            {code.code_type}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3">
                        <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusClass(
                                code.status
                            )}`}
                        >
                          {code.status}
                        </span>
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                                            {code.max_seats}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                                            {code.used_seats}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                                            {code.learner_name || "Guest"}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                                            {code.parent_name || "-"}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3 font-mono text-gray-700">
                                            {booking?.ticket_id || "-"}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3 text-lg font-bold text-gray-900">
                                            {getSeatsForBooking(booking)}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3">
                                            {booking?.ticket_id ? (
                                                <Link
                                                    href={`/ticket/${encodeURIComponent(
                                                        booking.ticket_id
                                                    )}`}
                                                    className="rounded bg-gray-900 px-3 py-2 text-xs font-semibold text-white"
                                                >
                                                    Ticket
                                                </Link>
                                            ) : (
                                                <Link
                                                    href={`/book/${encodeURIComponent(code.code)}`}
                                                    className="rounded bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
                                                >
                                                    Test Book
                                                </Link>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td
                                    colSpan={10}
                                    className="px-4 py-10 text-center text-gray-500"
                                >
                                    No booking codes found.
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