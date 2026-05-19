import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import TicketActions from "@/components/TicketActions";

const SHOW_LOGO_SRC =
    process.env.NEXT_PUBLIC_SHOW_LOGO_URL || "/show-logo.png";

type PageProps = {
    params: Promise<{
        ticketId: string;
    }>;
};

function formatFloorName(value?: string | null) {
    const normalized = String(value || "").trim().toLowerCase();

    if (normalized.includes("balcony")) return "Balcony";
    if (normalized.includes("ground")) return "Ground";

    return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Seating Area";
}

function buildSeatDisplay(bookingSeats: any[] | null | undefined) {
    const groups = new Map<string, string[]>();

    for (const item of bookingSeats || []) {
        const seat = item?.seats;
        if (!seat) continue;

        const floor = formatFloorName(seat.floor_name);
        const label = seat.display_label || seat.seat_label;
        if (!label) continue;

        if (!groups.has(floor)) groups.set(floor, []);
        groups.get(floor)!.push(label);
    }

    const groupEntries = Array.from(groups.entries());

    return {
        seatingArea: groupEntries.map(([floor]) => floor).join(", ") || "-",
        seats:
            groupEntries
                .map(([floor, labels]) => `${floor}: ${labels.join(", ")}`)
                .join(" • ") || "No seats found",
    };
}

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
        max_seats
      ),
      booking_seats (
        seats (
          seat_label,
          display_label,
          row_name,
          seat_number,
          floor_name
        )
      )
    `
        )
        .eq("ticket_id", decodedTicketId)
        .single();

    if (error || !booking) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
                <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
                    <h1 className="text-2xl font-black text-red-600">
                        Ticket not found
                    </h1>

                    <p className="mt-3 text-gray-600">
                        This ticket could not be found.
                    </p>

                    <Link
                        href="/"
                        className="mt-6 inline-block rounded-xl bg-black px-5 py-3 font-semibold text-white"
                    >
                        Go Home
                    </Link>
                </div>
            </main>
        );
    }

    const { seatingArea, seats } = buildSeatDisplay(booking.booking_seats as any[]);

    const event = Array.isArray(booking.events)
        ? booking.events[0]
        : booking.events;

    const bookingCode = Array.isArray(booking.booking_codes)
        ? booking.booking_codes[0]
        : booking.booking_codes;

    return (
        <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-100 p-6">
            <div className="mx-auto max-w-3xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
                <div className="bg-slate-950 px-8 py-8 text-center text-white">
                    <div className="mx-auto flex justify-center">
                        <img
                            src={SHOW_LOGO_SRC}
                            alt="Show logo"
                            className="max-h-32 max-w-sm object-contain"
                        />
                    </div>

                    <p className="mt-6 text-xs font-semibold uppercase tracking-[0.35em] text-yellow-300">
                        Official Entry Ticket
                    </p>

                    <h1 className="mt-3 text-4xl font-black tracking-tight">
                        {event?.name || "School Event"}
                    </h1>

                    <p className="mt-3 text-sm text-slate-300">
                        {[event?.venue, event?.event_date].filter(Boolean).join(" • ")}
                    </p>
                </div>

                <div className="p-8">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ticket ID</p>
                            <p className="mt-2 break-all text-xl font-black text-slate-950">{booking.ticket_id}</p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Booking Code</p>
                            <p className="mt-2 break-all text-xl font-black text-slate-950">{bookingCode?.code}</p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Learner / Guest</p>
                            <p className="mt-2 text-lg font-bold text-slate-950">
                                {booking.learner_name || "Guest"}
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Parent / Contact</p>
                            <p className="mt-2 text-lg font-bold text-slate-950">
                                {booking.parent_name || "Not provided"}
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 rounded-3xl bg-yellow-100 p-6 text-center ring-1 ring-yellow-200">
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-yellow-800">Seating Area</p>
                        <p className="mt-2 text-4xl font-black tracking-tight text-slate-950">{seatingArea}</p>
                        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.25em] text-yellow-800">Seats</p>
                        <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{seats}</p>
                    </div>

                    <div className="mt-8 rounded-2xl bg-blue-50 p-5 text-sm leading-6 text-blue-900">
                        Please show this ticket at the entrance. Entry staff will verify your ticket using the ticket ID and seat details.
                    </div>

                    <TicketActions ticketId={booking.ticket_id} />

                    <p className="mt-6 text-center text-sm text-gray-500">
                        Use your browser print option to save or print this ticket.
                    </p>
                </div>
            </div>
        </main>
    );
}
