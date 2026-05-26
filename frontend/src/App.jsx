import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const socket = io('http://localhost:4000');

const truckIcon = new L.divIcon({
  html: '<div style="font-size: 24px; background: white; border-radius: 50%; padding: 5px; border: 2px solid #333; text-align: center; width: 30px; height: 30px; line-height: 24px;">🚚</div>',
  className: 'custom-truck-icon',
  iconSize: [40, 40],
  iconAnchor: [20, 20], 
});

const DESTINATION_COORDS = [18.5204, 73.8567]; 
const GEOFENCE_RADIUS_METERS = 15000; 

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [vehicles, setVehicles] = useState({});
  const [plannedRoute, setPlannedRoute] = useState(null);
  const [analytics, setAnalytics] = useState({ total_fleet: 0, active_vehicles: 0, avg_fleet_speed: 0, total_waypoints: 0 });
  const [arrivedTrucks, setArrivedTrucks] = useState([]);

  // 1. WebSocket Listener for LIVE updates
  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('dispatcher_map_update', (data) => {
      const distanceToDestination = L.latLng(data.lat, data.lng).distanceTo(L.latLng(DESTINATION_COORDS[0], DESTINATION_COORDS[1]));
      
      if (distanceToDestination < GEOFENCE_RADIUS_METERS) {
        setArrivedTrucks((prev) => !prev.includes(data.vehicleId) ? [...prev, data.vehicleId] : prev);
      }

      setVehicles((prevVehicles) => {
        const existingVehicle = prevVehicles[data.vehicleId];
        const currentPath = (existingVehicle && existingVehicle.path) ? existingVehicle.path : [];
        return {
          ...prevVehicles,
          [data.vehicleId]: { ...data, path: [...currentPath, [data.lat, data.lng]] }
        };
      });
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('dispatcher_map_update');
    };
  }, []);

  // 2. Fetch Initial Data on Page Load (Routing, Analytics, AND History)
  useEffect(() => {
    const fetchRoute = async () => {
      try {
        const res = await axios.get('https://router.project-osrm.org/route/v1/driving/72.8777,19.0760;73.8567,18.5204?overview=full&geometries=geojson');
        const coords = res.data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
        setPlannedRoute(coords);
      } catch (err) {}
    };

    const fetchAnalytics = async () => {
      try {
        const res = await axios.get('http://localhost:4000/api/analytics');
        setAnalytics(res.data);
      } catch (err) {}
    };

    // --- NEW: Fetch Database History to redraw the blue line on refresh ---
    const fetchHistory = async () => {
      try {
        const res = await axios.get('http://localhost:4000/api/history');
        const historicalPoints = res.data;

        if (historicalPoints.length > 0) {
          setVehicles((prev) => {
             const restoredVehicles = { ...prev };
             historicalPoints.forEach(point => {
                 if (!restoredVehicles[point.vehicleId]) {
                     restoredVehicles[point.vehicleId] = {
                         vehicleId: point.vehicleId,
                         driverName: point.driverName,
                         lat: point.lat,
                         lng: point.lng,
                         speed: point.speed,
                         path: []
                     };
                 }
                 restoredVehicles[point.vehicleId].path.push([point.lat, point.lng]);
                 restoredVehicles[point.vehicleId].lat = point.lat; // Keep marker at the latest point
                 restoredVehicles[point.vehicleId].lng = point.lng;
             });
             return restoredVehicles;
          });
        }
      } catch (err) {
        console.error("Failed to fetch history", err);
      }
    };

    fetchRoute();
    fetchHistory(); // Call the new history fetcher
    fetchAnalytics();
    
    const interval = setInterval(fetchAnalytics, 3000); 
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#1a1a1a', color: 'white', minHeight: '100vh', position: 'relative' }}>
      <h1>Logistics Dispatch Dashboard</h1>
      
      <div style={{ padding: '10px', backgroundColor: isConnected ? '#155724' : '#721c24', color: isConnected ? '#d4edda' : '#f8d7da', borderRadius: '5px', display: 'inline-block', marginBottom: '20px', marginRight: '20px' }}>
        Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>

      {arrivedTrucks.length > 0 && (
        <div style={{ padding: '10px 20px', backgroundColor: '#d4edda', color: '#155724', borderRadius: '5px', display: 'inline-block', marginBottom: '20px', fontWeight: 'bold', border: '2px solid #28a745', animation: 'pulse 2s infinite' }}>
          🎉 ARRIVAL ALERT: {arrivedTrucks.join(', ')} has entered the Pune Geofence!
        </div>
      )}

      <div style={{
        position: 'absolute', top: '100px', right: '40px', zIndex: 1000, 
        backgroundColor: 'rgba(30, 30, 30, 0.9)', padding: '20px', borderRadius: '10px', 
        border: '1px solid #444', backdropFilter: 'blur(5px)', width: '250px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
      }}>
        <h3 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #555', paddingBottom: '10px' }}>Live Fleet Analytics</h3>
        <p style={{ margin: '10px 0' }}><strong>Total Fleet:</strong> {analytics.total_fleet}</p>
        <p style={{ margin: '10px 0' }}><strong>Active Trucks:</strong> <span style={{color: '#28a745'}}>{analytics.active_vehicles}</span></p>
        <p style={{ margin: '10px 0' }}><strong>Avg Speed:</strong> {analytics.avg_fleet_speed} km/h</p>
        <p style={{ margin: '10px 0' }}><strong>GPS Pings:</strong> {analytics.total_waypoints}</p>
      </div>

      <div style={{ height: '700px', width: '100%', borderRadius: '10px', overflow: 'hidden', border: '2px solid #333' }}>
        <MapContainer center={[18.8000, 73.3000]} zoom={9} style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
          <Circle 
            center={DESTINATION_COORDS} 
            radius={GEOFENCE_RADIUS_METERS} 
            pathOptions={{ color: '#28a745', fillColor: '#28a745', fillOpacity: 0.2 }}
          >
            <Popup><strong>Pune City Limits</strong><br/>Geofence Active</Popup>
          </Circle>

          {plannedRoute && (
            <Polyline positions={plannedRoute} color="#6c757d" weight={6} opacity={0.6} />
          )}

          {Object.values(vehicles).map((vehicle) => (
            <React.Fragment key={vehicle.vehicleId}>
              {vehicle.path && vehicle.path.length > 1 && (
                <Polyline positions={vehicle.path} color="#007bff" weight={5} dashArray="10, 10" />
              )}
              <Marker position={[vehicle.lat, vehicle.lng]} icon={truckIcon}>
                <Popup>
                  <strong>{vehicle.vehicleId}</strong><br />Driver: {vehicle.driverName}<br />Speed: {vehicle.speed} km/h
                </Popup>
              </Marker>
            </React.Fragment>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

export default App;