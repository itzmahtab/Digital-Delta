/**
 * Module 8: Fleet & Drone Handoff Service
 * 
 * Handles:
 * 1. Location identification for drone delivery
 * 2. Rendezvous point optimization
 * 3. Secure cryptographic handoff verification
 * 4. Fleet-drone coordination
 * 5. Delivery ownership transfer
 */

import crypto from 'crypto';

/**
 * Service 1: Location Identifier
 * Identifies which delivery locations require drone delivery
 */
export class DroneLocationIdentifier {
  constructor(config = {}) {
    // Sylhet region parameters
    this.floodedAreas = config.floodedAreas || [];
    this.roadAccessibility = config.roadAccessibility || {}; // location_id -> accessibility_score
    this.droneRange = config.droneRange || 50000; // meters, ~50km
    this.urgencyWeights = config.urgencyWeights || {
      critical: 1.0,    // Medical, life-saving
      high: 0.8,        // Stranded people, shelter
      medium: 0.6,      // Food, water
      low: 0.4           // Non-urgent supplies
    };
    this.inaccessibilityThreshold = config.inaccessibilityThreshold || 0.3; // 30% accessibility = drone needed
  }

  /**
   * Identify all deliveries that should use drone delivery
   * Returns: array of location objects with drone_recommended flag
   */
  identifyDroneLocations(deliveries, fleetHub) {
    return deliveries.map(delivery => {
      const score = this.calculateDroneScore(delivery, fleetHub);
      
      return {
        id: delivery.id,
        location: delivery.location,
        coordinates: delivery.coordinates,
        urgency: delivery.urgency,
        items_weight: delivery.items_weight,
        accessibility_score: this.getAccessibilityScore(delivery.location),
        road_blocked: this.isRoadBlocked(delivery.location),
        drone_distance_m: this.calculateDistance(fleetHub, delivery.coordinates),
        within_drone_range: this.calculateDistance(fleetHub, delivery.coordinates) <= this.droneRange,
        drone_score: score,
        drone_recommended: score >= 0.6,
        recommendation_reason: this.getRecommendationReason(delivery, score),
        estimated_delivery_time_minutes: this.estimateDeliveryTime(delivery, 'drone'),
        vehicle_delivery_time_minutes: this.estimateDeliveryTime(delivery, 'vehicle')
      };
    });
  }

