"use client";

type TicketActionsProps = {
    ticketId: string;
};

export default function TicketActions({ ticketId }: TicketActionsProps) {
    async function handleShare() {
        const shareData = {
            title: "Event Ticket",
            text: `My event ticket ID is ${ticketId}`,
            url: window.location.href,
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (error) {
                console.error("Share cancelled or failed:", error);
            }
        } else {
            await navigator.clipboard.writeText(window.location.href);
            alert("Ticket link copied to clipboard.");
        }
    }

    return (
        <div className="mt-6 flex flex-col gap-3 print:hidden sm:flex-row">
            <a
                href={`/api/ticket-pdf/${encodeURIComponent(ticketId)}`}
                className="w-full rounded-lg bg-black px-4 py-3 text-center font-semibold text-white"
            >
                Download Ticket PDF
            </a>

            <button
                type="button"
                onClick={handleShare}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-semibold text-gray-900"
            >
                Share Ticket Link
            </button>
        </div>
    );
}