import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
    try {
        await supabaseAdmin.rpc("release_expired_seat_holds");
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
                included_seat_limit,
                allow_paid_extra_seats,
                guest_seat_price_paise,
                max_paid_extra_seats,
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

        const { data: existingBooking } = await supabaseAdmin
            .from("bookings")
            .select("ticket_id")
            .eq("booking_code_id", bookingCode.id)
            .eq("status", "confirmed")
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

        if (bookingCode.status === "booked" && !bookingCode.allow_paid_extra_seats) {
            return NextResponse.json(
                {
                    success: false,
                    code: bookingCode.code,
                    message: "This booking code has already been used.",
                    alreadyBooked: true,
                    ticketId: existingBooking?.ticket_id || null,
                },
                { status: 409 }
            );
        }

        const { data: confirmedBookings, error: bookingLookupError } = await supabaseAdmin
            .from("bookings")
            .select("id")
            .eq("booking_code_id", bookingCode.id)
            .eq("status", "confirmed");

        if (bookingLookupError) {
            console.error("Validate code booking lookup error:", bookingLookupError);
            return NextResponse.json(
                { success: false, message: "Could not check booking usage." },
                { status: 500 }
            );
        }

        const bookingIds = (confirmedBookings || []).map((booking) => booking.id);
        let usedIncludedSeats = 0;
        let usedPaidGuestSeats = 0;

        if (bookingIds.length > 0) {
            const { data: seatUses, error: seatUsesError } = await supabaseAdmin
                .from("booking_seats")
                .select("seat_use_type")
                .in("booking_id", bookingIds);

            if (seatUsesError) {
                console.error("Validate code seat uses error:", seatUsesError);
                return NextResponse.json(
                    { success: false, message: "Could not check booked seats." },
                    { status: 500 }
                );
            }

            for (const seatUse of seatUses || []) {
                if (seatUse.seat_use_type === "paid_guest") usedPaidGuestSeats++;
                else usedIncludedSeats++;
            }
        }

        const includedSeatLimit = Number(bookingCode.included_seat_limit || 2);
        const includedSeatsRemaining = Math.max(includedSeatLimit - usedIncludedSeats, 0);

        return NextResponse.json({
            success: true,
            code: bookingCode.code,
            bookingCodeId: bookingCode.id,
            learnerName: bookingCode.learner_name,
            parentName: bookingCode.parent_name,
            maxSeats: bookingCode.max_seats,
            usedSeats: bookingCode.used_seats,
            codeType: bookingCode.code_type,
            eventId: bookingCode.event_id,
            event: bookingCode.events,
            includedSeatLimit,
            includedSeatsRemaining,
            usedIncludedSeats,
            usedPaidGuestSeats,
            allowPaidExtraSeats: Boolean(bookingCode.allow_paid_extra_seats),
            guestSeatPricePaise: Number(bookingCode.guest_seat_price_paise || 0),
            maxPaidExtraSeats: bookingCode.max_paid_extra_seats,
            existingTicketId: existingBooking?.ticket_id || null,
            hasExistingTicket: Boolean(existingBooking?.ticket_id),
        });
    } catch (err) {
        console.error("Validate code error:", err);

        return NextResponse.json(
            { success: false, message: "Something went wrong." },
            { status: 500 }
        );
    }
}
