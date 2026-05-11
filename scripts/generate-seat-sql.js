const EVENT_ID = "PASTE-YOUR-EVENT-ID-HERE";

const auditorium = [
    {
        floorName: "ground",
        section: "Ground Floor",
        rowPrefix: "",
        startY: 170,
        rowGap: 58,
        centerX: 720,
        baseSpacing: 46,
        curveStrength: 0.85,
        rotationStrength: 2.0,
        rows: [
            { row: "A", count: 10, category: "vip" },
            { row: "B", count: 12, category: "regular" },
            { row: "C", count: 14, category: "regular" },
            { row: "D", count: 16, category: "regular" },
            { row: "E", count: 18, category: "regular" },
            { row: "F", count: 20, category: "regular" },
            { row: "G", count: 22, category: "regular" },
            { row: "H", count: 24, category: "regular" },
            { row: "I", count: 24, category: "regular" },
            { row: "J", count: 24, category: "regular" },
            { row: "K", count: 24, category: "regular" },
            { row: "L", count: 24, category: "regular" },
            { row: "M", count: 24, category: "regular" },
            { row: "N", count: 24, category: "regular" },
            { row: "O", count: 24, category: "regular" },
            { row: "P", count: 24, category: "regular" },
            { row: "Q", count: 24, category: "regular" },
            { row: "R", count: 24, category: "regular" },
            { row: "S", count: 24, category: "regular" },
            { row: "T", count: 24, category: "regular" },
        ],
    },
    {
        floorName: "first",
        section: "First Floor",
        rowPrefix: "F",
        startY: 170,
        rowGap: 62,
        centerX: 720,
        baseSpacing: 48,
        curveStrength: 0.75,
        rotationStrength: 1.8,
        rows: [
            { row: "A", count: 14, category: "paid" },
            { row: "B", count: 16, category: "paid" },
            { row: "C", count: 18, category: "paid" },
            { row: "D", count: 20, category: "paid" },
            { row: "E", count: 22, category: "paid" },
            { row: "F", count: 22, category: "paid" },
            { row: "G", count: 22, category: "paid" },
            { row: "H", count: 22, category: "paid" },
        ],
    },
];

function allowedCodeTypesForCategory(category) {
    if (category === "paid") {
        return ["paid", "vip", "staff"];
    }

    if (category === "vip") {
        return ["vip", "staff"];
    }

    if (category === "staff") {
        return ["staff"];
    }

    return ["regular", "vip", "staff"];
}

function sqlArray(items) {
    return `array[${items.map((item) => `'${item}'`).join(", ")}]`;
}

const rows = [];

for (const floor of auditorium) {
    floor.rows.forEach((rowDef, rowIndex) => {
        const count = rowDef.count;
        const rowCenter = (count + 1) / 2;
        const spacing = floor.baseSpacing;
        const yBase = floor.startY + rowIndex * floor.rowGap;

        for (let seatNumber = 1; seatNumber <= count; seatNumber++) {
            const offset = seatNumber - rowCenter;

            const seatLabel = `${floor.rowPrefix}${rowDef.row}${seatNumber}`;

            const x = floor.centerX + offset * spacing;

            // This creates the curve:
            // side seats move slightly further away from the stage.
            const y = yBase + Math.abs(offset) * Math.abs(offset) * floor.curveStrength;

            // Side seats rotate slightly inward.
            const rotation = offset * floor.rotationStrength;

            const allowedTypes = allowedCodeTypesForCategory(rowDef.category);

            rows.push({
                event_id: EVENT_ID,
                seat_label: seatLabel,
                row_name: `${floor.rowPrefix}${rowDef.row}`,
                seat_number: seatNumber,
                section: floor.section,
                status: "available",
                layout_x: Math.round(x),
                layout_y: Math.round(y),
                rotation_deg: Math.round(rotation * 10) / 10,
                floor_name: floor.floorName,
                seat_category: rowDef.category,
                allowed_code_types: allowedTypes,
            });
        }
    });
}

const values = rows
    .map((seat) => {
        return `(
      '${seat.event_id}',
      '${seat.seat_label}',
      '${seat.row_name}',
      ${seat.seat_number},
      '${seat.section}',
      '${seat.status}',
      ${seat.layout_x},
      ${seat.layout_y},
      ${seat.rotation_deg},
      '${seat.floor_name}',
      '${seat.seat_category}',
      ${sqlArray(seat.allowed_code_types)}
    )`;
    })
    .join(",\n");

const sql = `
-- Optional: clear existing seats for this event before inserting fresh layout
-- delete from public.seats where event_id = '${EVENT_ID}';

insert into public.seats (
  event_id,
  seat_label,
  row_name,
  seat_number,
  section,
  status,
  layout_x,
  layout_y,
  rotation_deg,
  floor_name,
  seat_category,
  allowed_code_types
)
values
${values};
`;

console.log(sql);