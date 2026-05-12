"use client";

import { useRouter } from "next/navigation";

export default function AdminLogoutButton() {
    const router = useRouter();

    async function handleLogout() {
        await fetch("/api/admin-logout", {
            method: "POST",
        });

        router.push("/admin-login");
        router.refresh();
    }

    return (
        <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg bg-red-600 px-4 py-3 font-semibold text-white"
        >
            Logout
        </button>
    );
}