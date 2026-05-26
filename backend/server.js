require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
const server = http.createServer(app);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const io = new Server(server, {
    cors: { origin: "http://localhost:5173", methods: ["GET", "POST"] }
});

// --- Analytics API Endpoint ---
app.get('/api/analytics', async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM vehicles) as total_fleet,
                (SELECT COUNT(*) FROM vehicles WHERE status = 'in_transit') as active_vehicles,
                (SELECT COALESCE(ROUND(AVG(speed), 1), 0) FROM vehicle_locations) as avg_fleet_speed,
                (SELECT COUNT(*) FROM vehicle_locations) as total_waypoints
        `);
        res.json(stats.rows[0]);
    } catch (err) {
        console.error("Analytics Error:", err.message);
        res.status(500).json({ error: "Database error" });
    }
});

// --- NEW: History API Endpoint ---
app.get('/api/history', async (req, res) => {
    try {
        const history = await pool.query(`
            SELECT v.license_plate as "vehicleId", v.driver_name as "driverName", l.lat, l.lng, l.speed
            FROM vehicle_locations l
            JOIN vehicles v ON v.id = l.vehicle_id
            ORDER BY l.recorded_at ASC
        `);
        res.json(history.rows);
    } catch (err) {
        console.error("History Error:", err.message);
        res.status(500).json({ error: "Database error" });
    }
});

let currentLat = 19.0760;
let currentLng = 72.8777;
let vehicleDbId = null;

async function initializeVehicle() {
    try {
        const res = await pool.query(`
            INSERT INTO vehicles (license_plate, driver_name, status) 
            VALUES ('MH-12-AB-1234', 'Rahul Kumar', 'in_transit')
            ON CONFLICT (license_plate) DO UPDATE SET status = 'in_transit'
            RETURNING id;
        `);
        vehicleDbId = res.rows[0].id;
        console.log(`✅ Vehicle Ready in DB: ${vehicleDbId}`);
    } catch (err) {
        console.error("❌ DB Initialization Error:", err.message);
    }
}

async function simulateTruckMovement() {
    if (!vehicleDbId) return;

    currentLat -= 0.002; 
    currentLng += 0.002; 

    const vehicleData = {
        vehicleId: 'MH-12-AB-1234',
        driverName: 'Rahul Kumar',
        lat: currentLat,
        lng: currentLng,
        speed: Math.floor(Math.random() * (75 - 55 + 1)) + 55 
    };

    io.emit('dispatcher_map_update', vehicleData);

    try {
        // FIXED: Now inserting standard lat and lng instead of the PostGIS geom!
        await pool.query(`
            INSERT INTO vehicle_locations (vehicle_id, lat, lng, speed)
            VALUES ($1, $2, $3, $4)
        `, [vehicleDbId, currentLat, currentLng, vehicleData.speed]); 
        
        console.log(`💾 Saved GPS Ping to DB: Speed ${vehicleData.speed} km/h`);
    } catch (err) {
         console.error("❌ Failed to save GPS ping:", err.message);
    }
}

io.on('connection', (socket) => console.log(`🟢 Dashboard connected: ${socket.id}`));

const PORT = 4000;
server.listen(PORT, async () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    await initializeVehicle();
    setInterval(simulateTruckMovement, 2000); 
});