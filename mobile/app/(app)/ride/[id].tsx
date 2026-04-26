import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal } from 'react-native';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { Send, ArrowLeft, AlertTriangle, Star, MessageSquare, X } from 'lucide-react-native';
import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { io, Socket } from 'socket.io-client';
import MapView, { UrlTile, Marker, Polyline } from '../../../src/components/MapView';

const API_URL = 'http://192.168.1.187:5000/api';
const SOCKET_URL = 'http://192.168.1.187:5000';

interface Message {
  id: string;
  content: string;
  senderId: string;
  sender: { id: string; name: string; role: string };
  createdAt: string;
}

interface Ride {
  id: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  estimatedFare: number;
  pickupLocation: { lat: number; lng: number; address: string };
  dropoffLocation: { lat: number; lng: number; address: string };
  riderId: string;
  driverId?: string;
  rider: { name: string; phone: string };
  driver?: { name: string; phone: string };
}

export default function RideStatus() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, token } = useAuthStore();
  const router = useRouter();
  
  const [ride, setRide] = useState<Ride | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [hasRated, setHasRated] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);
  const [availableDrivers, setAvailableDrivers] = useState<{id: string, lat: number, lng: number, type: string}[]>([]);
  const [routeCoords, setRouteCoords] = useState<{latitude: number, longitude: number}[]>([]);

  useEffect(() => {
    fetchRide();
    fetchMessages();

    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join_ride', id);
      newSocket.emit('join_user', user?.id);
    });

    newSocket.on('new_message', (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    });

    newSocket.on('available_drivers', (drivers) => {
      // Only care about available drivers if the ride is pending
      setAvailableDrivers(drivers);
    });

    newSocket.on('ride_update', (data: { rideId: string, status: string }) => {
      if (data.rideId === id) {
        setRide((prev) => prev ? { ...prev, status: data.status } : null);
        fetchRide(); // Auto-refresh ride to get assigned driver details instantly
      }
    });

    return () => {
      newSocket.emit('leave_ride', id);
      newSocket.disconnect();
    };
  }, [id, user]);

  const fetchRide = async () => {
    try {
      const res = await axios.get(`${API_URL}/rides/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      const fetchedRide = res.data;
      setRide(fetchedRide);

      if (routeCoords.length === 0 && fetchedRide?.pickupLocation && fetchedRide?.dropoffLocation) {
        const pLng = fetchedRide.pickupLocation.lng;
        const pLat = fetchedRide.pickupLocation.lat;
        const dLng = fetchedRide.dropoffLocation.lng;
        const dLat = fetchedRide.dropoffLocation.lat;
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pLng},${pLat};${dLng},${dLat}?overview=full&geometries=geojson`;
        axios.get(osrmUrl).then(routeRes => {
          if (routeRes.data.routes && routeRes.data.routes.length > 0) {
            const coords = routeRes.data.routes[0].geometry.coordinates.map((c: any) => ({
              latitude: c[1],
              longitude: c[0]
            }));
            // Ensure the visual line starts exactly at pickup and ends exactly at dropoff doorstep
            coords.unshift({ latitude: pLat, longitude: pLng });
            coords.push({ latitude: dLat, longitude: dLng });
            setRouteCoords(coords);
          }
        }).catch(err => console.log('OSRM Error:', err));
      }

    } catch (e) {
      console.log('Error fetching ride', e);
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await axios.get(`${API_URL}/rides/${id}/messages`, { headers: { Authorization: `Bearer ${token}` } });
      setMessages(res.data);
    } catch (e) {
      console.log('Error fetching messages', e);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    try {
      const content = newMessage;
      setNewMessage('');
      await axios.post(`${API_URL}/rides/${id}/messages`, { content }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (e) {
      console.log('Error sending message', e);
    }
  };

  const updateRideStatus = async (status: string) => {
    try {
      await axios.patch(`${API_URL}/rides/${id}/status`, { status }, { headers: { Authorization: `Bearer ${token}` } });
      fetchRide();
    } catch (e) {
      console.log('Error updating status', e);
    }
  };

  const handlePayment = async () => {
    try {
      const res = await axios.post(`${API_URL}/payments/initiate`, { rideId: id, method: ride?.paymentMethod }, { headers: { Authorization: `Bearer ${token}` } });
      alert(res.data.message || 'Payment initiated');
      fetchRide(); // Refresh payment status
    } catch (e: any) {
      alert(e.response?.data?.message || 'Payment failed');
    }
  };

  const submitRating = async () => {
    try {
      await axios.post(`${API_URL}/rides/${id}/rate`, { rating, review }, { headers: { Authorization: `Bearer ${token}` } });
      setHasRated(true);
      alert('Thank you for your feedback!');
    } catch (e: any) {
      alert('Failed to submit rating');
    }
  };

  const handleSOS = () => {
    Alert.alert(
      "EMERGENCY SOS",
      "Do you want to alert local authorities and your emergency contacts?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Call Police (117)", style: "destructive", onPress: () => alert('Calling 117...') }
      ]
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === user?.id;
    return (
      <View style={[styles.messageBubble, isMe ? styles.messageMe : styles.messageThem]}>
        {!isMe && <Text style={styles.senderName}>{item.sender.name}</Text>}
        <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextThem]}>{item.content}</Text>
      </View>
    );
  };

  if (!ride) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A1A1A" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(app)')} style={styles.backButton}>
          <ArrowLeft size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>
            {ride.status === 'ARRIVED' ? (user?.role === 'DRIVER' ? 'You Arrived' : 'Driver Arrived') : `Ride ${ride.status}`}
          </Text>
          {ride.driver && <Text style={styles.headerSubtitle}>with {user?.role === 'RIDER' ? ride.driver.name : ride.rider.name}</Text>}
        </View>
        {(ride.status === 'ACCEPTED' || ride.status === 'ARRIVED' || ride.status === 'ONGOING') ? (
          <TouchableOpacity onPress={handleSOS} style={styles.sosButton}>
            <AlertTriangle size={24} color="#FF3B30" />
          </TouchableOpacity>
        ) : (
          <View style={styles.spacer} />
        )}
      </View>

      {/* MAP */}
      <View style={styles.mapContainer}>
        {ride && (
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: ride.pickupLocation.lat ?? 4.0511,
              longitude: ride.pickupLocation.lng ?? 9.7679,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            mapType="none"
          >
            {/* Draw the Route Line */}
            {routeCoords.length > 0 && (
              <Polyline 
                coordinates={routeCoords} 
                strokeColor="#1A1A1A" 
                strokeWidth={4} 
              />
            )}
            <UrlTile
              urlTemplate="https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
              maximumZ={19}
              flipY={false}
            />
            {/* Pickup Marker */}
            {ride.pickupLocation.lat && ride.pickupLocation.lng && (
              <Marker
                coordinate={{
                  latitude: ride.pickupLocation.lat,
                  longitude: ride.pickupLocation.lng,
                }}
                title="Pickup"
              />
            )}
            {/* Dropoff Marker */}
            {ride.dropoffLocation.lat && ride.dropoffLocation.lng && (
              <Marker
                coordinate={{
                  latitude: ride.dropoffLocation.lat,
                  longitude: ride.dropoffLocation.lng,
                }}
                title="Dropoff"
              />
            )}
            {/* Live Drivers (Only show when pending, OR show specifically the assigned driver) */}
            {ride.status === 'PENDING' ? availableDrivers.map((driver) => (
              <Marker 
                key={driver.id}
                coordinate={{ latitude: driver.lat, longitude: driver.lng }}
                title={`${driver.type} Driver`}
                pinColor={driver.type === 'PREMIUM' ? 'black' : driver.type === 'ECONOMY' ? 'yellow' : 'blue'}
              />
            )) : null}
            
            {/* Show Assigned Driver Location */}
            {(ride.status === 'ACCEPTED' || ride.status === 'ARRIVED' || ride.status === 'ONGOING') && ride.driverId && availableDrivers.find(d => d.id === ride.driverId) && (
              <Marker 
                coordinate={{ 
                  latitude: availableDrivers.find(d => d.id === ride.driverId)!.lat, 
                  longitude: availableDrivers.find(d => d.id === ride.driverId)!.lng 
                }}
                title={ride.driver?.name || "Your Driver"}
                pinColor="green"
              />
            )}
          </MapView>
        )}
      </View>

      {(ride.status === 'PENDING' || ride.status === 'ACCEPTED') && (
        <View style={styles.actionBanner}>
          <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={() => updateRideStatus('CANCELLED')}>
            <Text style={styles.actionButtonText}>Cancel Ride</Text>
          </TouchableOpacity>
        </View>
      )}

      {ride.status === 'CANCELLED' && (
        <View style={styles.actionBanner}>
          <Text style={{ textAlign: 'center', color: '#FF3B30', fontWeight: 'bold' }}>This ride has been cancelled.</Text>
        </View>
      )}

      {user?.role === 'DRIVER' && ride.status === 'ACCEPTED' && (
        <View style={styles.actionBanner}>
          <TouchableOpacity style={styles.actionButton} onPress={() => updateRideStatus('ARRIVED')}>
            <Text style={styles.actionButtonText}>I Have Arrived</Text>
          </TouchableOpacity>
        </View>
      )}

      {user?.role === 'DRIVER' && ride.status === 'ARRIVED' && (
        <View style={styles.actionBanner}>
          <TouchableOpacity style={styles.actionButton} onPress={() => updateRideStatus('ONGOING')}>
            <Text style={styles.actionButtonText}>Start Ride</Text>
          </TouchableOpacity>
        </View>
      )}

      {user?.role === 'DRIVER' && ride.status === 'ONGOING' && (
        <View style={styles.actionBanner}>
          <TouchableOpacity style={styles.actionButton} onPress={() => updateRideStatus('COMPLETED')}>
            <Text style={styles.actionButtonText}>Complete Ride</Text>
          </TouchableOpacity>
        </View>
      )}

      {user?.role === 'RIDER' && ride.status === 'COMPLETED' && ride.paymentStatus === 'PENDING' && (
        <View style={styles.actionBanner}>
          <TouchableOpacity style={styles.actionButton} onPress={handlePayment}>
            <Text style={styles.actionButtonText}>Pay {ride.estimatedFare} XAF via {ride.paymentMethod}</Text>
          </TouchableOpacity>
        </View>
      )}

      {ride.status === 'COMPLETED' && !hasRated && (
        <View style={styles.ratingContainer}>
          <Text style={styles.ratingTitle}>Rate your trip</Text>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)}>
                <Star size={32} color={star <= rating ? "#FFD700" : "#EAEAEA"} fill={star <= rating ? "#FFD700" : "transparent"} />
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.reviewInput}
            placeholder="Write a review (optional)"
            value={review}
            onChangeText={setReview}
            placeholderTextColor="#999"
          />
          <TouchableOpacity style={styles.submitRatingButton} onPress={submitRating}>
            <Text style={styles.actionButtonText}>Submit Rating</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Floating Chat Button */}
      {(ride.status === 'ACCEPTED' || ride.status === 'ARRIVED' || ride.status === 'ONGOING') && (
        <TouchableOpacity 
          style={styles.floatingChatButton} 
          onPress={() => setChatVisible(true)}
        >
          <MessageSquare color="#FFF" size={24} />
          {messages.length > 0 && (
            <View style={styles.chatBadge}>
              <Text style={styles.chatBadgeText}>{messages.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      <Modal visible={chatVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setChatVisible(false)}>
        <SafeAreaView style={styles.chatModalContainer}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatHeaderTitle}>Live Chat</Text>
            <TouchableOpacity onPress={() => setChatVisible(false)} style={styles.closeChatButton}>
              <X size={24} color="#1A1A1A" />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView 
            style={styles.chatContainer} 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          >
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={styles.messageList}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
              onLayout={() => flatListRef.current?.scrollToEnd()}
              ListEmptyComponent={
                <Text style={styles.emptyChatText}>Send a message to your {user?.role === 'RIDER' ? 'driver' : 'rider'}</Text>
              }
            />

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Type your specific dropoff details..."
                value={newMessage}
                onChangeText={setNewMessage}
                placeholderTextColor="#999"
              />
              <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
                <Send size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
    marginTop: Platform.OS === 'android' ? 40 : 0,
  },
  backButton: {
    padding: 8,
  },
  headerTextContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  spacer: {
    width: 40,
  },
  mapContainer: {
    flex: 1,
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
  },
  map: {
    flex: 1,
  },
  actionBanner: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
  },
  actionButton: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  sosButton: {
    padding: 8,
    backgroundColor: '#FFE5E5',
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
  },
  ratingContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
    alignItems: 'center',
  },
  ratingTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  reviewInput: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  submitRatingButton: {
    backgroundColor: '#1A1A1A',
    width: '100%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  chatContainer: {
    flex: 1,
  },
  messageList: {
    padding: 16,
    gap: 12,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  messageMe: {
    alignSelf: 'flex-end',
    backgroundColor: '#1A1A1A',
    borderBottomRightRadius: 4,
  },
  messageThem: {
    alignSelf: 'flex-start',
    backgroundColor: '#EAEAEA',
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
  },
  messageTextMe: {
    color: '#FFF',
  },
  messageTextThem: {
    color: '#1A1A1A',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EAEAEA',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1A1A1A',
    marginRight: 12,
  },
  sendButton: {
    backgroundColor: '#1A1A1A',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingChatButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    backgroundColor: '#1A1A1A',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  chatBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF3B30',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  chatBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  chatModalContainer: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
  },
  chatHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  closeChatButton: {
    padding: 8,
  },
  emptyChatText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
    fontStyle: 'italic',
  },
});
