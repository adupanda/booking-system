import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const razorpayOrderId = String(body.razorpay_order_id || "");
        const razorpayPaymentId = String(body.razorpay_payment_id || "");
        const razorpaySignature = String(body.razorpay_signature || "");

        if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
            return NextResponse.json(
                { success: false, message: "Missing payment verification details." },
                { status: 400 }
            );
        }

        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
            .update(`${razorpayOrderId}|${razorpayPaymentId}`)
            .digest("hex");

        if (expectedSignature !== razorpaySignature) {
            return NextResponse.json(
                { success: false, message: "Payment verification failed." },
                { status: 400 }
            );
        }

        const { data: paymentOrder, error: paymentOrderError } = await supabaseAdmin
            .from("payment_orders")
            .select("*")
            .eq("razorpay_order_id", razorpayOrderId)
            .eq("status", "created")
            .single();

        if (paymentOrderError || !paymentOrder) {
            return NextResponse.json(
                { success: false, message: "Payment order not found or already used." },
                { status: 400 }
            );
        }

        const { error: verifyUpdateError } = await supabaseAdmin
            .from("payment_orders")
            .update({
                status: "verified",
                razorpay_payment_id: razorpayPaymentId,
                razorpay_signature: razorpaySignature,
                paid_at: new Date().toISOString(),
            })
            .eq("razorpay_order_id", razorpayOrderId)
            .eq("status", "created");

        if (verifyUpdateError) {
            console.error("Payment verify update error:", verifyUpdateError);
            return NextResponse.json(
                { success: false, message: "Could not update verified payment." },
                { status: 500 }
            );
        }

        const { data: bookingData, error: bookingError } = await supabaseAdmin.rpc(
            "confirm_seat_booking",
            {
                p_code: paymentOrder.booking_code,
                p_seat_ids: paymentOrder.seat_ids,
                p_payment_order_id: razorpayOrderId,
            }
        );

        if (bookingError) {
            console.error("Booking after payment error:", bookingError);

            await supabaseAdmin
                .from("payment_orders")
                .update({ status: "paid_booking_failed", ticket_id: null })
                .eq("razorpay_order_id", razorpayOrderId);

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Payment succeeded, but booking could not be completed. Please contact the school team immediately.",
                },
                { status: 500 }
            );
        }

        const bookingResult = bookingData?.[0];

        if (!bookingResult?.ticket_id) {
            await supabaseAdmin
                .from("payment_orders")
                .update({ status: "paid_booking_failed" })
                .eq("razorpay_order_id", razorpayOrderId);

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Payment succeeded, but ticket generation failed. Please contact the school team immediately.",
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            ticketId: bookingResult.ticket_id,
        });
    } catch (error) {
        console.error("Verify payment error:", error);

        return NextResponse.json(
            { success: false, message: "Could not verify payment." },
            { status: 500 }
        );
    }
}
