"use client";

import { useRef, useState } from "react";

type Seat = {
    id: string;
    seat_label: string;
    display_label: string | null;
    row_name: string | null;
    seat_number: number | null;
    section: string | null;
    status: string;
    layout_x: number | null;
    layout_y: number | null;
    rotation_deg: number | null;
    floor_name: string | null;
    seat_category: string | null;
    allowed_code_types: string[] | null;
    block_name: string | null;
    block_order: number | null;
    row_order: number | null;
    is_bookable: boolean | null;
};

type BookingInfo = {
    seat_id: string;
    ticket_id: string | null;
    learner_name: string | null;
    parent_name: string | null;
    booking_code: string | null;
};

type TheatreSeatMapProps = {
    seats: Seat[];
    bookingInfo?: BookingInfo[];
    mode: "admin" | "booking";
    selectedSeatIds?: string[];
    maxSelectable?: number;
    codeType?: string;
    onSeatClick?: (seat: Seat) => void;
};

type FloorKey = "ground" | "balcony" | "other";

type ViewportState = {
    scrollLeft: number;
    scrollTop: number;
    clientWidth: number;
    clientHeight: number;
    scrollWidth: number;
    scrollHeight: number;
};

const SEAT_SIZE = 20;
const SEAT_PADDING = 60;
const FLOOR_MIN_WIDTH = 920;
const FLOOR_EXTRA_BOTTOM_SPACE = 260;

function getCategory(seat: Seat) {
    return String(seat.seat_category || "").trim().toLowerCase();
}

function isPaidFamilySeat(seat: Seat) {
    const category = getCategory(seat);
    return category === "paid" || category === "family_paid";
}

function getFloorKey(floorName: string | null): FloorKey {
    const value = (floorName || "").toLowerCase();

    if (value.includes("ground")) return "ground";
    if (value.includes("balcony") || value.includes("first")) return "balcony";

    return "other";
}

function getFloorTitle(floorKey: FloorKey) {
    if (floorKey === "ground") return "GROUND FLOOR";
    if (floorKey === "balcony") return "BALCONY";
    return "OTHER SEATING";
}

function sortSeats(a: Seat, b: Seat) {
    return (
        (a.block_order ?? 999) - (b.block_order ?? 999) ||
        (a.row_order ?? 999) - (b.row_order ?? 999) ||
        (a.seat_number ?? 999) - (b.seat_number ?? 999)
    );
}

function getSeatText(seat: Seat) {
    return seat.display_label || seat.seat_number || seat.seat_label;
}

