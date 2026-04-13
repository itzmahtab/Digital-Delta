/**
 * CRDT (Conflict-free Replicated Data Type) Service
 * Digital Delta Disaster Relief System
 * 
 * Implementation: Last-Write-Wins (LWW) Register with Vector Clocks
 * 
 * Reference: https://crdt.tech/
 */

export class LWWRegister {
  /**
   * LWW Register - Combines timestamp and value
   * 
   * Why LWW for disaster scenario:
   * ✓ Eventual consistency without coordination
   * ✓ Simple conflict resolution (Last write wins)
   * ✓ Works perfectly offline - no internet needed
   * ✓ Deterministic - same resolution on all devices
   * ✓ Fast - O(1) operations
   * 
   * Example: Delivery status update
   * Device A (Node1): Sets status="in_transit" at 10:00:15
   * Device B (Node2): Sets status="delayed" at 10:00:20
   * Result: status="delayed" (later timestamp wins)
   */
  constructor(value = null, timestamp = Date.now(), nodeId = 'local') {
    this.value = value;
    this.timestamp = timestamp;
    this.nodeId = nodeId; // Identity for tiebreaker
  }

  /**
   * Update the register with a new value
   * Returns boolean: true if update was applied, false if rejected
   */
  update(newValue, newTimestamp = Date.now(), newNodeId = 'local') {
    // Apply update if:
    // 1. New timestamp is greater (clearly later)
    if (newTimestamp > this.timestamp) {
      this.value = newValue;
      this.timestamp = newTimestamp;
      this.nodeId = newNodeId;
      return { applied: true, reason: 'newer_timestamp' };
    }
    
    // 2. Same timestamp, but new node ID is lexicographically greater (tiebreaker)
    if (newTimestamp === this.timestamp && newNodeId > this.nodeId) {
      this.value = newValue;
      this.timestamp = newTimestamp;
      this.nodeId = newNodeId;
      return { applied: true, reason: 'tiebreaker_nodeid' };
    }
    
    // Reject if older or same
    return { applied: false, reason: 'older_or_equal' };
  }

  /**
   * Merge two LWW registers (causal consistency)
   * Returns the merged register state
   */
  merge(other) {
    if (other.timestamp > this.timestamp) {
      return new LWWRegister(other.value, other.timestamp, other.nodeId);
    }
    if (other.timestamp === this.timestamp && other.nodeId > this.nodeId) {
      return new LWWRegister(other.value, other.timestamp, other.nodeId);
    }
    return this;
  }

  /**
   * Get current value
   */
  getValue() {
    return this.value;
  }

  /**
   * Serialize for network transmission
   */
  toJSON() {
    return {
      value: this.value,
      timestamp: this.timestamp,
      nodeId: this.nodeId
    };
  }

  /**
   * Deserialize from network
   */
  static fromJSON(json) {
    return new LWWRegister(json.value, json.timestamp, json.nodeId);
  }
}

export class VectorClock {
  /**
   * Vector Clock - Tracks causal ordering
   * 
   * Why Vector Clocks for disaster scenario:
   * ✓ Detect causality between events
   * ✓ Identify concurrent updates (conflicts)
   * ✓ Works across multiple devices with loose synchronization
   * ✓ No global time synchronization needed
   * 
   * How it works:
   * Each device has a counter in the clock:
   * {
   *   "device-1": 5,
   *   "device-2": 3,
   *   "device-3": 1,
   *   "server": 10
   * }
   * 
   * When device-1 makes a change: increment device-1's counter
   * When device-1 receives update from device-2: merge clocks (max of each)
   */
  constructor(clock = {}) {
    this.clock = { ...clock };
  }

  /**
   * Increment this node's logical clock
   */
  increment(nodeId) {
    this.clock[nodeId] = (this.clock[nodeId] || 0) + 1;
    return this.clone();
  }

  /**
   * Merge two vector clocks (take maximum for each node)
   * This represents receiving a message from another device
   */
  merge(other) {
    const merged = new VectorClock(this.clock);
    Object.keys(other.clock || other).forEach(nodeId => {
      const otherValue = typeof other.clock === 'object' ? other.clock[nodeId] : 0;
      merged.clock[nodeId] = Math.max(merged.clock[nodeId] || 0, otherValue || 0);
    });
    return merged;
  }

