import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import TicketPdfDocument from "@/components/TicketPdfDocument";
import path from "path";
import { readFile } from "fs/promises";

export const dynamic = "force-dynamic";

type RouteProps = {
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
                .join(" | ") || "No seats found",
    };
}

async function getShowLogoDataUri() {
    try {
        const logoPath = path.join(process.cwd(), "public", "show-logo.png");
        const logoBuffer = await readFile(logoPath);
        return `data:image/png;base64,${logoBuffer.toString("base64")}`;
    } catch {
        return null;
    }
}

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
        return Response.json(
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

    const { seatingArea, seats } = buildSeatDisplay(booking.booking_seats as any[]);

    const logoDataUri = await getShowLogoDataUri();

    const pdfElement = React.createElement(TicketPdfDocument as any, {
        eventName: event?.name || "School Event",
        eventDate: event?.event_date || null,
        venue: event?.venue || null,
        ticketId: booking.ticket_id,
        bookingCode: bookingCode?.code || "-",
        learnerName: booking.learner_name,
        parentName: booking.parent_name,
        seats,
        seatingArea,
        logoDataUri,
    });

    const pdfBuffer = await renderToBuffer(pdfElement as any);

    return new Response(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="ticket-${booking.ticket_id}.pdf"`,
            "Cache-Control": "no-store",
        },
    });
}