function MiniMap({
    floorKey,
    floorSeats,
    selectedSeatIds,
    minX,
    minY,
    mapWidth,
    mapHeight,
    viewport,
}: {
    floorKey: FloorKey;
    floorSeats: Seat[];
    selectedSeatIds: string[];
    minX: number;
    minY: number;
    mapWidth: number;
    mapHeight: number;
    viewport?: ViewportState;
}) {
    const miniWidth = 150;
    const scale = miniWidth / mapWidth;
    const miniHeight = Math.max(70, Math.round(mapHeight * scale));

    const currentViewport = viewport || {
        scrollLeft: 0,
        scrollTop: 0,
        clientWidth: Math.min(mapWidth, 360),
        clientHeight: Math.min(mapHeight, 500),
        scrollWidth: mapWidth,
        scrollHeight: mapHeight,
    };

    const viewportLeft = currentViewport.scrollLeft * scale;
    const viewportTop = currentViewport.scrollTop * scale;
    const viewportWidth = Math.max(
        14,
        Math.min(currentViewport.clientWidth, currentViewport.scrollWidth) * scale
    );
    const viewportHeight = Math.max(
        14,
        Math.min(currentViewport.clientHeight, currentViewport.scrollHeight) * scale
    );

    function getMiniSeatClass(seat: Seat) {
        const category = getCategory(seat);

        if (selectedSeatIds.includes(seat.id)) return "bg-blue-600";
        if (seat.status === "booked") return "bg-gray-400";
        if (seat.status === "held") return "bg-amber-400";
        if (seat.status === "blocked" || !seat.is_bookable) return "bg-gray-900";
        if (category === "vip") return "bg-yellow-400";
        if (isPaidFamilySeat(seat)) return "bg-purple-400";

        return "bg-sky-300";
    }

    return (
        <div
            className="pointer-events-none absolute right-3 top-3 z-40 rounded-xl border border-gray-300 bg-white/95 p-2 shadow-lg"
            style={{ width: miniWidth + 18 }}
        >
            <p className="mb-1 text-center text-[10px] font-bold text-gray-700">MAP VIEW</p>

            <div
                className="relative overflow-hidden rounded-md border border-gray-200 bg-gray-50"
                style={{ width: miniWidth, height: miniHeight }}
            >
                {floorKey === "ground" && (
                    <div
                        className="absolute flex items-center justify-center rounded-sm border border-gray-400 bg-gray-200 text-[6px] font-bold text-gray-700"
                        style={{
                            left: (mapWidth / 2 - 190) * scale,
                            top: (mapHeight - 85) * scale,
                            width: 380 * scale,
                            height: 58 * scale,
                        }}
                    >
                        STAGE
                    </div>
                )}

                {floorKey === "balcony" && (
                    <div
                        className="absolute flex items-center justify-center rounded-sm border border-gray-300 bg-gray-200 text-[5px] font-bold text-gray-600"
                        style={{
                            left: (mapWidth / 2 - 95) * scale,
                            top: (mapHeight - 50) * scale,
                            width: 190 * scale,
                            height: 32 * scale,
                        }}
                    >
                        FRONT
                    </div>
                )}

                {floorSeats.map((seat) => {
                    const left = ((seat.layout_x as number) - minX + SEAT_PADDING) * scale;
                    const top = ((seat.layout_y as number) - minY + SEAT_PADDING) * scale;

                    return (
                        <span
                            key={seat.id}
                            className={`absolute rounded-[1px] ${getMiniSeatClass(seat)}`}
                            style={{
                                left,
                                top,
                                width: Math.max(2, SEAT_SIZE * scale),
                                height: Math.max(2, SEAT_SIZE * scale),
                            }}
                        />
                    );
                })}

                <div
                    className="absolute rounded border-2 border-red-600 bg-red-500/10"
                    style={{
                        left: viewportLeft,
                        top: viewportTop,
                        width: viewportWidth,
                        height: viewportHeight,
                    }}
                />
            </div>
        </div>
    );
}

