import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
    const cookieStore = await cookies();
    const isAdminLoggedIn = cookieStore.get("admin_auth")?.value === "true";

    if (!isAdminLoggedIn) {
        return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const formData = await request.formData();
    const paymentOrderId = String(formData.get("paymentOrderId") || "").trim();
    const paymentReference = String(formData.get("paymentReference") || "").trim();
    const paymentNote = String(formData.get("paymentNote") || "").trim();

    if (!paymentOrderId) {
        return NextResponse.json({ success: false, message: "Payment order missing." }, { status: 400 });
    }

    const { data: paymentOrder, error: paymentOrderError } = await supabaseAdmin
        .from("payment_orders")
        .select("*")
        .eq("id", paymentOrderId)
        .eq("status", "pending_payment")
        .single();

    if (paymentOrderError || !paymentOrder) {
        return NextResponse.json(
            { success: false, message: "Payment request not found or already handled." },
            { status: 400 }
        );
    }

    if (paymentOrder.hold_expires_at && new Date(paymentOrder.hold_expires_at).getTime() < Date.now()) {
        await supabaseAdmin.rpc("release_expired_seat_holds");
        return NextResponse.json(
            { success: false, message: "This payment hold has expired. Ask the parent to book again." },
            { status: 400 }
        );
    }

    const { error: updateError } = await supabaseAdmin
        .from("payment_orders")
        .update({
            status: "payment_confirmed",
            admin_payment_reference: paymentReference || null,
            admin_payment_note: paymentNote || null,
            confirmed_by: "admin",
            confirmed_at: new Date().toISOString(),
            paid_at: new Date().toISOString(),
        })
        .eq("id", paymentOrderId)
        .eq("status", "pending_payment");

    if (updateError) {
        console.error("Payment confirm update error:", updateError);
        return NextResponse.json({ success: false, message: "Could not confirm payment." }, { status: 500 });
    }

    const { data: bookingData, error: bookingError } = await supabaseAdmin.rpc("confirm_seat_booking", {
        p_code: paymentOrder.booking_code,
        p_seat_ids: paymentOrder.seat_ids,
        p_payment_order_id: paymentOrderId,
    });

    if (bookingError) {
        console.error("Manual payment booking error:", bookingError);

        await supabaseAdmin
            .from("payment_orders")
            .update({ status: "payment_confirmed_booking_failed" })
            .eq("id", paymentOrderId);

        return NextResponse.json(
            {
                success: false,
                message: bookingError.message || "Payment confirmed, but booking could not be completed.",
            },
            { status: 500 }
        );
    }

    const ticketId = bookingData?.[0]?.ticket_id;

    if (!ticketId) {
        await supabaseAdmin
            .from("payment_orders")
            .update({ status: "payment_confirmed_booking_failed" })
            .eq("id", paymentOrderId);

        return NextResponse.json(
            { success: false, message: "Payment confirmed, but ticket could not be generated." },
            { status: 500 }
        );
    }

    redirect(`/admin/payments?confirmed=${encodeURIComponent(ticketId)}`);
}
