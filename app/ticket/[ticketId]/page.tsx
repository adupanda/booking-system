import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type PageProps = {
    params: Promise<{
        ticketId: string;
    }>;
};

export default async function TicketPage({ params }: PageProps) {
    const { ticketId } = await params;

    const decodedTicketId = decodeURIComponent(ticketId).trim();

    const { data: booking, error } = await supabaseAdmin
        .from("bookings")
        .select(
            `
      id,
      ticket_id,
      learner_name,
      parent_name,
      parent_email,
      parent_phone,
      created_at,
      status,
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
          row_name,
          seat_number,
          section
        )
      )
    `
        )
        .eq("ticket_id", decodedTicketId)
        .single();

    if (error || !booking) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
                <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow">
                    <h1 className="text-2xl font-bold text-red-600">
                        Ticket not found
                    </h1>

                    <p className="mt-3 text-gray-600">
                        This ticket could not be found.
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

    const seats =
        booking.booking_seats
            ?.map((item: any) => item.seats?.seat_label)
            .filter(Boolean)
            .join(", ") || "No seats found";

    const event = Array.isArray(booking.events)
        ? booking.events[0]
        : booking.events;

    const bookingCode = Array.isArray(booking.booking_codes)
        ? booking.booking_codes[0]
        : booking.booking_codes;

    return (
        <main className="min-h-screen bg-gray-50 p-6">
            <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow">
                <div className="text-center">
                    <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                        School Event Ticket
                    </p>

                    <h1 className="mt-2 text-3xl font-bold text-gray-900">
                        {event?.name}
                    </h1>

                    <p className="mt-2 text-gray-600">{event?.venue}</p>
                    <p className="text-gray-600">{event?.event_date}</p>
                </div>

                <div className="mt-8 rounded-xl border border-gray-200 p-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <p className="text-sm text-gray-500">Ticket ID</p>
                            <p className="font-bold text-gray-900">{booking.ticket_id}</p>
                        </div>

                        <div>
                            <p className="text-sm text-gray-500">Booking Code</p>
                            <p className="font-bold text-gray-900">{bookingCode?.code}</p>
                        </div>

                        <div>
                            <p className="text-sm text-gray-500">Learner / Guest</p>
                            <p className="font-bold text-gray-900">
                                {booking.learner_name || "Guest"}
                            </p>
                        </div>

                        <div>
                            <p className="text-sm text-gray-500">Parent / Contact</p>
                            <p className="font-bold text-gray-900">
                                {booking.parent_name || "Not provided"}
                            </p>
                        </div>

                        <div>
                            <p className="text-sm text-gray-500">Code Type</p>
                            <p className="font-bold text-gray-900">
                                {bookingCode?.code_type}
                            </p>
                        </div>

                        <div>
                            <p className="text-sm text-gray-500">Status</p>
                            <p className="font-bold text-gray-900">{booking.status}</p>
                        </div>
                    </div>

                    <div className="mt-6 rounded-xl bg-gray-100 p-5 text-center">
                        <p className="text-sm text-gray-500">Seats</p>
                        <p className="mt-1 text-3xl font-bold text-gray-900">{seats}</p>
                    </div>
                </div>

                <div className="mt-8 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
                    Please show this ticket at the entrance. Entry staff will verify your ticket
                    using the ticket ID and seat details.
                </div>

                <p className="mt-6 text-center text-sm text-gray-500">
                    Use your browser print option to save or print this ticket.
                </p>
            </div>
        </main>
    );
}