  /**
   * Check if this clock is concurrent with another
   * Concurrent = neither happened before the other
   */
  isConcurrent(other) {
    const thisBeforeOther = this.happensBefore(other);
    const otherBeforeThis = other.happensBefore(this);
    return !thisBeforeOther && !otherBeforeThis;
  }

  /**
   * Check if this clock happened before another
   * A happens before B if A's counters <= B's for all nodes,
   * and strictly < for at least one
   */
  happensBefore(other) {
    let strictlyBefore = false;
    const otherClock = other.clock || other;
    
    for (const nodeId in this.clock) {
      if ((this.clock[nodeId] || 0) > (otherClock[nodeId] || 0)) {
        return false; // This is after other
      }
      if ((this.clock[nodeId] || 0) < (otherClock[nodeId] || 0)) {
        strictlyBefore = true;
      }
    }
    
    return strictlyBefore;
  }

  /**
   * Clone this vector clock
   */
  clone() {
    return new VectorClock(this.clock);
  }

  /**
   * Serialize for network
   */
  toJSON() {
    return this.clock;
  }

  /**
   * Deserialize from network
   */
  static fromJSON(json) {
    return new VectorClock(json || {});
  }
}

/**
 * CRDT Mutation - Represents a single change to shared data
 * 
 * Anatomy of a mutation:
 * {
 *   id: "unique-mutation-id",
 *   record_id: "D001",      // Which record changed (delivery ID)
 *   field: "status",         // Which field changed
 *   oldValue: "pending",     // Previous value
 *   newValue: "in_transit",  // New value
 *   vectorClock: {...},      // Causal history
 *   timestamp: 1681234567,   // Real-world time  
 *   nodeId: "device-1",      // Which device made change
 *   type: "UPDATE"           // UPDATE, INSERT, DELETE
 * }
 */
