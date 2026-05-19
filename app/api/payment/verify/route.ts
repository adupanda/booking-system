import { NextResponse } from "next/server";

export async function POST() {
    return NextResponse.json(
        {
            success: false,
            message: "Razorpay verification is disabled. This project is using manual QR/UPI payment confirmation.",
        },
        { status: 410 }
    );
}