export default function TheatreSeatMap({
    seats,
    bookingInfo = [],
    mode,
    selectedSeatIds = [],
    maxSelectable = 0,
    codeType,
    onSeatClick,
}: TheatreSeatMapProps) {
    const scrollContainerRefs = useRef<Partial<Record<FloorKey, HTMLDivElement | null>>>({});
    const [viewportByFloor, setViewportByFloor] = useState<Partial<Record<FloorKey, ViewportState>>>({});

    const bookingBySeatId = new Map<string, BookingInfo>();
    for (const info of bookingInfo) bookingBySeatId.set(info.seat_id, info);

    const positionedSeats = seats
        .filter((seat) => seat.layout_x !== null && seat.layout_y !== null)
        .sort(sortSeats);

    const seatsByFloor = positionedSeats.reduce<Record<FloorKey, Seat[]>>(
        (groups, seat) => {
            const floorKey = getFloorKey(seat.floor_name);
            groups[floorKey].push(seat);
            return groups;
        },
        { ground: [], balcony: [], other: [] }
    );

    const floorOrder: FloorKey[] = ["balcony", "ground", "other"];
    const visibleFloors = floorOrder.filter((floorKey) => seatsByFloor[floorKey]?.length > 0);

    function updateViewport(floorKey: FloorKey, element: HTMLDivElement) {
        const nextViewport: ViewportState = {
            scrollLeft: element.scrollLeft,
            scrollTop: element.scrollTop,
            clientWidth: element.clientWidth,
            clientHeight: element.clientHeight,
            scrollWidth: element.scrollWidth,
            scrollHeight: element.scrollHeight,
        };

        setViewportByFloor((current) => ({ ...current, [floorKey]: nextViewport }));
    }

    function setScrollContainer(floorKey: FloorKey, element: HTMLDivElement | null) {
        scrollContainerRefs.current[floorKey] = element;
    }

    function isAllowedForCode(seat: Seat) {
        if (mode === "admin") return true;
        if (!seat.is_bookable) return false;
        if (!codeType) return true;
        if (!seat.allowed_code_types || seat.allowed_code_types.length === 0) return false;
        return seat.allowed_code_types.includes(codeType);
    }

    function isClickable(seat: Seat) {
        if (mode !== "booking") return false;
        if (seat.status !== "available") return false;
        if (!isAllowedForCode(seat)) return false;
        return true;
    }

    function getSeatClass(seat: Seat) {
        const isSelected = selectedSeatIds.includes(seat.id);
        const category = getCategory(seat);

        if (isSelected) return "z-10 border-blue-700 bg-blue-600 text-white shadow";
        if (seat.status === "booked") return "border-gray-300 bg-gray-300 text-gray-500";
        if (seat.status === "held") return "border-amber-400 bg-amber-100 text-amber-800";
        if (seat.status === "blocked" || !seat.is_bookable) return "border-gray-900 bg-gray-900 text-white";

        if (mode === "booking" && !isAllowedForCode(seat)) {
            return "border-red-200 bg-red-50 text-red-300";
        }

        if (category === "vip") return "border-yellow-300 bg-yellow-50 text-yellow-800";
        if (isPaidFamilySeat(seat)) return "border-purple-500 bg-purple-100 text-purple-900";

        return "border-blue-500 bg-blue-100 text-sky-800";
    }

    function getTitle(seat: Seat) {
        const booking = bookingBySeatId.get(seat.id);
        const label = getSeatText(seat);

        if (booking) {
            return `${label}\nFull Seat ID: ${seat.seat_label}\nFloor: ${seat.floor_name || "-"}\nSection: ${seat.section || "-"}\nStatus: ${seat.status}\nCategory: ${seat.seat_category || "-"}\nBooked by: ${booking.learner_name || "Guest"}\nParent: ${booking.parent_name || "-"}\nTicket: ${booking.ticket_id || "-"}\nCode: ${booking.booking_code || "-"}`;
        }

        if (seat.status === "held") {
            return `${label}\nThis seat is temporarily reserved while another payment is in progress.`;
        }

        if (mode === "booking" && !isAllowedForCode(seat)) {
            return `${label}\nFull Seat ID: ${seat.seat_label}\nFloor: ${seat.floor_name || "-"}\nSection: ${seat.section || "-"}\nThis seat is not available for this booking code type.\nCategory: ${seat.seat_category || "-"}`;
        }

        return `${label}\nFull Seat ID: ${seat.seat_label}\nFloor: ${seat.floor_name || "-"}\nSection: ${seat.section || "-"}\nStatus: ${seat.status}\nCategory: ${seat.seat_category || "-"}`;
    }

    function renderFloor(floorKey: FloorKey) {
        const floorSeats = seatsByFloor[floorKey];
        const xs = floorSeats.map((seat) => seat.layout_x as number);
        const ys = floorSeats.map((seat) => seat.layout_y as number);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        const mapWidth = Math.max(FLOOR_MIN_WIDTH, maxX - minX + SEAT_PADDING * 2 + SEAT_SIZE);
        const mapHeight =
            maxY - minY + SEAT_PADDING * 2 + SEAT_SIZE + (floorKey === "ground" ? FLOOR_EXTRA_BOTTOM_SPACE : 110);
        const uniqueSections = Array.from(new Set(floorSeats.map((seat) => seat.section).filter(Boolean)));

        return (
            <section key={floorKey} className="rounded-2xl border border-gray-200 bg-white p-4 shadow">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                    <div>
                        <h3 className="text-lg font-bold tracking-wide text-gray-900">{getFloorTitle(floorKey)}</h3>
                        <p className="text-xs text-gray-500">
                            {floorKey === "ground"
                                ? "Stage is shown at the bottom. Seats face downward towards the stage."
                                : "Balcony is shown separately from the ground floor."}
                        </p>
                    </div>

                    {uniqueSections.length > 0 && (
                        <p className="text-xs text-gray-500">Sections: {uniqueSections.join(" / ")}</p>
                    )}
                </div>

                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <div className="relative">
                        <MiniMap
                            floorKey={floorKey}
                            floorSeats={floorSeats}
                            selectedSeatIds={selectedSeatIds}
                            minX={minX}
                            minY={minY}
                            mapWidth={mapWidth}
                            mapHeight={mapHeight}
                            viewport={viewportByFloor[floorKey]}
                        />

                        <div
                            ref={(element) => setScrollContainer(floorKey, element)}
                            onScroll={(event) => updateViewport(floorKey, event.currentTarget)}
                            className="max-h-[70vh] overflow-auto rounded-xl"
                        >
                            <div className="relative rounded-xl bg-white" style={{ width: mapWidth, height: mapHeight }}>
                                {floorKey === "ground" && (
                                    <div
                                        className="absolute flex items-center justify-center rounded-lg border border-gray-400 bg-gray-100 text-base font-bold tracking-wide text-gray-800"
                                        style={{ left: mapWidth / 2 - 190, top: mapHeight - 85, width: 380, height: 58 }}
                                    >
                                        STAGE
                                    </div>
                                )}

                                {floorKey === "balcony" && (
                                    <div
                                        className="absolute flex items-center justify-center rounded-lg border border-gray-300 bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-700"
                                        style={{ left: mapWidth / 2 - 95, top: mapHeight - 50, width: 190, height: 32 }}
                                    >
                                        BALCONY RAIL / FRONT
                                    </div>
                                )}

                                {floorSeats.map((seat) => {
                                    const clickable = isClickable(seat);
                                    const left = (seat.layout_x as number) - minX + SEAT_PADDING;
                                    const top = (seat.layout_y as number) - minY + SEAT_PADDING;

                                    return (
                                        <button
                                            key={seat.id}
                                            type="button"
                                            title={getTitle(seat)}
                                            disabled={!clickable}
                                            onClick={() => {
                                                if (clickable && onSeatClick) onSeatClick(seat);
                                            }}
                                            className={`absolute flex flex-col items-center justify-center rounded border text-[9px] font-semibold leading-none transition ${getSeatClass(
                                                seat
                                            )} ${clickable ? "cursor-pointer hover:z-20 hover:scale-125" : "cursor-default"}`}
                                            style={{
                                                left,
                                                top,
                                                width: SEAT_SIZE,
                                                height: SEAT_SIZE,
                                                transform: `rotate(${seat.rotation_deg || 0}deg)`,
                                            }}
                                        >
                                            <span>{getSeatText(seat)}</span>
                                            {isPaidFamilySeat(seat) && (
                                                <span className="mt-0.5 text-[8px] font-bold leading-none text-purple-700">₹</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    if (visibleFloors.length === 0) {
        return (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow">
                No positioned seats found. Check that your seats have layout_x, layout_y, and floor_name values.
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {visibleFloors.map(renderFloor)}

            <div className="flex flex-wrap gap-3 text-sm">
                <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded border border-sky-300 bg-sky-50" />
                    Regular / Available
                </div>

                <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded border border-purple-500 bg-purple-100" />
                    Paid / Family Guest Section
                </div>

                <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded border border-yellow-300 bg-yellow-50" />
                    VIP Category
                </div>

                <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded bg-blue-600" />
                    Selected
                </div>

                <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded bg-amber-100 border border-amber-400" />
                    Temporarily Held
                </div>

                <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded bg-gray-300" />
                    Booked
                </div>

                <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded bg-gray-900" />
                    Blocked
                </div>

                {mode === "booking" && (
                    <div className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded border border-red-200 bg-red-50" />
                        Not available for your code
                    </div>
                )}
            </div>

            {mode === "booking" && maxSelectable > 0 && (
                <p className="text-sm text-gray-500">
                    You can select up to {maxSelectable} seat{maxSelectable === 1 ? "" : "s"}.
                </p>
            )}
        </div>
    );
}
