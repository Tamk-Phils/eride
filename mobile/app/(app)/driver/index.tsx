import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, SafeAreaView, Platform } from 'react-native';
import * as Location from 'expo-location';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { User, MapPin, Clock } from 'lucide-react-native';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { io, Socket } from 'socket.io-client';

const API_URL = 'http://192.168.1.187:5000/api';
const SOCKET_URL = 'http://192.168.1.187:5000';

interface RideRequest {
  rideId: string;
  pickup: { address: string; lat: number; lng: number };
  estimatedFare: number;
  expiresAt?: number;
}

export default function DriverHome() {
  const { user, token, logout, setAuth } = useAuthStore();
  const router = useRouter();
  const [requests, setRequests] = useState<RideRequest[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isOnline, setIsOnline] = useState(user?.isOnline || false);

  // Haversine distance formula
  const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
  };

  // Poll for approval status if pending
  useEffect(() => {
    let interval: any;
    if (user?.status === 'PENDING') {
      interval = setInterval(async () => {
        try {
          const res = await axios.get(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.data.status === 'APPROVED' && token) {
            setAuth({ ...user, ...res.data }, token);
          }
        } catch (e) {}
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [user?.status, token]);

  useEffect(() => {
    if (user?.status !== 'APPROVED') return;

    let locationSubscription: Location.LocationSubscription | null = null;
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    const startLocationWatch = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Location permission denied! Riders will not see you on the map.');
        return;
      }
      
      console.log("Location permission granted. Starting watchPositionAsync...");
      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 0,
        },
        (location) => {
          setCurrentLocation({ lat: location.coords.latitude, lng: location.coords.longitude });
          if (isOnline) {
            newSocket.emit('update_location', {
              driverId: user?.id,
              lat: location.coords.latitude,
              lng: location.coords.longitude,
              type: 'STANDARD'
            });
          }
        }
      );
    };

    newSocket.on('connect', () => {
      newSocket.emit('join_user', user?.id);
      startLocationWatch();
      
      if (isOnline) {
        // Fetch any existing targeted requests if we missed them
        axios.get(`${API_URL}/rides/pending`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => setRequests(res.data))
        .catch(err => console.log('Error fetching pending rides:', err));
      }
    });

    newSocket.on('targeted_ride_request', (data: any) => {
      if (!isOnline) return;
      const requestWithExpiry = {
        ...data,
        expiresAt: Date.now() + (data.expiresIn * 1000)
      };
      setRequests((prev) => {
        if (prev.some(r => r.rideId === data.rideId)) return prev;
        return [requestWithExpiry, ...prev];
      });
    });

    newSocket.on('request_expired', (data: { rideId: string }) => {
      setRequests((prev) => prev.filter(r => r.rideId !== data.rideId));
    });

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
      newSocket.disconnect();
    };
  }, [user, isOnline]);

  // Handle countdowns locally
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleOnline = async () => {
    const nextState = !isOnline;
    setIsOnline(nextState);
    if (!nextState) setRequests([]); // Clear queue if going offline
    try {
      await axios.patch(`${API_URL}/auth/status`, { isOnline: nextState }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (e) {
      console.log('Error setting online status', e);
      setIsOnline(!nextState); // rollback
    }
  };

  if (user?.status === 'PENDING') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={logout} style={styles.logoutButton}>
            <User size={20} color="#1A1A1A" />
          </TouchableOpacity>
        </View>
        <View style={styles.pendingContainer}>
          <Clock size={64} color="#F5A623" style={styles.pendingIcon} />
          <Text style={styles.pendingTitle}>Awaiting Approval</Text>
          <Text style={styles.pendingSubtitle}>
            Your vehicle documents have been submitted and are currently under review by our admin team. You will be able to accept rides once approved.
          </Text>
          <TouchableOpacity style={styles.logoutFullButton} onPress={logout}>
            <Text style={styles.logoutFullButtonText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }


  const acceptRide = async (rideId: string) => {
    try {
      await axios.patch(
        `${API_URL}/rides/${rideId}/status`,
        { status: 'ACCEPTED' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      router.push(`/(app)/ride/${rideId}`);
    } catch (error) {
      alert('Failed to accept ride. It might have been taken.');
      setRequests((prev) => prev.filter(r => r.rideId !== rideId));
    }
  };

  const renderRequest = ({ item }: { item: RideRequest }) => {
    let distanceToPickup = '...';
    if (currentLocation && item.pickup.lat && item.pickup.lng) {
      const dist = getDistanceKm(currentLocation.lat, currentLocation.lng, item.pickup.lat, item.pickup.lng);
      distanceToPickup = dist < 1 ? `${Math.round(dist * 1000)}m away` : `${dist.toFixed(1)}km away`;
    }

    const timeLeft = item.expiresAt ? Math.max(0, Math.floor((item.expiresAt - now) / 1000)) : 0;
    const progressWidth = item.expiresAt ? `${(timeLeft / 15) * 100}%` : '100%';

    return (
      <View style={styles.card}>
        {item.expiresAt && (
          <View style={{ height: 4, width: progressWidth as any, backgroundColor: timeLeft < 5 ? '#FF3B30' : '#34C759', marginBottom: 8, borderRadius: 2 }} />
        )}
        <View style={styles.cardHeader}>
          <Text style={styles.fare}>XAF {item.estimatedFare}</Text>
          <Text style={styles.distance}>{distanceToPickup}</Text>
        </View>
        <View style={styles.locations}>
          <View style={styles.locationRow}>
            <MapPin size={16} color="#666" style={styles.icon} />
            <Text style={styles.locationText} numberOfLines={1}>{item.pickup.address || 'Unknown Location'}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.acceptButton} onPress={() => acceptRide(item.rideId)}>
          <Text style={styles.acceptButtonText}>Accept Ride</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Text style={styles.greeting}>Driver Mode</Text>
          <Text style={styles.subtitle}>{isOnline ? 'Online - Finding Rides' : 'Offline'}</Text>
        </View>
        <TouchableOpacity 
          style={[styles.onlineToggle, isOnline ? styles.onlineButton : styles.offlineButton]} 
          onPress={toggleOnline}
        >
          <Text style={styles.onlineToggleText}>{isOnline ? 'GO OFFLINE' : 'GO ONLINE'}</Text>
        </TouchableOpacity>
      </View>

      {!isOnline ? (
        <View style={styles.offlineContainer}>
          <Clock size={48} color="#666" />
          <Text style={styles.offlineTitle}>You are offline</Text>
          <Text style={styles.offlineSubtitle}>Go online to start receiving targeted ride requests.</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.rideId}
          renderItem={renderRequest}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color="#1A1A1A" />
              <Text style={styles.emptyText}>Scanning for nearby riders...</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
  },
  userInfo: {
    flex: 1,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  onlineToggle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineButton: {
    backgroundColor: '#FF3B30',
  },
  offlineButton: {
    backgroundColor: '#34C759',
  },
  onlineToggleText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  offlineContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  offlineTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginTop: 16,
    marginBottom: 8,
  },
  offlineSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  logoutButton: {
    padding: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  listContainer: {
    padding: 20,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  fare: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  distance: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  locations: {
    marginBottom: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 12,
  },
  locationText: {
    fontSize: 16,
    color: '#1A1A1A',
    flex: 1,
  },
  acceptButton: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  pendingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  pendingIcon: {
    marginBottom: 24,
  },
  pendingTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  pendingSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  logoutFullButton: {
    backgroundColor: '#FFE5E5',
    padding: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  logoutFullButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '700',
  },
});
