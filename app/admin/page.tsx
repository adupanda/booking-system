import Link from "next/link";
import AdminLogoutButton from "@/components/AdminLogoutButton";
export default function AdminHomePage() {
    return (
        <main className="min-h-screen bg-gray-50 p-6">
            <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow">
                <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
                

                <p className="mt-2 text-gray-600">
                    Manage and monitor event bookings.
                </p>

                <AdminLogoutButton />

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    <Link
                        href="/admin/bookings"
                        className="rounded-xl border border-gray-200 p-6 transition hover:bg-gray-50"
                    >
                        <h2 className="text-xl font-bold text-gray-900">Bookings</h2>
                        <p className="mt-2 text-gray-600">
                            View ticket IDs, selected seats, and entry status.
                        </p>
                    </Link>

                    <Link
                        href="/admin/seats"
                        className="rounded-xl border border-gray-200 p-6 transition hover:bg-gray-50"
                    >
                        <h2 className="text-xl font-bold text-gray-900">Seats</h2>
                        <p className="mt-2 text-gray-600">
                            View available, booked, and blocked seats.
                        </p>
                    </Link>

                    <Link
                        href="/admin/codes"
                        className="rounded-xl border border-gray-200 p-6 transition hover:bg-gray-50"
                    >
                        <h2 className="text-xl font-bold text-gray-900">Booking Codes</h2>
                        <p className="mt-2 text-gray-600">
                            View regular, paid, VIP, used, and unused codes.
                        </p>
                    </Link>

                    <Link
                        href="/"
                        className="rounded-xl border border-gray-200 p-6 transition hover:bg-gray-50"
                    >
                        <h2 className="text-xl font-bold text-gray-900">Parent Page</h2>
                        <p className="mt-2 text-gray-600">
                            Open the public booking code entry page.
                        </p>
                    </Link>



                    <Link
                        href="/admin/payments"
                        className="rounded-xl border border-purple-200 bg-purple-50 p-6 transition hover:bg-purple-100"
                    >
                        <h2 className="text-xl font-bold text-purple-950">Pending Payments</h2>
                        <p className="mt-2 text-purple-800">
                            Confirm QR/UPI payments and generate tickets.
                        </p>
                    </Link>

                    <Link
                        href="/admin/seat-map"
                        className="rounded-xl border border-gray-200 p-6 transition hover:bg-gray-50"
                    >
                        <h2 className="text-xl font-bold text-gray-900">Visual Seat Map</h2>
                        <p className="mt-2 text-gray-600">
                            See the auditorium layout with booked and available seats.
                        </p>
                    </Link>
                </div>
            </div>
        </main>
    );
}