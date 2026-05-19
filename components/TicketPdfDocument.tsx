import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Image,
} from "@react-pdf/renderer";

type TicketPdfDocumentProps = {
    eventName: string;
    eventDate: string | null;
    venue: string | null;
    ticketId: string;
    bookingCode: string;
    learnerName: string | null;
    parentName: string | null;
    seats: string;
    codeType: string | null;
    logoDataUri?: string | null;
};

const styles = StyleSheet.create({
    page: {
        padding: 30,
        fontSize: 12,
        fontFamily: "Helvetica",
        backgroundColor: "#f1f5f9",
    },
    ticket: {
        overflow: "hidden",
        borderRadius: 18,
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderStyle: "solid",
    },
    header: {
        backgroundColor: "#020617",
        paddingTop: 26,
        paddingHorizontal: 28,
        paddingBottom: 28,
        textAlign: "center",
    },
    logo: {
        width: 170,
        maxHeight: 85,
        objectFit: "contain",
        marginHorizontal: "auto",
        marginBottom: 16,
    },
    smallHeader: {
        fontSize: 9,
        textTransform: "uppercase",
        color: "#fde68a",
        letterSpacing: 2,
        textAlign: "center",
        marginBottom: 8,
    },
    title: {
        fontSize: 26,
        fontWeight: "bold",
        textAlign: "center",
        color: "#ffffff",
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 11,
        textAlign: "center",
        color: "#cbd5e1",
    },
    body: {
        padding: 26,
    },
    infoGrid: {
        flexDirection: "row",
        gap: 12,
        marginBottom: 12,
    },
    infoBox: {
        flexGrow: 1,
        flexBasis: 0,
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderStyle: "solid",
        borderRadius: 12,
        padding: 12,
        backgroundColor: "#f8fafc",
    },
    label: {
        fontSize: 8,
        color: "#64748b",
        textTransform: "uppercase",
        letterSpacing: 0.8,
        marginBottom: 6,
    },
    value: {
        fontSize: 12,
        color: "#020617",
        fontWeight: "bold",
    },
    seatsBox: {
        marginTop: 12,
        padding: 18,
        backgroundColor: "#fef3c7",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#fde68a",
        borderStyle: "solid",
    },
    seatsLabel: {
        fontSize: 9,
        color: "#92400e",
        textAlign: "center",
        textTransform: "uppercase",
        letterSpacing: 1.4,
        marginBottom: 8,
    },
    seatsValue: {
        fontSize: 30,
        fontWeight: "bold",
        textAlign: "center",
        color: "#020617",
    },
    note: {
        marginTop: 18,
        padding: 12,
        backgroundColor: "#eff6ff",
        color: "#1e40af",
        fontSize: 10,
        lineHeight: 1.5,
        borderRadius: 10,
    },
    footer: {
        marginTop: 18,
        fontSize: 9,
        color: "#64748b",
        textAlign: "center",
    },
});

export default function TicketPdfDocument({
    eventName,
    eventDate,
    venue,
    ticketId,
    bookingCode,
    learnerName,
    parentName,
    seats,
    codeType,
    logoDataUri,
}: TicketPdfDocumentProps) {
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <View style={styles.ticket}>
                    <View style={styles.header}>
                        {logoDataUri ? <Image src={logoDataUri} style={styles.logo} /> : null}

                        <Text style={styles.smallHeader}>Official Entry Ticket</Text>
                        <Text style={styles.title}>{eventName}</Text>
                        <Text style={styles.subtitle}>
                            {[venue, eventDate].filter(Boolean).join(" | ")}
                        </Text>
                    </View>

                    <View style={styles.body}>
                        <View style={styles.infoGrid}>
                            <View style={styles.infoBox}>
                                <Text style={styles.label}>Ticket ID</Text>
                                <Text style={styles.value}>{ticketId}</Text>
                            </View>

                            <View style={styles.infoBox}>
                                <Text style={styles.label}>Booking Code</Text>
                                <Text style={styles.value}>{bookingCode}</Text>
                            </View>
                        </View>

                        <View style={styles.infoGrid}>
                            <View style={styles.infoBox}>
                                <Text style={styles.label}>Learner / Guest</Text>
                                <Text style={styles.value}>{learnerName || "Guest"}</Text>
                            </View>

                            <View style={styles.infoBox}>
                                <Text style={styles.label}>Parent / Contact</Text>
                                <Text style={styles.value}>{parentName || "Not provided"}</Text>
                            </View>
                        </View>

                        <View style={styles.infoGrid}>
                            <View style={styles.infoBox}>
                                <Text style={styles.label}>Code Type</Text>
                                <Text style={styles.value}>{codeType || "-"}</Text>
                            </View>

                            <View style={styles.infoBox}>
                                <Text style={styles.label}>Status</Text>
                                <Text style={styles.value}>Confirmed</Text>
                            </View>
                        </View>

                        <View style={styles.seatsBox}>
                            <Text style={styles.seatsLabel}>Seats</Text>
                            <Text style={styles.seatsValue}>{seats}</Text>
                        </View>

                        <Text style={styles.note}>
                            Please save this ticket and show it at the entrance. Entry staff will verify the ticket using the ticket ID and seat details.
                        </Text>

                        <Text style={styles.footer}>
                            This ticket was generated by the school seat booking system.
                        </Text>
                    </View>
                </View>
            </Page>
        </Document>
    );
}
