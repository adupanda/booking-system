import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import TicketPdfDocument from "@/components/TicketPdfDocument";

export const dynamic = "force-dynamic";

type RouteProps = {
    params: Promise<{
        ticketId: string;
    }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
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
          display_label,
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
        return NextResponse.json(
            { success: false, message: "Ticket not found." },
            { status: 404 }
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
            ?.map((item: any) => {
                const seat = item.seats;
                if (!seat) return null;

                const label = seat.display_label || seat.seat_label;
                return seat.section ? `${seat.section} - ${label}` : label;
            })
            .filter(Boolean)
            .join(", ") || "No seats found";

    const pdfBuffer = await renderToBuffer(
        <TicketPdfDocument
            eventName={event?.name || "School Event"}
    eventDate={event?.event_date || null}
    venue={event?.venue || null}
    ticketId={booking.ticket_id}
    bookingCode={bookingCode?.code || "-"}
    learnerName={booking.learner_name}
    parentName={booking.parent_name}
    seats={seats}
    codeType={bookingCode?.code_type || null}
    />
);

    return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="ticket-${booking.ticket_id}.pdf"`,
            "Cache-Control": "no-store",
        },
    });
}