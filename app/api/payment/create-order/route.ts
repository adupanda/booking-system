import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const Razorpay = require("razorpay");

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

type SelectedSeat = {
    id: string;
    event_id: string;
    status: string;
    is_bookable: boolean | null;
    seat_category: string | null;
    allowed_code_types: string[] | null;
};

function isPaidFamilySeat(seat: SelectedSeat) {
    return seat.seat_category === "paid" || seat.seat_category === "family_paid";
}

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

        const uniqueSeatIds = Array.from(new Set(seatIds.map((id) => String(id))));

        if (uniqueSeatIds.length !== seatIds.length) {
            return NextResponse.json(
                { success: false, message: "Duplicate seats were selected." },
                { status: 400 }
            );
        }

        const { data: bookingCode, error: codeError } = await supabaseAdmin
            .from("booking_codes")
            .select(
                `
                id,
                code,
                event_id,
                status,
                code_type,
                included_seat_limit,
                allow_paid_extra_seats,
                guest_seat_price_paise,
                max_paid_extra_seats
            `
            )
            .eq("code", code)
            .single();

        if (codeError || !bookingCode) {
            return NextResponse.json(
                { success: false, message: "Invalid booking code." },
                { status: 400 }
            );
        }

        if (bookingCode.status === "cancelled") {
            return NextResponse.json(
                { success: false, message: "This booking code has been cancelled." },
                { status: 400 }
            );
        }

        const { data: confirmedBookings, error: bookingLookupError } = await supabaseAdmin
            .from("bookings")
            .select("id")
            .eq("booking_code_id", bookingCode.id)
            .eq("status", "confirmed");

        if (bookingLookupError) {
            console.error("Booking lookup error:", bookingLookupError);
            return NextResponse.json(
                { success: false, message: "Could not check existing bookings." },
                { status: 500 }
            );
        }

        const bookingIds = (confirmedBookings || []).map((booking) => booking.id);

        let usedIncludedCount = 0;
        let usedPaidGuestCount = 0;

        if (bookingIds.length > 0) {
            const { data: existingSeatUses, error: existingSeatsError } = await supabaseAdmin
                .from("booking_seats")
                .select("seat_use_type")
                .in("booking_id", bookingIds);

            if (existingSeatsError) {
                console.error("Existing booking seats error:", existingSeatsError);
                return NextResponse.json(
                    { success: false, message: "Could not check existing seats." },
                    { status: 500 }
                );
            }

            for (const seatUse of existingSeatUses || []) {
                if (seatUse.seat_use_type === "paid_guest") usedPaidGuestCount++;
                else usedIncludedCount++;
            }
        }

        const includedLimit = Number(bookingCode.included_seat_limit || 2);
        const includedRemaining = Math.max(includedLimit - usedIncludedCount, 0);
        const paidGuestSeatCount = Math.max(uniqueSeatIds.length - includedRemaining, 0);

        if (paidGuestSeatCount > 0 && !bookingCode.allow_paid_extra_seats) {
            return NextResponse.json(
                { success: false, message: "This code does not allow extra guest seats." },
                { status: 400 }
            );
        }

        if (
            paidGuestSeatCount > 0 &&
            bookingCode.max_paid_extra_seats !== null &&
            bookingCode.max_paid_extra_seats !== undefined &&
            usedPaidGuestCount + paidGuestSeatCount > Number(bookingCode.max_paid_extra_seats)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "You have reached the maximum number of extra guest seats allowed for this code.",
                },
                { status: 400 }
            );
        }

        const { data: selectedSeats, error: seatError } = await supabaseAdmin
            .from("seats")
            .select("id, event_id, status, is_bookable, seat_category, allowed_code_types")
            .in("id", uniqueSeatIds);

        if (seatError || !selectedSeats || selectedSeats.length !== uniqueSeatIds.length) {
            return NextResponse.json(
                { success: false, message: "One or more selected seats are invalid." },
                { status: 400 }
            );
        }

        const invalidSeat = selectedSeats.find((seat: SelectedSeat) => {
            const allowedTypes = seat.allowed_code_types || [];

            return (
                seat.event_id !== bookingCode.event_id ||
                seat.status !== "available" ||
                seat.is_bookable === false ||
                !allowedTypes.includes(bookingCode.code_type)
            );
        });

        if (invalidSeat) {
            return NextResponse.json(
                { success: false, message: "One or more selected seats are not available." },
                { status: 400 }
            );
        }

        const selectedPaidSectionCount = selectedSeats.filter(isPaidFamilySeat).length;

        if (selectedPaidSectionCount < paidGuestSeatCount) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Extra guest seats must be selected from the paid/family seating section.",
                },
                { status: 400 }
            );
        }

        if (paidGuestSeatCount <= 0) {
            return NextResponse.json({
                success: true,
                paymentRequired: false,
                includedSeatsRemaining: includedRemaining,
            });
        }

        const guestSeatPricePaise = Number(bookingCode.guest_seat_price_paise || 0);
        const amountPaise = paidGuestSeatCount * guestSeatPricePaise;

        if (amountPaise <= 0) {
            return NextResponse.json(
                { success: false, message: "Guest seat price is not configured." },
                { status: 400 }
            );
        }

        const razorpayOrder = await razorpay.orders.create({
            amount: amountPaise,
            currency: "INR",
            receipt: `booking_${code}_${Date.now()}`.slice(0, 40),
            notes: {
                booking_code: code,
                paid_guest_seat_count: String(paidGuestSeatCount),
            },
        });

        const { error: insertError } = await supabaseAdmin
            .from("payment_orders")
            .insert({
                booking_code: code,
                seat_ids: uniqueSeatIds,
                included_seat_count: Math.min(uniqueSeatIds.length, includedRemaining),
                paid_guest_seat_count: paidGuestSeatCount,
                amount_paise: amountPaise,
                currency: "INR",
                razorpay_order_id: razorpayOrder.id,
                status: "created",
            });

        if (insertError) {
            console.error("Payment order insert error:", insertError);

            return NextResponse.json(
                { success: false, message: "Could not save payment order." },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            paymentRequired: true,
            orderId: razorpayOrder.id,
            amount: amountPaise,
            currency: "INR",
            keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
            paidGuestSeatCount,
            guestSeatPriceRupees: guestSeatPricePaise / 100,
        });
    } catch (error: any) {
        console.error("Create payment order error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Could not create payment order.",
                debug:
                    process.env.NODE_ENV === "development"
                        ? error?.message || String(error)
                        : undefined,
            },
            { status: 500 }
        );
    }
}
