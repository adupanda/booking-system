import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
    try {
        await supabaseAdmin.rpc("release_expired_seat_holds");

        const body = await request.json();
        const paymentOrderId = String(body.paymentOrderId || "").trim();
        const paymentReference = String(body.paymentReference || body.paymentNote || "").trim();

        if (!paymentOrderId) {
            return NextResponse.json(
                { success: false, message: "Payment request is missing." },
                { status: 400 }
            );
        }

        if (!paymentReference) {
            return NextResponse.json(
                { success: false, message: "Please enter the transaction / UTR / Razorpay payment ID." },
                { status: 400 }
            );
        }

        if (paymentReference.length < 4) {
            return NextResponse.json(
                { success: false, message: "Please enter a valid transaction reference." },
                { status: 400 }
            );
        }

        const { data: paymentOrder, error: orderError } = await supabaseAdmin
            .from("payment_orders")
            .select("id, status, hold_expires_at")
            .eq("id", paymentOrderId)
            .maybeSingle();

        if (orderError || !paymentOrder) {
            return NextResponse.json(
                { success: false, message: "Payment request not found." },
                { status: 404 }
            );
        }

        if (paymentOrder.status !== "pending_payment") {
            return NextResponse.json({
                success: true,
                message: "This payment request has already been handled.",
            });
        }

        if (
            paymentOrder.hold_expires_at &&
            new Date(paymentOrder.hold_expires_at).getTime() < Date.now()
        ) {
            await supabaseAdmin.rpc("release_expired_seat_holds");

            return NextResponse.json(
                {
                    success: false,
                    message: "This seat hold has expired. Please select seats again.",
                },
                { status: 400 }
            );
        }

        const { error: updateError } = await supabaseAdmin
            .from("payment_orders")
            .update({
                customer_reported_paid_at: new Date().toISOString(),
                customer_payment_note: paymentReference,
            })
            .eq("id", paymentOrderId)
            .eq("status", "pending_payment");

        if (updateError) {
            console.error("Report paid update error:", updateError);
            return NextResponse.json(
                { success: false, message: "Could not mark payment as reported." },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Payment reported. The school team will confirm it shortly.",
        });
    } catch (error) {
        console.error("Report paid error:", error);
        return NextResponse.json(
            { success: false, message: "Could not report payment." },
            { status: 500 }
        );
    }
}
