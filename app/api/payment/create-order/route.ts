import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type SelectedSeat = {
    id: string;
    event_id: string;
    status: string;
    is_bookable: boolean | null;
    seat_category: string | null;
    allowed_code_types: string[] | null;
};

function isPaidFamilySeat(seat: SelectedSeat) {
    const category = String(seat.seat_category || "").trim().toLowerCase();
    return category === "paid" || category === "family_paid";
}

export async function POST(request: Request) {
    let createdHoldId: string | null = null;

    try {
        await supabaseAdmin.rpc("release_expired_seat_holds");

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

        const rawIncludedLimit = Number(bookingCode.included_seat_limit ?? 2);
        const includedLimit = bookingCode.code_type === "paid" ? 0 : rawIncludedLimit;
        const includedRemaining = Math.max(includedLimit - usedIncludedCount, 0);

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
            const message =
                invalidSeat.status === "blocked"
                    ? "One or more selected seats are currently blocked by another booking. Please refresh and choose another seat."
                    : invalidSeat.status !== "available"
                      ? "One or more selected seats are no longer available. Please refresh and choose another seat."
                      : "One or more selected seats are not available.";

            return NextResponse.json({ success: false, message }, { status: 400 });
        }

        const selectedPaidSectionCount = selectedSeats.filter(isPaidFamilySeat).length;
        const selectedNonPaidSectionCount = selectedSeats.length - selectedPaidSectionCount;
        const paidGuestSeatCount = selectedPaidSectionCount;

        if (selectedNonPaidSectionCount > includedRemaining) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Extra guest seats must be selected from the paid/family seating section.",
                },
                { status: 400 }
            );
        }

        if (paidGuestSeatCount > 0 && !bookingCode.allow_paid_extra_seats) {
            return NextResponse.json(
                { success: false, message: "This code does not allow paid seats." },
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
                    message: "You have reached the maximum number of paid seats allowed for this code.",
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
        const expectedAmountPaise = paidGuestSeatCount * guestSeatPricePaise;

        if (expectedAmountPaise <= 0) {
            return NextResponse.json(
                { success: false, message: "Guest seat price is not configured." },
                { status: 400 }
            );
        }

        createdHoldId = crypto.randomUUID();
        const holdExpiresAt = new Date(Date.now() + 40 * 60 * 1000).toISOString();

        const { data: holdData, error: holdError } = await supabaseAdmin.rpc("hold_seats_for_payment", {
            p_code: code,
            p_seat_ids: uniqueSeatIds,
            p_hold_id: createdHoldId,
            p_hold_expires_at: holdExpiresAt,
        });

        if (holdError) {
            console.error("Seat hold error:", holdError);
            const rawMessage = String(holdError.message || "");
            const lowerMessage = rawMessage.toLowerCase();
            const message =
                lowerMessage.includes("blocked") ||
                lowerMessage.includes("not available") ||
                lowerMessage.includes("already")
                    ? "One or more selected seats are currently blocked by another booking. Please refresh and choose another seat."
                    : rawMessage || "Could not reserve selected seats.";

            return NextResponse.json({ success: false, message }, { status: 400 });
        }

        const holdResult = holdData?.[0];

        if (!holdResult) {
            await supabaseAdmin.rpc("release_seat_hold", { p_hold_id: createdHoldId });
            return NextResponse.json(
                { success: false, message: "Could not calculate payment for selected seats." },
                { status: 400 }
            );
        }

        const { data: paymentOrder, error: insertError } = await supabaseAdmin
            .from("payment_orders")
            .insert({
                booking_code: code,
                seat_ids: uniqueSeatIds,
                included_seat_count: selectedNonPaidSectionCount,
                paid_guest_seat_count: paidGuestSeatCount,
                amount_paise: expectedAmountPaise,
                currency: "INR",
                hold_id: createdHoldId,
                hold_expires_at: holdExpiresAt,
                status: "pending_payment",
            })
            .select("id")
            .single();

        if (insertError || !paymentOrder) {
            console.error("Payment order insert error:", insertError);
            await supabaseAdmin.rpc("release_seat_hold", { p_hold_id: createdHoldId });

            return NextResponse.json(
                { success: false, message: "Could not save payment request." },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            paymentRequired: true,
            manualPaymentRequired: true,
            paymentOrderId: paymentOrder.id,
            amount: expectedAmountPaise,
            amountRupees: expectedAmountPaise / 100,
            currency: "INR",
            paidGuestSeatCount,
            guestSeatPriceRupees: guestSeatPricePaise / 100,
            holdExpiresAt,
            upiId: process.env.UPI_ID || "",
            upiPayeeName: process.env.UPI_PAYEE_NAME || "School Payment",
            upiQrImageUrl: process.env.UPI_QR_IMAGE_URL || "",
            razorpayPaymentLinkUrl: process.env.RAZORPAY_PAYMENT_LINK_URL || "",
        });
    } catch (error: any) {
        console.error("Create manual payment request error:", error);

        if (createdHoldId) {
            await supabaseAdmin.rpc("release_seat_hold", { p_hold_id: createdHoldId });
        }

        return NextResponse.json(
            {
                success: false,
                message: "Could not create payment request.",
                debug:
                    process.env.NODE_ENV === "development"
                        ? error?.message || String(error)
                        : undefined,
            },
            { status: 500 }
        );
    }
}
