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
    const paymentNote = String(formData.get("paymentNote") || "").trim();

    if (!paymentOrderId) {
        return NextResponse.json({ success: false, message: "Payment order missing." }, { status: 400 });
    }

    const { data: paymentOrder } = await supabaseAdmin
        .from("payment_orders")
        .select("hold_id, status")
        .eq("id", paymentOrderId)
        .maybeSingle();

    if (paymentOrder?.hold_id && paymentOrder.status === "pending_payment") {
        await supabaseAdmin.rpc("release_seat_hold", { p_hold_id: paymentOrder.hold_id });

        await supabaseAdmin
            .from("payment_orders")
            .update({
                status: "rejected",
                admin_payment_note: paymentNote || null,
                rejected_at: new Date().toISOString(),
            })
            .eq("id", paymentOrderId);
    }

    redirect("/admin/payments?rejected=true");
}
