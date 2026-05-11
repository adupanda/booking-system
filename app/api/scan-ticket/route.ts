import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
    const formData = await request.formData();
    const ticketId = String(formData.get("ticketId") || "").trim();

    if (!ticketId) {
        return NextResponse.json(
            { success: false, message: "Ticket ID missing." },
            { status: 400 }
        );
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
        .from("bookings")
        .select("id, ticket_id, status")
        .eq("ticket_id", ticketId)
        .single();

    if (bookingError || !booking || booking.status !== "confirmed") {
        await supabaseAdmin.from("ticket_scans").insert({
            booking_id: null,
            ticket_id: ticketId,
            scan_status: "invalid",
        });

        redirect(`/verify/${encodeURIComponent(ticketId)}`);
    }

    const { data: existingValidScans } = await supabaseAdmin
        .from("ticket_scans")
        .select("id")
        .eq("booking_id", booking.id)
        .eq("scan_status", "valid");

    if (existingValidScans && existingValidScans.length > 0) {
        await supabaseAdmin.from("ticket_scans").insert({
            booking_id: booking.id,
            ticket_id: ticketId,
            scan_status: "duplicate",
        });

        redirect(`/verify/${encodeURIComponent(ticketId)}`);
    }

    await supabaseAdmin.from("ticket_scans").insert({
        booking_id: booking.id,
        ticket_id: ticketId,
        scan_status: "valid",
    });

    redirect(`/verify/${encodeURIComponent(ticketId)}`);
}