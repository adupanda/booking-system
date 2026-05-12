export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function AdminBookingsPage() {
    const { data: bookings, error } = await supabaseAdmin
        .from("bookings")
        .select(
            `
      id,
      ticket_id,
      learner_name,
      parent_name,
      parent_email,
      parent_phone,
      status,
      created_at,
      events (
        name,
        event_date,
        venue
      ),
      booking_codes (
        code,
        code_type,
        max_seats
      ),
      booking_seats (
        seats (
          seat_label,
          display_label,
          row_name,
          seat_number,
          section
        )
      )
    `
        )
        .order("created_at", { ascending: false });

    const { data: scans, error: scansError } = await supabaseAdmin
        .from("ticket_scans")
        .select("id, booking_id, ticket_id, scanned_at, scan_status")
        .order("scanned_at", { ascending: true });

    if (error || scansError) {
        return (
            <main className="min-h-screen bg-gray-50 p-8">
                <h1 className="text-3xl font-bold text-red-600">
                    Could not load bookings
                </h1>

                <pre className="mt-4 rounded bg-white p-4 text-sm text-red-600">
          {error?.message || scansError?.message}
        </pre>
            </main>
        );
    }

    const scansByBookingId = new Map<string, any[]>();

    for (const scan of scans || []) {
        if (!scan.booking_id) continue;

        const existing = scansByBookingId.get(scan.booking_id) || [];
        existing.push(scan);
        scansByBookingId.set(scan.booking_id, existing);
    }

    function getSeats(booking: any) {
        return (
            booking.booking_seats
                ?.map((item: any) => {
                    const seat = item.seats;
                    if (!seat) return null;

                    const label = seat.display_label || seat.seat_label;
                    const section = seat.section;

                    return section ? `${section} - ${label}` : label;
                })
                .filter(Boolean)
                .join(", ") || "-"
        );
    }

    function getScanStatus(booking: any) {
        const bookingScans = scansByBookingId.get(booking.id) || [];

        const hasValidScan = bookingScans.some(
            (scan: any) => scan.scan_status === "valid"
        );

        if (hasValidScan) {
            return "Entered";
        }

        const hasDuplicateScan = bookingScans.some(
            (scan: any) => scan.scan_status === "duplicate"
        );

        if (hasDuplicateScan) {
            return "Duplicate Scan";
        }

        return "Not entered";
    }

    function getFirstScanTime(booking: any) {
        const bookingScans = scansByBookingId.get(booking.id) || [];

        const validScan = bookingScans.find(
            (scan: any) => scan.scan_status === "valid"
        );

        if (!validScan) return "-";

        return new Date(validScan.scanned_at).toLocaleString();
    }

    function getEvent(booking: any) {
        return Array.isArray(booking.events) ? booking.events[0] : booking.events;
    }

    function getBookingCode(booking: any) {
        return Array.isArray(booking.booking_codes)
            ? booking.booking_codes[0]
            : booking.booking_codes;
    }

    const enteredCount =
        bookings?.filter((booking: any) => getScanStatus(booking) === "Entered")
            .length || 0;

    const notEnteredCount =
        bookings?.filter(
            (booking: any) => getScanStatus(booking) === "Not entered"
        ).length || 0;

    const confirmedCount =
        bookings?.filter((booking: any) => booking.status === "confirmed").length ||
        0;

    return (
        <main className="min-h-screen bg-gray-50 p-6">
            <div className="mx-auto max-w-7xl">
                <div className="flex flex-col justify-between gap-4 rounded-2xl bg-white p-6 shadow sm:flex-row sm:items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            Admin Bookings
                        </h1>

                        <p className="mt-1 text-gray-600">
                            View confirmed bookings, seats, tickets, and entry status.
                        </p>
                    </div>

                    <Link
                        href="/"
                        className="rounded-lg bg-black px-4 py-3 text-center font-semibold text-white"
                    >
                        Parent Booking Page
                    </Link>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-4">
                    <div className="rounded-xl bg-white p-5 shadow">
                        <p className="text-sm text-gray-500">Total Bookings</p>
                        <p className="mt-1 text-3xl font-bold text-gray-900">
                            {bookings?.length || 0}
                        </p>
                    </div>

                    <div className="rounded-xl bg-white p-5 shadow">
                        <p className="text-sm text-gray-500">Entered</p>
                        <p className="mt-1 text-3xl font-bold text-green-600">
                            {enteredCount}
                        </p>
                    </div>

                    <div className="rounded-xl bg-white p-5 shadow">
                        <p className="text-sm text-gray-500">Not Entered</p>
                        <p className="mt-1 text-3xl font-bold text-orange-600">
                            {notEnteredCount}
                        </p>
                    </div>

                    <div className="rounded-xl bg-white p-5 shadow">
                        <p className="text-sm text-gray-500">Confirmed</p>
                        <p className="mt-1 text-3xl font-bold text-gray-900">
                            {confirmedCount}
                        </p>
                    </div>
                </div>

                <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow">
                    <table className="min-w-full border-collapse text-sm">
                        <thead className="bg-gray-100 text-left text-gray-700">
                        <tr>
                            <th className="whitespace-nowrap px-4 py-3">Booking Time</th>
                            <th className="whitespace-nowrap px-4 py-3">Learner / Guest</th>
                            <th className="whitespace-nowrap px-4 py-3">Parent</th>
                            <th className="whitespace-nowrap px-4 py-3">Code</th>
                            <th className="whitespace-nowrap px-4 py-3">Type</th>
                            <th className="whitespace-nowrap px-4 py-3">Seats</th>
                            <th className="whitespace-nowrap px-4 py-3">Ticket ID</th>
                            <th className="whitespace-nowrap px-4 py-3">Entry</th>
                            <th className="whitespace-nowrap px-4 py-3">Scanned At</th>
                            <th className="whitespace-nowrap px-4 py-3">Actions</th>
                        </tr>
                        </thead>

                        <tbody>
                        {bookings && bookings.length > 0 ? (
                            bookings.map((booking: any) => {
                                const bookingCode = getBookingCode(booking);
                                const scanStatus = getScanStatus(booking);

                                return (
                                    <tr key={booking.id} className="border-t border-gray-200">
                                        <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                                            {new Date(booking.created_at).toLocaleString()}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                                            {booking.learner_name || "Guest"}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                                            {booking.parent_name || "-"}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3 font-mono text-gray-700">
                                            {bookingCode?.code || "-"}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                                            {bookingCode?.code_type || "-"}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3 text-lg font-bold text-gray-900">
                                            {getSeats(booking)}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3 font-mono text-gray-700">
                                            {booking.ticket_id}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3">
                        <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                                scanStatus === "Entered"
                                    ? "bg-green-100 text-green-700"
                                    : scanStatus === "Duplicate Scan"
                                        ? "bg-red-100 text-red-700"
                                        : "bg-orange-100 text-orange-700"
                            }`}
                        >
                          {scanStatus}
                        </span>
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                                            {getFirstScanTime(booking)}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3">
                                            <div className="flex gap-2">
                                                <Link
                                                    href={`/ticket/${encodeURIComponent(
                                                        booking.ticket_id
                                                    )}`}
                                                    className="rounded bg-gray-900 px-3 py-2 text-xs font-semibold text-white"
                                                >
                                                    Ticket
                                                </Link>

                                                <Link
                                                    href={`/verify/${encodeURIComponent(
                                                        booking.ticket_id
                                                    )}`}
                                                    className="rounded bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
                                                >
                                                    Verify
                                                </Link>
                                            </div>
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
                                    No bookings found yet.
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>

                <p className="mt-4 text-sm text-gray-500">
                    Current event data is pulled from your Supabase bookings and ticket
                    scans tables.
                </p>
            </div>
        </main>
    );
}
