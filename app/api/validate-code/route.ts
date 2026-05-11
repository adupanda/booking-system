import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const code = String(body.code || "").trim().toUpperCase();

        if (!code) {
            return NextResponse.json(
                { success: false, message: "Please enter a booking code." },
                { status: 400 }
            );
        }

        const { data: bookingCode, error } = await supabaseAdmin
            .from("booking_codes")
            .select(
                `
        id,
        code,
        learner_name,
        parent_name,
        max_seats,
        used_seats,
        status,
        code_type,
        event_id,
        events (
          id,
          name,
          event_date,
          venue
        )
      `
            )
            .eq("code", code)
            .single();

        if (error || !bookingCode) {
            return NextResponse.json(
                { success: false, message: "Invalid booking code." },
                { status: 404 }
            );
        }

        if (bookingCode.status === "cancelled") {
            return NextResponse.json(
                { success: false, message: "This booking code has been cancelled." },
                { status: 403 }
            );
        }

        if (bookingCode.status === "booked") {
            return NextResponse.json(
                {
                    success: false,
                    message: "This booking code has already been used.",
                    alreadyBooked: true,
                },
                { status: 409 }
            );
        }

        const remainingSeats = bookingCode.max_seats - bookingCode.used_seats;

        if (remainingSeats <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "This booking code has no seats remaining.",
                },
                { status: 409 }
            );
        }

        return NextResponse.json({
            success: true,
            code: bookingCode.code,
            bookingCodeId: bookingCode.id,
            learnerName: bookingCode.learner_name,
            parentName: bookingCode.parent_name,
            maxSeats: bookingCode.max_seats,
            usedSeats: bookingCode.used_seats,
            remainingSeats,
            codeType: bookingCode.code_type,
            eventId: bookingCode.event_id,
            event: bookingCode.events,
        });
    } catch (err) {
        console.error("Validate code error:", err);

        return NextResponse.json(
            { success: false, message: "Something went wrong." },
            { status: 500 }
        );
    }
}