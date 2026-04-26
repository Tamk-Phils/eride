import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, SafeAreaView, Platform, Image, KeyboardAvoidingView, ScrollView } from 'react-native';
import MapView, { UrlTile, Polyline, Marker } from '../../src/components/MapView';
import { useAuthStore } from '../../src/store/useAuthStore';
import { User, MapPin, Navigation } from 'lucide-react-native';
import axios from 'axios';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { io, Socket } from 'socket.io-client';
import { CUSTOM_BAMENDA_LOCATIONS } from '../../src/data/bamenda_locations';

const API_URL = 'http://192.168.1.187:5000/api';
const SOCKET_URL = 'http://192.168.1.187:5000';

export default function RiderHome() {
  const { user, token, logout } = useAuthStore();
  const router = useRouter();
  
  const [pickup, setPickup] = useState('');
  const [currentLocationName, setCurrentLocationName] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'NKWAPAY'>('CASH');
  const [vehicleType, setVehicleType] = useState<'ECONOMY' | 'STANDARD' | 'PREMIUM'>('STANDARD');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'SEARCH' | 'PREVIEW'>('SEARCH');
  const [routeCoords, setRouteCoords] = useState<{latitude: number, longitude: number}[]>([]);
  const [estimates, setEstimates] = useState<{ECONOMY: number, STANDARD: number, PREMIUM: number} | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<{id: string, lat: number, lng: number, type: string}[]>([]);
  const searchTimeout = useRef<any>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  const [region, setRegion] = useState({
    latitude: 4.0511,
    longitude: 9.7679,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  React.useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let loc = await Location.getCurrentPositionAsync({});
      setRegion(prev => ({
        ...prev,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      }));
      
      try {
        const rev = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
          params: { lat: loc.coords.latitude, lon: loc.coords.longitude, format: 'json' },
          headers: { 'User-Agent': 'eRideApp/1.0' }
        });
        if (rev.data && rev.data.address) {
          const a = rev.data.address;
          const parts = [];
          if (a.neighbourhood) parts.push(a.neighbourhood);
          if (a.suburb) parts.push(a.suburb);
          if (a.road && !parts.includes(a.road)) parts.push(a.road);
          if (a.village) parts.push(a.village);
          else if (a.town) parts.push(a.town);
          else if (a.city) parts.push(a.city);
          
          setPickup(parts.length > 0 ? parts.slice(0, 2).join(', ') : rev.data.display_name);
          setCurrentLocationName(parts.length > 0 ? parts.slice(0, 2).join(', ') : rev.data.display_name);
        } else if (rev.data && rev.data.display_name) {
          setPickup(rev.data.display_name);
          setCurrentLocationName(rev.data.display_name);
        }
      } catch (e) {}
    })();

    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);
    
    newSocket.on('connect', () => {
      newSocket.emit('join_user', user?.id);
    });

    newSocket.on('available_drivers', (drivers) => {
      setAvailableDrivers(drivers);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  const geocodeLocation = async (address: string) => {
    try {
      const res = await axios.get(`https://nominatim.openstreetmap.org/search`, {
        params: { q: address, format: 'json', limit: 1, countrycodes: 'cm' },
        headers: { 'User-Agent': 'eRideApp/1.0' }
      });
      if (res.data && res.data.length > 0) {
        return { lat: parseFloat(res.data[0].lat), lng: parseFloat(res.data[0].lon) };
      }
    } catch (error) { console.error("Geocoding failed", error); }
    return null;
  };

  const handleDestinationSearch = (text: string) => {
    setDropoff(text);
    setStep('SEARCH');
    setRouteCoords([]);
    
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    
    if (text.length < 3) {
      setSearchResults([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      // 1. Search Local Quarters Database (Smart Multi-Word Match)
      const searchTerms = text.toLowerCase().split(' ').filter(t => t.length > 0);
      const localMatches = CUSTOM_BAMENDA_LOCATIONS.filter(loc => {
        const cleanName = loc.clean_name.toLowerCase();
        const dispName = loc.display_name.toLowerCase();
        return searchTerms.every(term => cleanName.includes(term) || dispName.includes(term));
      });

      let nativeResults: any[] = [];
      try {
        const geocode = await Location.geocodeAsync(text);
        if (geocode.length > 0) {
          nativeResults = geocode.map((g, i) => ({
            place_id: `native-${i}`,
            display_name: `${text} (Exact Location)`,
            clean_name: `${text} (Exact Location)`,
            lat: g.latitude.toString(),
            lon: g.longitude.toString()
          }));
        }
      } catch (e) {
        console.log("Native geocode error:", e);
      }

      try {
        const res = await axios.get(`https://nominatim.openstreetmap.org/search`, {
          params: { 
            q: `${text}, Northwest Region, Cameroon`, 
            format: 'json', 
            limit: 3,
            countrycodes: 'cm',
            addressdetails: 1
          },
          headers: { 'User-Agent': 'eRideApp/1.0' }
        });
        
        // Format the search results to look cleaner
        const formattedResults = res.data.map((item: any) => {
          if (item.address) {
            const a = item.address;
            const parts = [];
            if (a.neighbourhood) parts.push(a.neighbourhood);
            if (a.suburb) parts.push(a.suburb);
            if (a.road) parts.push(a.road);
            if (a.village) parts.push(a.village);
            else if (a.town) parts.push(a.town);
            else if (a.city) parts.push(a.city);
            
            return {
              ...item,
              clean_name: parts.length > 0 ? parts.slice(0, 3).join(', ') : item.display_name.split(',').slice(0, 2).join(', ')
            };
          }
          return { ...item, clean_name: item.display_name };
        });
        
        // Merge Local Matches (at the top), Native OS Map Matches, and API results
        setSearchResults([...localMatches, ...nativeResults, ...formattedResults]);
      } catch (e) {
        setSearchResults([...localMatches, ...nativeResults]); // Fallback if Nominatim fails

      }
    }, 500);
  };

  const handleSelectDestination = (location: any) => {
    setDropoff(location.clean_name || location.display_name);
    setSearchResults([]);
    handlePreviewRoute(location);
  };

  const handlePreviewRoute = async (selectedDest?: any) => {
    if (!pickup || (!dropoff && !selectedDest)) {
      Alert.alert('Error', 'Please enter pickup and dropoff locations');
      return;
    }
    
    setLoading(true);
    try {
      let pickupCoords;
      if (pickup === currentLocationName) {
        // User hasn't changed the reverse-geocoded pickup, use exact GPS
        pickupCoords = { lat: region.latitude, lng: region.longitude };
      } else {
        pickupCoords = await geocodeLocation(pickup) || { lat: region.latitude, lng: region.longitude };
      }
      
      let dropoffCoords;
      if (selectedDest) {
        dropoffCoords = { lat: parseFloat(selectedDest.lat), lng: parseFloat(selectedDest.lon) };
      } else {
        dropoffCoords = await geocodeLocation(dropoff);
      }
      
      if (!dropoffCoords) {
        Alert.alert('Error', 'Could not find destination');
        return;
      }

      // 1. Get Route from OSRM
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pickupCoords.lng},${pickupCoords.lat};${dropoffCoords.lng},${dropoffCoords.lat}?overview=full&geometries=geojson`;
      const routeRes = await axios.get(osrmUrl);
      const route = routeRes.data.routes[0];
      const distanceKm = route.distance / 1000;
      
      const coords = route.geometry.coordinates.map((c: any) => ({
        latitude: c[1],
        longitude: c[0]
      }));
      // Ensure the visual line connects exactly to the doorstep coordinates
      coords.unshift({ latitude: pickupCoords.lat, longitude: pickupCoords.lng });
      coords.push({ latitude: dropoffCoords.lat, longitude: dropoffCoords.lng });
      setRouteCoords(coords);

      // 2. Get Estimates from Backend
      const estRes = await axios.post(`${API_URL}/rides/estimate`, { distanceKm }, { headers: { Authorization: `Bearer ${token}` } });
      setEstimates(estRes.data);
      
      setStep('PREVIEW');
    } catch (error) {
      Alert.alert('Error', 'Failed to calculate route');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRide = async () => {
    setLoading(true);
    try {
      let pickupCoords;
      if (pickup === currentLocationName) {
        pickupCoords = { lat: region.latitude, lng: region.longitude };
      } else {
        pickupCoords = await geocodeLocation(pickup) || { lat: region.latitude, lng: region.longitude };
      }
      
      const dropoffCoords = await geocodeLocation(dropoff) || { lat: region.latitude + 0.01, lng: region.longitude + 0.01 };

      const res = await axios.post(
        `${API_URL}/rides/request`,
        {
          pickupLat: pickupCoords.lat,
          pickupLng: pickupCoords.lng,
          pickupAddress: pickup,
          dropoffLat: dropoffCoords.lat,
          dropoffLng: dropoffCoords.lng,
          dropoffAddress: dropoff,
          paymentMethod,
          vehicleType,
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      router.push(`/(app)/ride/${res.data.id}`);
    } catch (error: any) {
      Alert.alert('Request Failed', error.response?.data?.message || 'Failed to request ride');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <MapView 
        style={styles.map} 
        region={region}
        showsUserLocation={true}
        mapType="none" // Hides the default map provider base layer to show only custom tiles
      >
        <UrlTile
          urlTemplate="https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
        />
        {routeCoords.length > 0 && (
          <Polyline 
            coordinates={routeCoords}
            strokeColor="#1A1A1A"
            strokeWidth={4}
          />
        )}
        {routeCoords.length > 0 && (
          <Marker coordinate={routeCoords[routeCoords.length - 1]} title="Destination" />
        )}
        
        {/* Render Live Drivers */}
        {availableDrivers.map((driver) => (
          <Marker 
            key={driver.id}
            coordinate={{ latitude: driver.lat, longitude: driver.lng }}
            title={`${driver.type} Driver`}
            pinColor={driver.type === 'PREMIUM' ? 'black' : driver.type === 'ECONOMY' ? 'yellow' : 'blue'}
          />
        ))}
      </MapView>

      <KeyboardAvoidingView 
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        <View style={styles.header}>
          <Image source={require('../../assets/images/logo.png')} style={styles.headerLogo} />
          <View style={styles.userInfo}>
            <Text style={styles.greeting}>Hello, {user?.name}</Text>
            <Text style={styles.subtitle}>Where are you going today?</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(app)/profile')} style={styles.logoutButton}>
            <User size={20} color="#1A1A1A" />
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <MapPin size={20} color="#666" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Pickup Location"
              value={pickup}
              onChangeText={setPickup}
              placeholderTextColor="#999"
            />
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.inputGroup}>
            <Navigation size={20} color="#1A1A1A" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Destination"
              value={dropoff}
              onChangeText={handleDestinationSearch}
              placeholderTextColor="#999"
            />
          </View>

          {searchResults.length > 0 && (
            <ScrollView style={styles.searchResultsContainer}>
              {searchResults.map((item, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.searchResultItem}
                  onPress={() => handleSelectDestination(item)}
                >
                  <MapPin size={16} color="#666" style={{ marginRight: 8 }} />
                  <Text style={styles.searchResultText} numberOfLines={2}>{item.clean_name || item.display_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {step === 'SEARCH' ? (
            <TouchableOpacity 
              style={[styles.button, { marginTop: 24 }, loading && styles.buttonDisabled]} 
              onPress={() => handlePreviewRoute()}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Preview Route</Text>}
            </TouchableOpacity>
          ) : (
            <>
              <View style={styles.vehicleTypeContainer}>
                <Text style={styles.paymentLabel}>Select Vehicle Class</Text>
                <View style={styles.vehicleOptions}>
                  {[
                    { type: 'ECONOMY', label: 'Economy', desc: 'Basic', price: estimates?.ECONOMY },
                    { type: 'STANDARD', label: 'Standard', desc: 'Comfort', price: estimates?.STANDARD },
                    { type: 'PREMIUM', label: 'Premium', desc: 'VIP', price: estimates?.PREMIUM }
                  ].map(v => (
                    <TouchableOpacity 
                      key={v.type}
                      style={[styles.vehicleOption, vehicleType === v.type && styles.vehicleOptionActive]}
                      onPress={() => setVehicleType(v.type as any)}
                    >
                      <Text style={[styles.vehicleOptionText, vehicleType === v.type && styles.vehicleOptionTextActive]}>{v.label}</Text>
                      <Text style={[styles.vehicleOptionDesc, vehicleType === v.type && styles.vehicleOptionTextActive]}>XAF {v.price}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.paymentMethodContainer}>
                <Text style={styles.paymentLabel}>Payment Method</Text>
                <View style={styles.paymentOptions}>
                  <TouchableOpacity 
                    style={[styles.paymentOption, paymentMethod === 'CASH' && styles.paymentOptionActive]}
                    onPress={() => setPaymentMethod('CASH')}
                  >
                    <Text style={[styles.paymentOptionText, paymentMethod === 'CASH' && styles.paymentOptionTextActive]}>Cash</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.paymentOption, paymentMethod === 'NKWAPAY' && styles.paymentOptionActive]}
                    onPress={() => setPaymentMethod('NKWAPAY')}
                  >
                    <Text style={[styles.paymentOptionText, paymentMethod === 'NKWAPAY' && styles.paymentOptionTextActive]}>Mobile Money</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.button, loading && styles.buttonDisabled]} 
                onPress={handleRequestRide}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Confirm Ride</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
    pointerEvents: 'box-none',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 16,
    borderRadius: 16,
    marginTop: Platform.OS === 'android' ? 40 : 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  headerLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  logoutButton: {
    padding: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    paddingVertical: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginLeft: 36,
    marginVertical: 8,
  },
  searchResultsContainer: {
    marginTop: 8,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    maxHeight: 250,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
  },
  searchResultText: {
    fontSize: 14,
    color: '#1A1A1A',
    flex: 1,
  },
  vehicleTypeContainer: {
    marginTop: 16,
  },
  vehicleOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  vehicleOption: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    backgroundColor: '#FAFAFA',
  },
  vehicleOptionActive: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
  },
  vehicleOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  vehicleOptionDesc: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  vehicleOptionTextActive: {
    color: '#FFF',
  },
  paymentMethodContainer: {
    marginTop: 16,
    marginBottom: 24,
  },
  paymentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  paymentOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentOption: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  paymentOptionActive: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
  },
  paymentOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  paymentOptionTextActive: {
    color: '#FFF',
  },
  button: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