export class CRDTMutation {
  constructor(config) {
    this.id = config.id || `mutation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.record_id = config.record_id;
    this.field = config.field;
    this.oldValue = config.oldValue;
    this.newValue = config.newValue;
    this.vectorClock = config.vectorClock || {};
    this.timestamp = config.timestamp || Date.now();
    this.nodeId = config.nodeId || 'local';
    this.type = config.type || 'UPDATE';
  }

  toJSON() {
    return {
      id: this.id,
      record_id: this.record_id,
      field: this.field,
      oldValue: this.oldValue,
      newValue: this.newValue,
      vectorClock: this.vectorClock,
      timestamp: this.timestamp,
      nodeId: this.nodeId,
      type: this.type
    };
  }

  static fromJSON(json) {
    return new CRDTMutation(json);
  }
}

/**
 * Conflict Detection & Resolution
 * 
 * A CONFLICT occurs when:
 * 1. Two devices update the same field of the same record
 * 2. These updates are concurrent (neither happened before the other)
 * 3. No deterministic rule can decide between them
 * 
 * Example Conflict Scenario:
 * Device A (offline in Zone 1):
 *   10:00:00 - Sets delivery D001 status="in_transit"
 * Device B (offline in Zone 2):
 *   10:00:00 - Sets delivery D001 status="delayed"
 * Both devices sync later → CONFLICT
 * 
 * Resolution Strategies in Digital Delta:
 * 1. LWW (Last-Write-Wins): Latest timestamp wins
 * 2. Custom: User selects via GUI
 * 3. Merge: Combine values (e.g., "in_transit + delayed" = "delayed")
 */
export class ConflictDetector {
  /**
   * Detect if two mutations conflict
   */
  static detect(mutation1, mutation2) {
    // Same record? Same field?
    if (mutation1.record_id !== mutation2.record_id || 
        mutation1.field !== mutation2.field) {
      return null; // No conflict
    }

    // Different values?
    if (mutation1.newValue === mutation2.newValue) {
      return null; // Same value, no conflict
    }

    // Check causal relationship via vector clocks
    const vc1 = new VectorClock(mutation1.vectorClock);
    const vc2 = new VectorClock(mutation2.vectorClock);

    if (vc1.happensBefore(vc2) || vc2.happensBefore(vc1)) {
      return null; // Causal order exists, no true conflict
    }

    // They're concurrent = CONFLICT
    return {
      id: `conflict-${mutation1.id}-${mutation2.id}`,
      record_id: mutation1.record_id,
      field: mutation1.field,
      mutation1: {
        value: mutation1.newValue,
        timestamp: mutation1.timestamp,
        nodeId: mutation1.nodeId,
        deviceTime: new Date(mutation1.timestamp).toISOString()
      },
      mutation2: {
        value: mutation2.newValue,
        timestamp: mutation2.timestamp,
        nodeId: mutation2.nodeId,
        deviceTime: new Date(mutation2.timestamp).toISOString()
      },
      detectedAt: new Date().toISOString()
    };
  }

  /**
   * Resolve conflict using LWW strategy
   * Returns the winner
   */
  static resolveLWW(mutation1, mutation2) {
    if (mutation1.timestamp > mutation2.timestamp) {
      return mutation1;
    }
    if (mutation2.timestamp > mutation1.timestamp) {
      return mutation2;
    }
    
    // Same timestamp: use nodeId as tiebreaker (lexicographic order)
    if (mutation1.nodeId > mutation2.nodeId) {
      return mutation1;
    }
    return mutation2;
  }

  /**
   * Resolve via custom logic
   */
  static resolveCustom(mutation1, mutation2, userChoice) {
    if (userChoice === 'mutation1') {
      return mutation1;
    } else if (userChoice === 'mutation2') {
      return mutation2;
    } else if (userChoice === 'merge') {
      // For string values: concatenate with indicator
      return {
        ...mutation1,
        newValue: `${mutation1.newValue}|${mutation2.newValue}`,
        resolvedWith: 'merge'
      };
    }
  }
}

/**
 * Offline-First Sync Engine
 * 
 * Handles the complete sync workflow:
 * 1. Collect local mutations while offline
 * 2. Connect to server
 * 3. Send local mutations, receive server mutations
 * 4. Merge vector clocks to detect conflicts
 * 5. Resolve conflicts
 * 6. Update local state
 */
export class OfflineSyncEngine {
  constructor() {
    this.pendingMutations = [];
    this.appliedMutations = [];
    this.conflicts = [];
    this.vectorClock = new VectorClock();
  }

  /**
   * Record a local change
   */
  recordMutation(mutation) {
    this.vectorClock = this.vectorClock.increment(mutation.nodeId);
    
    const wrappedMutation = new CRDTMutation({
      ...mutation,
      vectorClock: this.vectorClock.toJSON()
    });
    
    this.pendingMutations.push(wrappedMutation);
    return wrappedMutation;
  }

  /**
   * Merge with server mutations
   */
  mergeMutations(serverMutations) {
    const results = {
      applied: [],
      conflicted: [],
      totalServerMutations: serverMutations.length
    };

    serverMutations.forEach(serverMutation => {
      // Merge vector clock
      this.vectorClock = this.vectorClock.merge(new VectorClock(serverMutation.vectorClock));

      // Check for conflicts with local mutations
      let hasConflict = false;
      for (const localMutation of this.pendingMutations) {
        const conflict = ConflictDetector.detect(localMutation, serverMutation);
        if (conflict) {
          hasConflict = true;
          this.conflicts.push(conflict);
          results.conflicted.push(conflict);
          break;
        }
      }

      if (!hasConflict) {
        this.appliedMutations.push(serverMutation);
        results.applied.push(serverMutation);
      }
    });

    return results;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      pendingMutations: this.pendingMutations.length,
      appliedMutations: this.appliedMutations.length,
      conflicts: this.conflicts.length,
      vectorClock: this.vectorClock.toJSON()
    };
  }
}

export default {
  LWWRegister,
  VectorClock,
  CRDTMutation,
  ConflictDetector,
  OfflineSyncEngine
};
