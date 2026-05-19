import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const code = String(body.code || "").trim().toUpperCase();
        const seatIds = body.seatIds;

        if (!code) {
            return NextResponse.json(
                { success: false, message: "Booking code is missing." },
                { status: 400 }
            );
        }

        if (!Array.isArray(seatIds) || seatIds.length === 0) {
            return NextResponse.json(
                { success: false, message: "Please select at least one seat." },
                { status: 400 }
            );
        }

        const { data, error } = await supabaseAdmin.rpc("confirm_seat_booking", {
            p_code: code,
            p_seat_ids: seatIds,
            p_payment_order_id: null,
        });

        if (error) {
            console.error("Booking error:", error);

            const rawMessage = String(error.message || "");
            const lowerMessage = rawMessage.toLowerCase();
            const message =
                lowerMessage.includes("blocked") ||
                lowerMessage.includes("not available") ||
                lowerMessage.includes("already")
                    ? "One or more selected seats are currently blocked by another booking. Please refresh and choose another seat."
                    : lowerMessage.includes("payment")
                      ? "This seat selection needs payment. Please refresh and try again."
                      : rawMessage || "Could not complete booking.";

            return NextResponse.json({ success: false, message }, { status: 400 });
        }

        const bookingResult = data?.[0];

        if (!bookingResult) {
            return NextResponse.json(
                { success: false, message: "Booking failed. Please try again." },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            bookingId: bookingResult.booking_id,
            ticketId: bookingResult.ticket_id,
        });
    } catch (err) {
        console.error("Booking API error:", err);

        return NextResponse.json(
            { success: false, message: "Something went wrong." },
            { status: 500 }
        );
    }
}
