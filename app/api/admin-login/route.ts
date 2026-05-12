import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const password = String(body.password || "");

        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminPassword) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Admin password is not configured on the server.",
                },
                { status: 500 }
            );
        }

        if (password !== adminPassword) {
            return NextResponse.json(
                { success: false, message: "Invalid admin password." },
                { status: 401 }
            );
        }

        const response = NextResponse.json({ success: true });

        response.cookies.set("admin_auth", "true", {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 60 * 60 * 8,
        });

        return response;
    } catch (error) {
        console.error("Admin login error:", error);

        return NextResponse.json(
            { success: false, message: "Something went wrong." },
            { status: 500 }
        );
    }
}