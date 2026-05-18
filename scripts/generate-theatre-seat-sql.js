const fs = require("fs");
const { parse } = require("csv-parse/sync");

const EVENT_ID = "eb5c0642-5143-4e87-ac08-61cac8d79550";
const CLEAR_EXISTING_SEATS = true;

const CSV_PATH = "scripts/seat-layout.csv";

const SEAT_PITCH = 26;
const SEAT_SIZE = 20;

function allowedCodeTypesForCategory(category) {
    if (category === "paid") return ["regular", "paid", "vip", "staff"];
    if (category === "vip") return ["vip", "staff"];
    if (category === "staff") return ["staff"];
    if (category === "blocked") return [];
    return ["regular", "paid", "vip", "staff"];
}

function escapeSql(value) {
    return String(value ?? "").replace(/'/g, "''");
}

function sqlArray(items) {
    if (!items || items.length === 0) return "array[]::text[]";
    return `array[${items.map((item) => `'${escapeSql(item)}'`).join(", ")}]`;
}

function makeBlockPrefix(section) {
    return section
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase())
        .join("");
}

function parseSegments(value) {
    return String(value)
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
            const lower = part.toLowerCase();

            if (lower.startsWith("gap:")) {
                const seatSpaces = Number(lower.replace("gap:", "").trim());

                if (!Number.isFinite(seatSpaces)) {
                    throw new Error(`Invalid gap segment: ${part}`);
                }

                return { type: "gap", seatSpaces };
            }

            const count = Number(part);

            if (!Number.isInteger(count) || count < 0) {
                throw new Error(`Invalid seat segment: ${part}`);
            }

            return count;
        });
}

function isGap(segment) {
    return typeof segment === "object" && segment !== null && segment.type === "gap";
}

function getSegmentWidth(segment) {
    if (isGap(segment)) return segment.seatSpaces * SEAT_PITCH;
    return Number(segment) * SEAT_PITCH;
}

function getRowWidth(segments) {
    return segments.reduce((total, segment) => total + getSegmentWidth(segment), 0);
}

function getRowStartX(row) {
    const rowWidth = getRowWidth(row.segments);
    if (row.align === "center") {
        return row.anchorX - rowWidth / 2;
    }

    if (row.align === "end") {
        return row.anchorX - rowWidth;
    }

    return row.anchorX;
}

function validateNoOverlaps(seats) {
    const occupied = new Map();

    for (const seat of seats) {
        const key = `${seat.floor_name}:${seat.layout_x}:${seat.layout_y}`;
        const existing = occupied.get(key);

        if (existing) {
            throw new Error(
                `Seat overlap found at ${key}: ${existing.seat_label} overlaps ${seat.seat_label}.`
            );
        }

        occupied.set(key, seat);
    }
}

function validateRows(rows) {
    for (const row of rows) {
        if (!["ground", "balcony", "other"].includes(row.floorName)) {
            throw new Error(`Invalid floorName: ${row.floorName}`);
        }

        if (!["start", "center", "end"].includes(row.align)) {
            throw new Error(`Invalid align for ${row.section} ${row.row}: ${row.align}`);
        }

        if (!row.section) {
            throw new Error(`Missing section for row ${row.row}`);
        }

        if (!row.row) {
            throw new Error(`Missing row name in one CSV row.`);
        }
    }
}

const csvText = fs.readFileSync(CSV_PATH, "utf8");

const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
});

const rows = records.map((record) => {
    return {
        floorName: record.floorName,
        section: record.section,
        blockOrder: Number(record.blockOrder),
        anchorX: Number(record.anchorX),
        startY: Number(record.startY),
        align: record.align || "start",
        category: record.category || "regular",
        row: record.row,
        rowOrder: Number(record.rowOrder),
        segments: parseSegments(record.segments),
        offsetSeats: Number(record.offsetSeats || 0),
    };
});

validateRows(rows);

const seats = [];

for (const rowDef of rows) {
    const sectionPrefix = makeBlockPrefix(rowDef.section);
    let xCursor = getRowStartX(rowDef);
    const y = rowDef.startY;
    let seatNumber = Number(rowDef.offsetSeats || 0) + 1;

    for (const segment of rowDef.segments) {
        if (isGap(segment)) {
            xCursor += segment.seatSpaces * SEAT_PITCH;
            continue;
        }

        const count = Number(segment);

        for (let i = 0; i < count; i++) {
            const category = rowDef.category;
            const allowedTypes = allowedCodeTypesForCategory(category);
            const displayLabel = `${rowDef.row}${seatNumber}`;
            const seatLabel = `${sectionPrefix}-${displayLabel}`;

            seats.push({
                event_id: EVENT_ID,
                seat_label: seatLabel,
                display_label: displayLabel,
                row_name: rowDef.row,
                seat_number: seatNumber,
                section: rowDef.section,
                status: category === "blocked" ? "blocked" : "available",
                layout_x: Math.round(xCursor),
                layout_y: Math.round(y),
                rotation_deg: 0,
                floor_name: rowDef.floorName,
                seat_category: category,
                allowed_code_types: allowedTypes,
                block_name: rowDef.section.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
                block_order: rowDef.blockOrder,
                row_order: rowDef.rowOrder,
                is_bookable: category !== "blocked",
            });

            xCursor += SEAT_PITCH;
            seatNumber++;
        }
    }
}

validateNoOverlaps(seats);

const values = seats
    .map((seat) => {
        return `(
      '${seat.event_id}',
      '${escapeSql(seat.seat_label)}',
      '${escapeSql(seat.display_label)}',
      '${escapeSql(seat.row_name)}',
      ${seat.seat_number},
      '${escapeSql(seat.section)}',
      '${seat.status}',
      ${seat.layout_x},
      ${seat.layout_y},
      ${seat.rotation_deg},
      '${seat.floor_name}',
      '${seat.seat_category}',
      ${sqlArray(seat.allowed_code_types)},
      '${escapeSql(seat.block_name)}',
      ${seat.block_order},
      ${seat.row_order},
      ${seat.is_bookable}
    )`;
    })
    .join(",\n");

const deleteSql = CLEAR_EXISTING_SEATS
    ? `delete from public.seats where event_id = '${EVENT_ID}';`
    : "";

const sql = `
${deleteSql}

insert into public.seats (
  event_id,
  seat_label,
  display_label,
  row_name,
  seat_number,
  section,
  status,
  layout_x,
  layout_y,
  rotation_deg,
  floor_name,
  seat_category,
  allowed_code_types,
  block_name,
  block_order,
  row_order,
  is_bookable
)
values
${values};
`;

console.log(sql);