import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import TheatreSeatSelection from "@/components/TheatreSeatSelection";

type PageProps = {
    params: Promise<{
        code: string;
    }>;
};

export default async function BookPage({ params }: PageProps) {
    const { code } = await params;

    const decodedCode = decodeURIComponent(code).trim().toUpperCase();

    const { data: bookingCode, error: bookingCodeError } = await supabaseAdmin
        .from("booking_codes")
        .select("*")
        .eq("code", decodedCode)
        .single();

    if (bookingCodeError || !bookingCode) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
                <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow">
                    <h1 className="text-2xl font-bold text-red-600">
                        Invalid booking code
                    </h1>

                    <p className="mt-3 text-gray-600">
                        This booking code could not be found.
                    </p>

                    <Link
                        href="/"
                        className="mt-6 inline-block rounded-lg bg-black px-4 py-3 font-semibold text-white"
                    >
                        Try Again
                    </Link>
                </div>
            </main>
        );
    }

    if (bookingCode.status === "booked") {
        return (
            <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
                <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow">
                    <h1 className="text-2xl font-bold text-red-600">
                        Code already used
                    </h1>

                    <p className="mt-3 text-gray-600">
                        This booking code has already been used.
                    </p>

                    <Link
                        href="/"
                        className="mt-6 inline-block rounded-lg bg-black px-4 py-3 font-semibold text-white"
                    >
                        Go Back
                    </Link>
                </div>
            </main>
        );
    }

    if (bookingCode.status === "cancelled") {
        return (
            <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
                <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow">
                    <h1 className="text-2xl font-bold text-red-600">
                        Code cancelled
                    </h1>

                    <p className="mt-3 text-gray-600">
                        This booking code has been cancelled by the school.
                    </p>

                    <Link
                        href="/"
                        className="mt-6 inline-block rounded-lg bg-black px-4 py-3 font-semibold text-white"
                    >
                        Go Back
                    </Link>
                </div>
            </main>
        );
    }

    const remainingSeats = bookingCode.max_seats - bookingCode.used_seats;

    if (remainingSeats <= 0) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
                <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow">
                    <h1 className="text-2xl font-bold text-red-600">
                        No seats remaining
                    </h1>

                    <p className="mt-3 text-gray-600">
                        This booking code has no seats remaining.
                    </p>

                    <Link
                        href="/"
                        className="mt-6 inline-block rounded-lg bg-black px-4 py-3 font-semibold text-white"
                    >
                        Go Back
                    </Link>
                </div>
            </main>
        );
    }

    const { data: event, error: eventError } = await supabaseAdmin
        .from("events")
        .select("*")
        .eq("id", bookingCode.event_id)
        .single();

    if (eventError || !event) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
                <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow">
                    <h1 className="text-2xl font-bold text-red-600">
                        Event not found
                    </h1>

                    <p className="mt-3 text-gray-600">
                        This booking code is not linked to a valid event.
                    </p>

                    <Link
                        href="/"
                        className="mt-6 inline-block rounded-lg bg-black px-4 py-3 font-semibold text-white"
                    >
                        Go Back
                    </Link>
                </div>
            </main>
        );
    }

    const { data: seats, error: seatsError } = await fetchAllSeatsForEvent(event.id);
    console.log("Total seats loaded:", seats?.length);
    console.log("Ground seats loaded:", seats?.filter((s) => s.floor_name === "ground").length);
    console.log("Balcony seats loaded:", seats?.filter((s) => s.floor_name === "balcony").length);
    console.log(
        "Ground K seats:",
        seats
            ?.filter((s) => s.floor_name === "ground" && s.row_name === "K")
            .map((s) => s.display_label || s.seat_label)
    );

    if (seatsError || !seats) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
                <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow">
                    <h1 className="text-2xl font-bold text-red-600">
                        Could not load seats
                    </h1>

                    <p className="mt-3 text-gray-600">
                        Please try again later.
                    </p>

                    <Link
                        href="/"
                        className="mt-6 inline-block rounded-lg bg-black px-4 py-3 font-semibold text-white"
                    >
                        Go Back
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <TheatreSeatSelection
            bookingCode={bookingCode}
            event={event}
            seats={seats}
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