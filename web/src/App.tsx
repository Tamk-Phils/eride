import React from 'react';

export default function App() {
  return (
    <div style={{ background: '#0D0D0D', color: '#FFD700', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <h1 style={{ fontSize: '48px' }}>eRide</h1>
      <p>The platform is initializing...</p>
      <div style={{ marginTop: '20px', padding: '10px 20px', background: '#FFD700', color: '#000', borderRadius: '8px', fontWeight: 'bold' }}>
        Debug Mode Active
      </div>
    </div>
  );
}
