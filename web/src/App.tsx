import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, User } from 'lucide-react';
import './App.css';
import { BAMENDA_QUARTERS } from './data/quarters';
import { useAuthStore } from './store/useAuthStore';

// Custom icons used instead of default leaflet markers

const CAR_ICON = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3202/3202926.png',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const PICKUP_ICON = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

type Step = 'START' | 'SEARCH' | 'FINDING_DRIVER' | 'ACCEPTED' | 'ONGOING' | 'COMPLETED';

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function App() {
  const { isDemo, setDemo } = useAuthStore();
  const [step, setStep] = useState<Step>('START');
  const [pickup] = useState('My Current Location');
  const [dropoff, setDropoff] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [userPos, setUserPos] = useState<[number, number]>([4.0511, 9.7679]); // Douala/Bamenda region
  const [driverPos, setDriverPos] = useState<[number, number] | null>(null);
  const [route, setRoute] = useState<[number, number][]>([]);

  // Simulation timer ref
  const simRef = useRef<any>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserPos([pos.coords.latitude, pos.coords.longitude]),
        () => console.log("Geolocation blocked")
      );
    }
  }, []);

  const handleSearch = (text: string) => {
    setDropoff(text);
    if (text.length > 1) {
      const filtered = BAMENDA_QUARTERS.filter(q => q.toLowerCase().includes(text.toLowerCase())).slice(0, 5);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  const startDemoRide = () => {
    if (!dropoff) return;
    setStep('FINDING_DRIVER');
    setDemo(true);
    
    // Simulate Driver Found
    setTimeout(() => {
      setStep('ACCEPTED');
      const startLat = userPos[0] + 0.01;
      const startLng = userPos[1] + 0.01;
      setDriverPos([startLat, startLng]);

      // Move driver to pickup
      let count = 0;
      simRef.current = setInterval(() => {
        count++;
        setDriverPos(prev => {
          if (!prev) return prev;
          const nextLat = prev[0] - (startLat - userPos[0]) / 20;
          const nextLng = prev[1] - (startLng - userPos[1]) / 20;
          return [nextLat, nextLng];
        });

        if (count >= 20) {
          clearInterval(simRef.current!);
          setStep('ONGOING');
          // Start actual ride simulation to destination (fake offset)
          startTripToDestination();
        }
      }, 500);
    }, 2000);
  };

  const startTripToDestination = () => {
    let count = 0;
    const destLat = userPos[0] - 0.02;
    const destLng = userPos[1] + 0.02;
    
    setRoute([[userPos[0], userPos[1]], [destLat, destLng]]);

    simRef.current = setInterval(() => {
      count++;
      setDriverPos(prev => {
        if (!prev) return prev;
        const nextLat = prev[0] + (destLat - userPos[0]) / 30;
        const nextLng = prev[1] + (destLng - userPos[1]) / 30;
        return [nextLat, nextLng];
      });

      if (count >= 30) {
        clearInterval(simRef.current!);
        setStep('COMPLETED');
      }
    }, 400);
  };

  const reset = () => {
    if (simRef.current) clearInterval(simRef.current);
    setStep('START');
    setDriverPos(null);
    setRoute([]);
    setDropoff('');
  };

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.onerror = (msg) => setError(String(msg));
  }, []);

  if (error) {
    return (
      <div style={{ background: '#000', color: '#FF3B30', padding: 20, height: '100vh' }}>
        <h2>System Error</h2>
        <pre>{error}</pre>
        <button onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="map-container">
        <MapContainer center={userPos} zoom={14} scrollWheelZoom={true} zoomControl={false}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
          />
          <MapController center={userPos} />
          
          <Marker position={userPos} icon={PICKUP_ICON}>
            <Popup>You are here</Popup>
          </Marker>

          {driverPos && (
            <Marker position={driverPos} icon={CAR_ICON}>
              <Popup>Driver</Popup>
            </Marker>
          )}

          {route.length > 0 && <Polyline positions={route} color="#FFD700" weight={5} opacity={0.7} />}
        </MapContainer>
      </div>

      <div className="overlay-container">
        <div className="top-bar">
          <div className="logo-card">
            <span className="logo-text">eRide</span>
            {isDemo && <span className="demo-badge">DEMO MODE</span>}
          </div>
          <div style={{ pointerEvents: 'auto', background: '#1A1A1A', padding: 10, borderRadius: '50%' }}>
            <User color="#FFD700" size={24} />
          </div>
        </div>

        <div className="bottom-sheet">
          {step === 'START' || step === 'SEARCH' ? (
            <div className="search-section">
              <div className="input-wrapper">
                <MapPin size={20} color="#FFD700" />
                <input value={pickup} readOnly />
              </div>
              <div className="input-wrapper">
                <Navigation size={20} color="#999" />
                <input 
                  placeholder="Where to?" 
                  value={dropoff} 
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearch(e.target.value)}
                  onFocus={() => setStep('SEARCH')}
                />
              </div>
              
              {suggestions.length > 0 && (
                <div className="suggestions-list">
                  {suggestions.map(s => (
                    <div key={s} className="suggestion-item" onClick={() => { setDropoff(s); setSuggestions([]); }}>
                      {s}
                    </div>
                  ))}
                </div>
              )}

              <button className="primary-button" onClick={startDemoRide}>
                Try Demo Ride
              </button>
            </div>
          ) : step === 'FINDING_DRIVER' ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div className="loading-spinner"></div>
              <h2 style={{ marginTop: 20 }}>Finding your driver...</h2>
              <p style={{ color: '#999' }}>Connecting to the closest vehicle</p>
            </div>
          ) : (
            <div className="ride-status-card">
              <div className="driver-info">
                <div className="avatar">JD</div>
                <div className="driver-details">
                  <div className="driver-name">John Doe</div>
                  <div className="car-details">Toyota Corolla • NW-452-BA</div>
                </div>
                <div style={{ color: '#FFD700', fontWeight: 'bold' }}>4.9 ★</div>
              </div>
              
              <div style={{ borderTop: '1px solid #333', paddingTop: 16 }}>
                <div style={{ fontSize: 14, color: '#999' }}>Status</div>
                <div style={{ fontSize: 18, fontWeight: 'bold', color: '#FFD700' }}>
                  {step === 'ACCEPTED' ? 'Driver is heading to you' : 
                   step === 'ONGOING' ? 'Heading to ' + dropoff : 
                   'Ride Completed'}
                </div>
              </div>

              {step === 'COMPLETED' ? (
                <button className="primary-button" onClick={reset}>Done</button>
              ) : (
                <button className="primary-button" style={{ background: '#FF3B30', color: 'white' }} onClick={reset}>
                  Cancel Ride
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
