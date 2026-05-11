import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
        });

        if (error) {
            console.error("Booking error:", error);

            return NextResponse.json(
                {
                    success: false,
                    message: error.message || "Could not complete booking.",
                },
                { status: 400 }
            );
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