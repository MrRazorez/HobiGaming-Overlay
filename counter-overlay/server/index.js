import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import os from "os";
import qrcode from "qrcode-terminal";

const TITLE = process.env.TITLE || "Counter Overlay";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;
const DATA_FILE = path.join(__dirname, "data.json");
const DIST = path.join(__dirname, "../client/dist");

let count = 0;
try {
    count = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")).count || 0;
} catch {
    
}

const update = (io) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ count }));
    io.emit("count", count);
}

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(express.static(DIST));
app.get(["/overlay", "/remote"], (_req, res) => {
    res.sendFile(path.join(DIST, "index.html"));
});

io.on("connection", (socket) => {
    socket.emit("title", TITLE);
    socket.emit("count", count);

    socket.on("increment",  () => { count += 1; update(io); });
    socket.on("decrement",  () => { count = Math.max(0, count - 1); update(io); });
    socket.on("reset",      () => { count = 0; update(io) });
    
    socket.on("set", (value) => {
        const n = Number(value);

        if (Number.isInteger(n) && n >= 0 && n <= 999999) {
            count = n;
            update(io);
        }
    });
});

const ADAPTER_NAME = process.env.ADAPTER;

const getAdapterIP = (name) => {
    const nets = os.networkInterfaces();
    const key = Object.keys(nets).find((k) => k.toLowerCase() === name.toLowerCase());
    const net = key && nets[key].find((n) => n.family === "IPv4" && !n.internal);
    return net ? net.address : null;
};

const listAdapters = () => {
    const lines = [];
    for (const [name, list] of Object.entries(os.networkInterfaces())) {
        for (const n of list ?? []) {
            if (n.family === "IPv4" && !n.internal) lines.push(`  - "${name}" -> ${n.address}`);
        }
    }

    return lines.join("\n");
}

server.listen(PORT, "0.0.0.0", () => {
    console.log(`\n=== HobiGaming Overlay (${TITLE}) sedang berjalan ===`);
    console.log(`Link Overlay   : http://localhost:${PORT}/overlay`);

    if (!ADAPTER_NAME) {
        console.log("\nVariabel ADAPTER belum diisi di file .env. Adapter yang tersedia:");
        console.log(listAdapters() || "  (tidak ada)");
        console.log('\nTambahkan baris, misalnya:  ADAPTER=Wi-Fi 2\n');

        return;
    }

    const ip = getAdapterIP(ADAPTER_NAME);

    if (!ip) {
        console.log(`\nAdapter "${ADAPTER_NAME}" tidak ditemukan atau tidak punya IPv4.`);
        console.log("Adapter yang tersedia:");
        console.log(listAdapters() || "  (tidak ada)");
        console.log("\nPerbaiki nilai ADAPTER di file .env, lalu jalankan ulang.\n");

        return;
    }

    const remoteURL = `http://${ip}:${PORT}/remote`;
    console.log(`Link Remote    : ${remoteURL}\n`);
    console.log("--- QR CODE untuk mengakses Remote Control ---\n");
    qrcode.generate(remoteURL, { small: true });
    console.log();
});