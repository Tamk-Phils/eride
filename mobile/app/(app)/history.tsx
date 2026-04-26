import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, SafeAreaView, ActivityIndicator, Platform } from 'react-native';
import { useAuthStore } from '../../src/store/useAuthStore';
import { ArrowLeft, MapPin, Calendar, CheckCircle2, XCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';

const API_URL = 'http://192.168.1.187:5000/api';

export default function HistoryScreen() {
  const { token, user } = useAuthStore();
  const router = useRouter();
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_URL}/rides/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRides(res.data);
    } catch (e) {
      console.log('Error fetching history', e);
    } finally {
      setLoading(false);
    }
  };

  const renderRide = ({ item }: { item: any }) => {
    const isCompleted = item.status === 'COMPLETED';
    const isCancelled = item.status === 'CANCELLED';
    const otherParty = user?.role === 'RIDER' ? item.driver?.name : item.rider?.name;
    const date = new Date(item.createdAt).toLocaleDateString();

    return (
      <TouchableOpacity 
        style={styles.rideCard}
        onPress={() => router.push(`/(app)/ride/${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.dateContainer}>
            <Calendar size={16} color="#666" style={styles.icon} />
            <Text style={styles.dateText}>{date}</Text>
          </View>
          <Text style={styles.fareText}>XAF {item.actualFare || item.estimatedFare}</Text>
        </View>

        <View style={styles.locations}>
          <View style={styles.locationRow}>
            <View style={styles.dot} />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.pickupLocation?.address || 'Unknown Pickup'}
            </Text>
          </View>
          <View style={styles.line} />
          <View style={styles.locationRow}>
            <MapPin size={16} color="#1A1A1A" style={styles.iconOffset} />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.dropoffLocation?.address || 'Unknown Destination'}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.statusContainer}>
            {isCompleted ? (
              <CheckCircle2 size={16} color="#34C759" />
            ) : isCancelled ? (
              <XCircle size={16} color="#FF3B30" />
            ) : (
              <ActivityIndicator size="small" color="#007AFF" />
            )}
            <Text style={[
              styles.statusText,
              isCompleted && { color: '#34C759' },
              isCancelled && { color: '#FF3B30' },
              (!isCompleted && !isCancelled) && { color: '#007AFF' }
            ]}>
              {item.status}
            </Text>
          </View>
          {otherParty && (
            <Text style={styles.otherPartyText}>with {otherParty}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ride History</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1A1A1A" />
        </View>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(item) => item.id}
          renderItem={renderRide}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No rides found in your history.</Text>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
    marginTop: Platform.OS === 'android' ? 40 : 0,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  listContainer: {
    padding: 20,
    gap: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
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
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 8,
  },
  dateText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  fareText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  locations: {
    marginBottom: 16,
    paddingLeft: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#666',
    marginRight: 16,
    marginLeft: 4,
  },
  iconOffset: {
    marginLeft: 0,
    marginRight: 12,
  },
  line: {
    width: 1,
    height: 20,
    backgroundColor: '#EAEAEA',
    marginLeft: 7.5,
    marginVertical: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#1A1A1A',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '700',
  },
  otherPartyText: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
});
