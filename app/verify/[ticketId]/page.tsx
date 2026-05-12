import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cookies } from "next/headers";

type PageProps = {
    params: Promise<{
        ticketId: string;
    }>;
};

export default async function VerifyTicketPage({ params }: PageProps) {
    const { ticketId } = await params;
    const cookieStore = await cookies();
    const isScannerLoggedIn = cookieStore.get("admin_auth")?.value === "true";

    const decodedTicketId = decodeURIComponent(ticketId).trim();

    const { data: booking, error } = await supabaseAdmin
        .from("bookings")
        .select(
            `
      id,
      ticket_id,
      learner_name,
      parent_name,
      status,
      events (
        name,
        event_date,
        venue
      ),
      booking_codes (
        code,
        code_type
      ),
      booking_seats (
        seats (
          seat_label,
          section
        )
      ),
      ticket_scans (
        id,
        scanned_at,
        scan_status
      )
    `
        )
        .eq("ticket_id", decodedTicketId)
        .single();

    if (error || !booking) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-red-50 p-6">
                <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow">
                    <h1 className="text-3xl font-bold text-red-600">Invalid Ticket</h1>

                    <p className="mt-3 text-gray-600">
                        This ticket does not exist in the system.
                    </p>

                    <Link
                        href="/"
                        className="mt-6 inline-block rounded-lg bg-black px-4 py-3 font-semibold text-white"
                    >
                        Go Home
                    </Link>
                </div>
            </main>
        );
    }

    const event = Array.isArray(booking.events)
        ? booking.events[0]
        : booking.events;

    const bookingCode = Array.isArray(booking.booking_codes)
        ? booking.booking_codes[0]
        : booking.booking_codes;

    const seats =
        booking.booking_seats
            ?.map((item: any) => item.seats?.seat_label)
            .filter(Boolean)
            .join(", ") || "No seats found";

    const validScans =
        booking.ticket_scans?.filter(
            (scan: any) => scan.scan_status === "valid"
        ) || [];

    const alreadyScanned = validScans.length > 0;

    const firstScan = alreadyScanned ? validScans[0] : null;

    return (
        <main
            className={`min-h-screen p-6 ${
                alreadyScanned ? "bg-orange-50" : "bg-green-50"
            }`}
        >
            <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow">
                <div className="text-center">
                    {alreadyScanned ? (
                        <>
                            <h1 className="text-3xl font-bold text-orange-600">
                                Already Scanned
                            </h1>
                            <p className="mt-2 text-gray-600">
                                This ticket has already been used.
                            </p>
                        </>
                    ) : (
                        <>
                            <h1 className="text-3xl font-bold text-green-600">
                                Valid Ticket
                            </h1>
                            <p className="mt-2 text-gray-600">
                                Confirm details before allowing entry.
                            </p>
                        </>
                    )}
                </div>

                <div className="mt-8 space-y-4 rounded-xl border border-gray-200 p-5">
                    <div>
                        <p className="text-sm text-gray-500">Event</p>
                        <p className="font-bold text-gray-900">{event?.name}</p>
                    </div>

                    <div>
                        <p className="text-sm text-gray-500">Ticket ID</p>
                        <p className="font-bold text-gray-900">{booking.ticket_id}</p>
                    </div>

                    <div>
                        <p className="text-sm text-gray-500">Learner / Guest</p>
                        <p className="font-bold text-gray-900">
                            {booking.learner_name || "Guest"}
                        </p>
                    </div>

                    <div>
                        <p className="text-sm text-gray-500">Seats</p>
                        <p className="text-3xl font-bold text-gray-900">{seats}</p>
                    </div>

                    <div>
                        <p className="text-sm text-gray-500">Booking Code</p>
                        <p className="font-bold text-gray-900">{bookingCode?.code}</p>
                    </div>

                    <div>
                        <p className="text-sm text-gray-500">Code Type</p>
                        <p className="font-bold text-gray-900">{bookingCode?.code_type}</p>
                    </div>

                    {!alreadyScanned && isScannerLoggedIn && (
                        <form action={`/api/scan-ticket`} method="POST" className="mt-6">
                            <input type="hidden" name="ticketId" value={booking.ticket_id} />

                            <button
                                type="submit"
                                className="w-full rounded-lg bg-green-600 px-4 py-4 text-lg font-bold text-white"
                            >
                                Mark as Entered
                            </button>
                        </form>
                    )}

                    {!alreadyScanned && !isScannerLoggedIn && (
                        <div className="mt-6 rounded-xl bg-yellow-50 p-4 text-sm text-yellow-800">
                            This ticket is valid. Entry marking is only available to authorized scanning staff.
                        </div>
                    )}
                </div>

                {!alreadyScanned && (
                    <form action={`/api/scan-ticket`} method="POST" className="mt-6">
                        <input type="hidden" name="ticketId" value={booking.ticket_id} />

                        <button
                            type="submit"
                            className="w-full rounded-lg bg-green-600 px-4 py-4 text-lg font-bold text-white"
                        >
                            Mark as Entered
                        </button>
                    </form>
                )}
            </div>
        </main>
    );
}