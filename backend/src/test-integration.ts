import axios from 'axios';
import { io } from 'socket.io-client';

const API_URL = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('--- Starting eRide Integration Tests ---');
  try {
    // 1. Register Rider
    console.log('1. Registering Rider...');
    const riderEmail = `rider_${Date.now()}@test.com`;
    const riderRes = await axios.post(`${API_URL}/auth/register`, {
      name: 'Test Rider',
      email: riderEmail,
      phone: `+2376${Math.floor(10000000 + Math.random() * 90000000)}`,
      password: 'password123',
      role: 'RIDER'
    });
    const riderToken = riderRes.data.token;
    const riderId = riderRes.data.id;
    console.log('✅ Rider registered:', riderId);

    // 2. Register Driver
    console.log('2. Registering Driver...');
    const driverEmail = `driver_${Date.now()}@test.com`;
    const driverRes = await axios.post(`${API_URL}/auth/register`, {
      name: 'Test Driver',
      email: driverEmail,
      phone: `+2376${Math.floor(10000000 + Math.random() * 90000000)}`,
      password: 'password123',
      role: 'DRIVER'
    });
    const driverToken = driverRes.data.token;
    const driverId = driverRes.data.id;
    console.log('✅ Driver registered:', driverId);

    // Setup Sockets
    const riderSocket = io(SOCKET_URL);
    const driverSocket = io(SOCKET_URL);
    
    riderSocket.emit('join_user', riderId);
    driverSocket.emit('join_user', driverId);

    // 3. Request Ride
    console.log('3. Requesting Ride...');
    const rideRes = await axios.post(`${API_URL}/rides/request`, {
      pickupLat: 4.0511,
      pickupLng: 9.7679,
      pickupAddress: 'Bonamoussadi, Douala',
      dropoffLat: 4.053,
      dropoffLng: 9.77,
      dropoffAddress: 'Akwa, Douala',
      paymentMethod: 'CASH'
    }, { headers: { Authorization: `Bearer ${riderToken}` } });
    
    const rideId = rideRes.data.id;
    console.log('✅ Ride requested:', rideId);

    riderSocket.emit('join_ride', rideId);
    driverSocket.emit('join_ride', rideId);

    // 4. Accept Ride
    console.log('4. Driver accepting ride...');
    await axios.patch(`${API_URL}/rides/${rideId}/status`, {
      status: 'ACCEPTED'
    }, { headers: { Authorization: `Bearer ${driverToken}` } });
    console.log('✅ Ride accepted');

    // 5. Send Chat Message
    console.log('5. Testing chat message...');
    await axios.post(`${API_URL}/rides/${rideId}/messages`, {
      content: 'I am arriving in 2 minutes!'
    }, { headers: { Authorization: `Bearer ${driverToken}` } });
    console.log('✅ Message sent');

    // 6. Complete Ride
    console.log('6. Completing ride...');
    await axios.patch(`${API_URL}/rides/${rideId}/status`, {
      status: 'COMPLETED'
    }, { headers: { Authorization: `Bearer ${driverToken}` } });
    console.log('✅ Ride completed');

    console.log('--- All Integration Tests Passed Successfully! ---');

    riderSocket.disconnect();
    driverSocket.disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Test Failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

runTests();
