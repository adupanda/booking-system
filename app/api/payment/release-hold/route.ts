import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const paymentOrderId = String(body.paymentOrderId || body.orderId || "");

        if (!paymentOrderId) {
            return NextResponse.json({ success: true });
        }

        const { data: paymentOrder } = await supabaseAdmin
            .from("payment_orders")
            .select("hold_id, status")
            .eq("id", paymentOrderId)
            .maybeSingle();

        if (paymentOrder?.hold_id && paymentOrder.status === "pending_payment") {
            await supabaseAdmin.rpc("release_seat_hold", {
                p_hold_id: paymentOrder.hold_id,
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Release hold error:", error);
        return NextResponse.json({ success: true });
    }
}
