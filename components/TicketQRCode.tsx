"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type TicketQrCodeProps = {
    ticketId: string;
};

export default function TicketQrCode({ ticketId }: TicketQrCodeProps) {
    const [qrDataUrl, setQrDataUrl] = useState("");

    useEffect(() => {
        async function generateQr() {
            const origin = window.location.origin;
            const verifyUrl = `${origin}/verify/${encodeURIComponent(ticketId)}`;

            const dataUrl = await QRCode.toDataURL(verifyUrl, {
                width: 260,
                margin: 2,
            });

            setQrDataUrl(dataUrl);
        }

        generateQr();
    }, [ticketId]);

    if (!qrDataUrl) {
        return (
            <div className="flex h-[260px] w-[260px] items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-500">
                Generating QR...
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center">
            <img
                src={qrDataUrl}
                alt={`QR Code for ticket ${ticketId}`}
                className="h-[260px] w-[260px]"
            />

            <p className="mt-2 text-center text-xs text-gray-500">
                Scan this QR at entry
            </p>
        </div>
    );
}