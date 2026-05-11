import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import SeatSelection from "@/components/SeatSelection";

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

    const { data: seats, error: seatsError } = await supabaseAdmin
        .from("seats")
        .select("*")
        .eq("event_id", bookingCode.event_id)
        .order("row_name", { ascending: true })
        .order("seat_number", { ascending: true });

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
        <SeatSelection
            bookingCode={bookingCode}
            event={event}
            seats={seats}
        />
    );
}