  /**
   * Calculate drone delivery suitability score (0-1)
   * Factors:
   * - Road accessibility (primary indicator)
   * - Urgency level
   * - Item weight
   * - Drone range
   * - Distance from hub
   */
  calculateDroneScore(delivery, fleetHub) {
    let score = 0;

    // Factor 1: Road Accessibility (40% weight)
    const accessibility = this.getAccessibilityScore(delivery.location);
    const accessibilityFactor = 1 - accessibility; // Lower accessibility = higher drone score
    score += accessibilityFactor * 0.4;

    // Factor 2: Urgency (30% weight)
    const urgencyMultiplier = this.urgencyWeights[delivery.urgency] || 0.5;
    score += urgencyMultiplier * 0.3;

    // Factor 3: Item Weight (20% weight)
    // Drones can carry ~5kg, trucks unlimited
    const weight = delivery.items_weight || 0;
    const weightFactor = weight <= 5 ? 1.0 : Math.max(0, 1 - (weight - 5) / 50);
    score += weightFactor * 0.2;

    // Factor 4: Range Feasibility (10% weight)
    const distance = this.calculateDistance(fleetHub, delivery.coordinates);
    const rangeFactor = Math.max(0, 1 - (distance / this.droneRange));
    score += rangeFactor * 0.1;

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Check if road is blocked to location
   */
  isRoadBlocked(location) {
    // In disaster, check if location is in flooded area
    return this.floodedAreas.some(area => 
      this.isLocationInArea(location, area)
    );
  }

  /**
   * Get accessibility score (0-1)
   * 0 = completely inaccessible
   * 1 = fully accessible
   */
  getAccessibilityScore(location) {
    return this.roadAccessibility[location] || 0.5;
  }

  /**
   * Get human-readable reason for drone recommendation
   */
  getRecommendationReason(delivery, score) {
    if (score >= 0.9) return 'Critical: Road blocked, urgent supplies, drone optimal';
    if (score >= 0.8) return 'High: Road access limited, faster delivery via drone';
    if (score >= 0.7) return 'Medium: Road conditions poor, drone recommended';
    if (score >= 0.6) return 'Moderate: Drone delivery viable and faster';
    return 'Not recommended: Vehicle delivery preferred';
  }

  /**
   * Estimate delivery time
   */
  estimateDeliveryTime(delivery, method) {
    if (method === 'drone') {
      // Drones faster but limited range
      // Average drone speed: 40 km/h
      // Plus prep time: 3 min
      const distance = delivery.drone_distance_m || 10000;
      return Math.ceil((distance / 40000) * 60 + 3);
    } else {
      // Vehicle slower but reliable
      // Average vehicle speed: 20 km/h in disaster conditions
      // Plus traffic delays
      const distance = delivery.drone_distance_m || 10000;
      return Math.ceil((distance / 20000) * 60 + 10);
    }
  }

  /**
   * Distance calculation (Haversine formula)
   */
  calculateDistance(point1, point2) {
    const R = 6371000; // Earth radius in meters
    const lat1 = parseFloat(point1.latitude || point1.lat || 0);
    const lon1 = parseFloat(point1.longitude || point1.lng || 0);
    const lat2 = parseFloat(point2.latitude || point2.lat || 0);
    const lon2 = parseFloat(point2.longitude || point2.lng || 0);

    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Check if location is in area
   */
  isLocationInArea(location, area) {
    // Simple bounding box check
    const lat = parseFloat(location.latitude || location.lat || 0);
    const lon = parseFloat(location.longitude || location.lng || 0);
    return lat >= area.minLat && lat <= area.maxLat && 
           lon >= area.minLon && lon <= area.maxLon;
  }
}

/**
 * Service 2: Rendezvous Point Optimizer
 * Computes optimal meeting point between fleet vehicle and drone
 */
export class RendezvousOptimizer {
  constructor(config = {}) {
    this.droneSpeed = config.droneSpeed || 40; // km/h
    this.vehicleSpeed = config.vehicleSpeed || 20; // km/h (disaster conditions)
    this.handoffBufferMinutes = config.handoffBufferMinutes || 5;
  }

  /**
   * Calculate optimal rendezvous point
   * Minimizes:
   * - Combined travel time (truck + drone)
   * - Deviation from direct route
   * - Waiting time at rendezvous
   * 
   * Returns: {
   *   rendezvous_point: { latitude, longitude },
   *   truck_arrival_time_minutes: number,
   *   drone_arrival_time_minutes: number,
   *   wait_time_minutes: number,
   *   deviation_from_route_meters: number,
   *   efficiency_score: 0-1
   * }
   */
  computeRendezvous(truckLocation, droneHub, deliveryLocation, truckRoute = []) {
    // Algorithm: Find point that minimizes max(truck_time, drone_time)
    // while staying close to truck's planned route

    // Start with destination as baseline
    let bestPoint = deliveryLocation;
    let bestScore = Infinity;

    // Sample points along truck route
    const routePoints = this.sampleRoutePoints(truckRoute, 20); // 20 samples
    
    routePoints.forEach(point => {
      const score = this.evaluateRendezvousPoint(
        point, 
        truckLocation, 
        droneHub, 
        deliveryLocation,
        truckRoute
      );
      
      if (score.efficiency_score > bestScore) {
        bestPoint = point;
        bestScore = score.efficiency_score;
      }
    });

    return {
      rendezvous_point: bestPoint,
      ...this.evaluateRendezvousPoint(bestPoint, truckLocation, droneHub, deliveryLocation, truckRoute)
    };
  }

  /**
   * Evaluate a candidate rendezvous point
   */
  evaluateRendezvousPoint(point, truckLocation, droneHub, deliveryLocation, truckRoute) {
    // Time for truck to reach rendezvous
    const truckDistanceToRendezvous = this.calculateDistance(truckLocation, point);
    const truckTimeMinutes = (truckDistanceToRendezvous / 1000) / this.vehicleSpeed * 60;

    // Time for drone to reach rendezvous
    const droneDistanceToRendezvous = this.calculateDistance(droneHub, point);
    const droneTimeMinutes = (droneDistanceToRendezvous / 1000) / this.droneSpeed * 60;

    // Wait time (whoever arrives first waits)
    const waitTime = Math.abs(truckTimeMinutes - droneTimeMinutes);

    // Deviation from direct truck route
    const deviationMeters = this.calculateDeviationFromRoute(point, truckRoute);

    // Efficiency score (higher is better)
    // Minimize: max(truck_time, drone_time) + wait_penalty + deviation_penalty
    const maxArrivalTime = Math.max(truckTimeMinutes, droneTimeMinutes);
    const totalTime = maxArrivalTime + waitTime;
    const deviationPenalty = deviationMeters / 1000; // Convert to km
    
    const efficiency = 1 / (1 + totalTime + deviationPenalty / 10);

    return {
      truck_arrival_time_minutes: Math.ceil(truckTimeMinutes),
      drone_arrival_time_minutes: Math.ceil(droneTimeMinutes),
      wait_time_minutes: Math.ceil(waitTime),
      deviation_from_route_meters: Math.round(deviationMeters),
      efficiency_score: efficiency,
      max_arrival_minutes: Math.ceil(maxArrivalTime),
      total_operation_time_minutes: Math.ceil(maxArrivalTime + this.handoffBufferMinutes)
    };
  }

  /**
   * Sample points along a route
   */
  sampleRoutePoints(route, numSamples) {
    if (!route || route.length === 0) return [];
    
    const points = [];
    const step = Math.max(1, Math.floor(route.length / numSamples));
    
    for (let i = 0; i < route.length; i += step) {
      points.push(route[i]);
    }
    
    return points;
  }

  /**
   * Calculate deviation from route
   */
  calculateDeviationFromRoute(point, route) {
    if (!route || route.length < 2) return 0;

    let minDeviation = Infinity;

    // Find closest segment in route
    for (let i = 0; i < route.length - 1; i++) {
      const deviation = this.pointToSegmentDistance(
        point,
        route[i],
        route[i + 1]
      );
      minDeviation = Math.min(minDeviation, deviation);
    }

    return minDeviation;
  }

  /**
   * Calculate perpendicular distance from point to line segment
   */
  pointToSegmentDistance(point, segStart, segEnd) {
    const A = point.latitude || point.lat || 0;
    const B = point.longitude || point.lng || 0;
    const C = segStart.latitude || segStart.lat || 0;
    const D = segStart.longitude || segStart.lng || 0;
    const E = segEnd.latitude || segEnd.lat || 0;
    const F = segEnd.longitude || segEnd.lng || 0;

    const num = Math.abs((F - D) * A - (E - C) * B + E * D - F * C);
    const denom = Math.sqrt(Math.pow(F - D, 2) + Math.pow(E - C, 2));
    
    return denom === 0 ? 0 : (num / denom) * 111000; // Convert degrees to meters
  }

  /**
   * Distance calculation (Haversine)
   */
  calculateDistance(point1, point2) {
    const R = 6371000; // Earth radius in meters
    const lat1 = parseFloat(point1.latitude || point1.lat || 0);
    const lon1 = parseFloat(point1.longitude || point1.lng || 0);
    const lat2 = parseFloat(point2.latitude || point2.lat || 0);
    const lon2 = parseFloat(point2.longitude || point2.lng || 0);

    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

/**
 * Service 3: Secure Drone Handoff Verification
 * Handles cryptographic verification of ownership transfer
 */
export class SecureDroneHandoff {
  constructor(config = {}) {
    this.algorithm = config.algorithm || 'SHA256';
    this.signatureAlgorithm = config.signatureAlgorithm || 'RSA';
    this.tokenExpiry = config.tokenExpiry || 3600000; // 1 hour in milliseconds
  }

  /**
   * Create a cryptographic handoff token
   * This token:
   * - Proves the drone has delivery id
   * - Proves the truck is authorized to receive it
   * - Cannot be forged without private keys
   * - Expires after handoff period
   * 
   * Returns: {
   *   handoff_token: string (JWT-like),
   *   signature: string,
   *   qr_code_data: string (for scanning),
   *   expiry_time: timestamp,
   *   validity_minutes: number
   * }
   */
  createHandoffToken(droneId, deliveryId, truckId, rendezvousPoint, dronePrivateKey) {
    // Create payload
    const timestamp = Date.now();
    const expiryTime = timestamp + this.tokenExpiry;

    const payload = {
      type: 'drone_handoff',
      drone_id: droneId,
      delivery_id: deliveryId,
      truck_id: truckId,
      rendezvous_point: rendezvousPoint,
      created_at: timestamp,
      expires_at: expiryTime,
      version: '1.0'
    };

    // Create signature (drone proves it created this)
    const payloadString = JSON.stringify(payload);
    const signature = this.createSignature(payloadString, dronePrivateKey);

    // Create token (Base64 encoded payload + signature)
    const token = Buffer.from(payloadString).toString('base64') + '.' + signature;

    // Create QR code data (compact representation)
    const qrData = {
      token: token,
      delivery_id: deliveryId,
      truck_id: truckId
    };

    return {
      handoff_token: token,
      signature: signature,
      qr_code_data: JSON.stringify(qrData),
      expiry_time: expiryTime,
      validity_minutes: Math.round(this.tokenExpiry / 60000),
      payload: payload
    };
  }

  /**
   * Verify handoff token at rendezvous point
   * Truck scans QR code, verifies token is valid and authentic
   * 
   * Returns: {
   *   valid: boolean,
   *   verified: boolean,
   *   expiry_valid: boolean,
   *   signature_valid: boolean,
   *   reason: string,
   *   payload: object (if valid)
   * }
   */
  verifyHandoffToken(token, dronePublicKey) {
    try {
      const parts = token.split('.');
      if (parts.length !== 2) {
        return {
          valid: false,
          verified: false,
          reason: 'Invalid token format (missing signature)'
        };
      }

      const [payloadB64, signature] = parts;
      const payloadString = Buffer.from(payloadB64, 'base64').toString('utf8');
      const payload = JSON.parse(payloadString);

      // Check expiry
      const now = Date.now();
      const expiryValid = payload.expires_at > now;

      if (!expiryValid) {
        return {
          valid: false,
          verified: false,
          expiry_valid: false,
          reason: 'Token expired'
        };
      }

      // Verify signature
      const signatureValid = this.verifySignature(payloadString, signature, dronePublicKey);

      if (!signatureValid) {
        return {
          valid: false,
          verified: false,
          expiry_valid: true,
          signature_valid: false,
          reason: 'Signature verification failed (token tampered or wrong key)'
        };
      }

      return {
        valid: true,
        verified: true,
        expiry_valid: true,
        signature_valid: true,
        reason: 'Token valid and verified',
        payload: payload,
        time_remaining_minutes: Math.round((payload.expires_at - now) / 60000)
      };
    } catch (error) {
      return {
        valid: false,
        verified: false,
        reason: `Token parsing error: ${error.message}`
      };
    }
  }

  /**
   * Create signature using private key
   */
  createSignature(data, privateKey) {
    try {
      // For demo: use HMAC SHA256
      // In production: use RSA or Ed25519
      const hash = crypto
        .createHmac('sha256', privateKey)
        .update(data)
        .digest('hex');
      return hash;
    } catch (error) {
      console.error('Signature creation failed:', error);
      return '';
    }
  }

  /**
   * Verify signature using public key
   */
  verifySignature(data, signature, publicKey) {
    try {
      // For demo: use HMAC SHA256 (same key as private)
      // In production: use RSA or Ed25519
      const hash = crypto
        .createHmac('sha256', publicKey)
        .update(data)
        .digest('hex');
      return hash === signature;
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Create ownership transfer record
   * Records who had package and when
   */
  createOwnershipTransfer(deliveryId, fromParty, toParty, rendezvousPoint, handoffToken) {
    return {
      id: `transfer_${deliveryId}_${Date.now()}`,
      delivery_id: deliveryId,
      from: {
        party_type: fromParty.type, // 'drone'
        party_id: fromParty.id,
        timestamp: Date.now()
      },
      to: {
        party_type: toParty.type, // 'truck'
        party_id: toParty.id,
        timestamp: Date.now()
      },
      location: rendezvousPoint,
      handoff_token_used: handoffToken,
      verified: true,
      signed_by: [fromParty.id, toParty.id],
      audit_log: {
        token_created_by: fromParty.id,
        token_verified_by: toParty.id,
        verification_passed_at: Date.now()
      }
    };
  }

  /**
   * Get handoff audit trail for a delivery
   */
  createAuditTrail(delivery, transfers) {
    return {
      delivery_id: delivery.id,
      initial_source: delivery.source,
      final_destination: delivery.destination,
      transfers: transfers.map(t => ({
        id: t.id,
        from: t.from,
        to: t.to,
        location: t.location,
        timestamp: t.from.timestamp,
        verified: t.verified
      })),
      full_chain: transfers.map(t => `${t.from.party_id} → ${t.to.party_id}`).join(' → '),
      total_transfers: transfers.length,
      fully_auditable: transfers.every(t => t.verified)
    };
  }
}

/**
 * Service 4: Fleet-Drone Coordinator
 * Orchestrates the entire handoff process
 */
export class FleetDroneCoordinator {
  constructor(config = {}) {
    this.droneLocationIdentifier = new DroneLocationIdentifier(config.locationConfig);
    this.rendezvousOptimizer = new RendezvousOptimizer(config.rendezvousConfig);
    this.secureHandoff = new SecureDroneHandoff(config.securityConfig);
    this.activeHandoffs = new Map(); // delivery_id -> handoff_state
  }

  /**
   * Start complete handoff process
   * 1. Identify drone-suitable deliveries
   * 2. Compute rendezvous point
   * 3. Generate verification tokens
   * 4. Coordinate fleet and drone
   */
  initiateHandoff(delivery, droneHub, truckLocation, truckRoute, droneId, truckId, dronePrivateKey) {
    // Step 1: Verify this delivery should use drone
    const droneSuitability = this.droneLocationIdentifier.calculateDroneScore(
      delivery, 
      droneHub
    );

    if (droneSuitability < 0.5) {
      return {
        success: false,
        reason: 'Delivery not suitable for drone delivery',
        score: droneSuitability
      };
    }

    // Step 2: Calculate rendezvous
    const rendezvous = this.rendezvousOptimizer.computeRendezvous(
      truckLocation,
      droneHub,
      delivery.coordinates,
      truckRoute
    );

    // Step 3: Create verification token
    const handoffToken = this.secureHandoff.createHandoffToken(
      droneId,
      delivery.id,
      truckId,
      rendezvous.rendezvous_point,
      dronePrivateKey
    );

    // Step 4: Store state
    const handoffState = {
      delivery_id: delivery.id,
      drone_id: droneId,
      truck_id: truckId,
      rendezvous_point: rendezvous.rendezvous_point,
      handoff_token: handoffToken,
      status: 'initiated',
      created_at: Date.now(),
      scheduled_handoff_time: Date.now() + (rendezvous.max_arrival_minutes * 60 * 1000),
      truck_arrival_minutes: rendezvous.truck_arrival_time_minutes,
      drone_arrival_minutes: rendezvous.drone_arrival_time_minutes,
      wait_time_minutes: rendezvous.wait_time_minutes
    };

    this.activeHandoffs.set(delivery.id, handoffState);

    return {
      success: true,
      handoff_id: delivery.id,
      drone_suitability_score: droneSuitability,
      rendezvous: rendezvous,
      handoff_token: handoffToken,
      status: handoffState
    };
  }

  /**
   * Complete the handoff at rendezvous point
   */
  completeHandoff(deliveryId, droneId, truckId, verificationToken, dronePublicKey) {
    const handoffState = this.activeHandoffs.get(deliveryId);
    
    if (!handoffState) {
      return {
        success: false,
        reason: 'No active handoff found for this delivery'
      };
    }

    // Verify token
    const verification = this.secureHandoff.verifyHandoffToken(verificationToken, dronePublicKey);

    if (!verification.verified) {
      return {
        success: false,
        verified: false,
        reason: verification.reason
      };
    }

    // Create ownership transfer
    const transfer = this.secureHandoff.createOwnershipTransfer(
      deliveryId,
      { type: 'drone', id: droneId },
      { type: 'truck', id: truckId },
      handoffState.rendezvous_point,
      verificationToken
    );

    // Update state
    handoffState.status = 'completed';
    handoffState.completed_at = Date.now();
    handoffState.owner_transfer = transfer;

    return {
      success: true,
      verified: true,
      delivery_id: deliveryId,
      ownership_transfer: transfer,
      handoff_status: handoffState
    };
  }

  /**
   * Get all active handoffs
   */
  getActiveHandoffs() {
    return Array.from(this.activeHandoffs.values())
      .filter(h => h.status !== 'completed');
  }

  /**
   * Get handoff status
   */
  getHandoffStatus(deliveryId) {
    return this.activeHandoffs.get(deliveryId);
  }

  /**
   * Cancel handoff
   */
  cancelHandoff(deliveryId, reason) {
    const handoffState = this.activeHandoffs.get(deliveryId);
    
    if (!handoffState) {
      return { success: false, reason: 'No active handoff' };
    }

    handoffState.status = 'cancelled';
    handoffState.cancelled_at = Date.now();
    handoffState.cancellation_reason = reason;

    return { success: true, handoff_state: handoffState };
  }
}
