import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import TheatreSeatSelection from "@/components/TheatreSeatSelection";

type PageProps = {
    params: Promise<{
        code: string;
    }>;
};

function ErrorCard({
    title,
    message,
    href = "/",
    buttonText = "Go Back",
}: {
    title: string;
    message: string;
    href?: string;
    buttonText?: string;
}) {
    return (
        <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
            <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow">
                <h1 className="text-2xl font-bold text-red-600">{title}</h1>

                <p className="mt-3 text-gray-600">{message}</p>

                <Link
                    href={href}
                    className="mt-6 inline-block rounded-lg bg-black px-4 py-3 font-semibold text-white"
                >
                    {buttonText}
                </Link>
            </div>
        </main>
    );
}

export default async function BookPage({ params }: PageProps) {
    await supabaseAdmin.rpc("release_expired_seat_holds");

    const { code } = await params;

    const decodedCode = decodeURIComponent(code).trim().toUpperCase();

    const { data: bookingCode, error: bookingCodeError } = await supabaseAdmin
        .from("booking_codes")
        .select("*")
        .eq("code", decodedCode)
        .single();

    if (bookingCodeError || !bookingCode) {
        return (
            <ErrorCard
                title="Invalid booking code"
                message="This booking code could not be found."
                buttonText="Try Again"
            />
        );
    }

    if (bookingCode.status === "cancelled") {
        return (
            <ErrorCard
                title="Code cancelled"
                message="This booking code has been cancelled by the school."
            />
        );
    }

    if (bookingCode.status === "booked" && !bookingCode.allow_paid_extra_seats) {
        return (
            <ErrorCard
                title="Code already used"
                message="This booking code has already been used."
            />
        );
    }

    const { data: event, error: eventError } = await supabaseAdmin
        .from("events")
        .select("*")
        .eq("id", bookingCode.event_id)
        .single();

    if (eventError || !event) {
        return (
            <ErrorCard
                title="Event not found"
                message="This booking code is not linked to a valid event."
            />
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

    const { data: seats, error: seatsError } = await fetchAllSeatsForEvent(event.id);

    if (seatsError || !seats) {
        return (
            <ErrorCard
                title="Could not load seats"
                message="Please try again later."
            />
        );
    }

    return (
        <TheatreSeatSelection
            bookingCode={bookingCode}
            event={event}
            seats={seats}
            existingTicketId={existingBooking?.ticket_id || null}
        />
    );
}

async function fetchAllSeatsForEvent(eventId: string) {
    const pageSize = 1000;
    let from = 0;
    const allSeats: any[] = [];

    while (true) {
        const { data, error } = await supabaseAdmin
            .from("seats")
            .select("*")
            .eq("event_id", eventId)
            .order("floor_name", { ascending: true })
            .order("block_order", { ascending: true })
            .order("row_order", { ascending: true })
            .order("seat_number", { ascending: true })
            .range(from, from + pageSize - 1);

        if (error) {
            return { data: null, error };
        }

        if (!data || data.length === 0) {
            break;
        }

        allSeats.push(...data);

        if (data.length < pageSize) {
            break;
        }

        from += pageSize;
    }

    return { data: allSeats, error: null };
}
