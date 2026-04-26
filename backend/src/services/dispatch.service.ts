import { io, activeDrivers } from '../index.js';

interface PendingRide {
  rideId: string;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  estimatedFare: number;
  requestedType: string;
  rejectedDrivers: Set<string>;
  currentDriverId: string | null;
  timeoutId: NodeJS.Timeout | null;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

class DispatchEngine {
  private queue = new Map<string, PendingRide>();

  public async startDispatch(ride: any) {
    this.queue.set(ride.id, {
      rideId: ride.id,
      pickupLat: ride.pickupLocation.lat,
      pickupLng: ride.pickupLocation.lng,
      pickupAddress: ride.pickupLocation.address,
      estimatedFare: ride.estimatedFare,
      requestedType: ride.requestedType,
      rejectedDrivers: new Set(),
      currentDriverId: null,
      timeoutId: null
    });
    console.log(`[Dispatch] Starting targeted dispatch for ride ${ride.id}`);
    this.dispatchNext(ride.id);
  }

  private dispatchNext(rideId: string) {
    const pending = this.queue.get(rideId);
    if (!pending) return;

    let nearestDriverId: string | null = null;
    let minDistance = Infinity;

    for (const [driverId, data] of activeDrivers.entries()) {
      if (pending.rejectedDrivers.has(driverId)) continue;
      
      const dist = haversineDistance(pending.pickupLat, pending.pickupLng, data.lat, data.lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearestDriverId = driverId;
      }
    }

    if (!nearestDriverId) {
      console.log(`[Dispatch] No available drivers for ride ${rideId}.`);
      io.to(`ride:${rideId}`).emit('no_drivers_found', { rideId });
      this.queue.delete(rideId);
      return;
    }

    console.log(`[Dispatch] Pinging nearest driver ${nearestDriverId} for ride ${rideId} (Dist: ${minDistance.toFixed(2)}km)`);
    pending.currentDriverId = nearestDriverId;
    
    // Emit targeted request
    io.to(nearestDriverId).emit('targeted_ride_request', {
      rideId: pending.rideId,
      pickup: { address: pending.pickupAddress, lat: pending.pickupLat, lng: pending.pickupLng },
      estimatedFare: pending.estimatedFare,
      requestedType: pending.requestedType,
      expiresIn: 15
    });

    // Set 15s timeout
    pending.timeoutId = setTimeout(() => {
      console.log(`[Dispatch] Driver ${nearestDriverId} timed out on ride ${rideId}`);
      this.handleDriverReject(rideId, nearestDriverId!);
    }, 15000);
  }

  public handleDriverReject(rideId: string, driverId: string) {
    const pending = this.queue.get(rideId);
    if (!pending || pending.currentDriverId !== driverId) return;

    if (pending.timeoutId) clearTimeout(pending.timeoutId);
    pending.rejectedDrivers.add(driverId);
    
    io.to(driverId).emit('request_expired', { rideId });
    this.dispatchNext(rideId);
  }

  public handleDriverAccept(rideId: string, driverId: string) {
    const pending = this.queue.get(rideId);
    if (!pending) return;

    console.log(`[Dispatch] Driver ${driverId} accepted ride ${rideId}`);
    if (pending.timeoutId) clearTimeout(pending.timeoutId);
    this.queue.delete(rideId);
  }

  public cancelDispatch(rideId: string) {
    const pending = this.queue.get(rideId);
    if (pending) {
      if (pending.timeoutId) clearTimeout(pending.timeoutId);
      if (pending.currentDriverId) {
        io.to(pending.currentDriverId).emit('request_expired', { rideId });
      }
      this.queue.delete(rideId);
    }
  }
}

export const dispatchService = new DispatchEngine();
