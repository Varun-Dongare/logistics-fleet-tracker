# 🚚 Real-Time Logistics & Fleet Tracking Platform

A full-stack, real-time logistics dashboard built to monitor delivery vehicles, track historical routes, and analyze fleet performance in real-time. 

This platform uses WebSockets for high-frequency GPS telemetry, integrates third-party routing engines for path optimization, and utilizes spatial math for geofence triggering.

![Dashboard Preview](https://via.placeholder.com/800x400.png?text=Replace+with+a+screenshot+of+your+dashboard!)

## ✨ Core Features

* **📡 Live Vehicle Tracking:** Vehicles transmit their GPS coordinates continuously via WebSockets (Socket.io) for sub-second map updates.
* **🗺️ Route Optimization:** Integrates the OSRM (Open Source Routing Machine) API to calculate and render the most efficient driving routes between waypoints.
* **📍 Historical Path Rendering:** Queries time-series GPS data from PostgreSQL to accurately draw the exact historical route a vehicle has taken.
* **🚧 Spatial Geofencing:** Uses coordinate geometry to establish a virtual perimeter (e.g., around a destination city) and triggers a real-time UI alert the moment a vehicle crosses the boundary.
* **📊 Live Analytics Dashboard:** Continuously calculates and displays active fleet metrics (average speed, active vehicles, total telemetry points saved).

## 🛠️ Tech Stack

**Frontend:**
* React.js (Vite)
* React-Leaflet & OpenStreetMap (Geospatial Rendering)
* Axios (API Client)
* Socket.io-client (Real-time updates)

**Backend:**
* Node.js & Express
* Socket.io (WebSocket Server)
* PostgreSQL (Relational Database)
* `pg` (Node Postgres Client)

## 🚀 Getting Started

Follow these instructions to run the platform locally on your machine.

### 1. Database Setup
You must have PostgreSQL installed. Create a database named `logistics` and run the following SQL commands to build the tables:

```sql
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_plate VARCHAR(20) UNIQUE NOT NULL,
    driver_name VARCHAR(100),
    status VARCHAR(20) DEFAULT 'idle'
);

CREATE TABLE vehicle_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    lat DECIMAL(10, 6) NOT NULL, 
    lng DECIMAL(10, 6) NOT NULL,
    speed DECIMAL(5,2),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
