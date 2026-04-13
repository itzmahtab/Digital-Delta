# Module 2: Distributed DB & CRDT Sync
## Comprehensive Implementation Guide & Answers

Digital Delta uses a **Last-Write-Wins (LWW) Register CRDT with Vector Clocks** for offline-first disaster relief coordination.

---

## Question 1: Which CRDT and Why for This Disaster Scenario?

### 🎯 **CRDT Choice: Last-Write-Wins (LWW) Register**

```
┌─────────────────────────────────────────────────────────────┐
│                   LWW Register Architecture                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Register Structure:                                        │
│  ┌──────────────┬──────────────┬───────────────┐           │
│  │ Current Value│ Timestamp    │ Origin NodeID │           │
│  │ "in_transit" │ 1681234567   │ "device-2"    │           │
│  └──────────────┴──────────────┴───────────────┘           │
│                                                              │
│  When Update Arrives:                                       │
│  Compare new_timestamp with current_timestamp              │
│  If newer: ACCEPT new value                                │
│  If older/equal: REJECT (keep current)                     │
│                                                              │
```

### ✅ **Why LWW is Perfect for Disaster Relief**

| Factor | Traditional DB | LWW CRDT |
|--------|----------------|----------|
| **Internet Needed** | Yes, always | No, works offline ✓ |
| **Conflict Resolution** | Manual merge required | Automatic ✓ |
| **Causal Consistency** | With locking | With Vector Clocks ✓ |
| **Performance** | Slow (WAITs for lock) | Fast O(1) ✓ |
| **Deterministic** | No (depends on config) | Yes (same everywhere) ✓ |
| **Device Independence** | Central authority | All equal ✓ |

### 🌍 **Real Disaster Scenario**

```
SCENARIO: Sylhet Flood Relief Coordination

Location: Bangladesh (sporadic connectivity)
Teams: Field (Device A) ↔ Coordinator (Device B) ↔ Server

Timeline:
10:00:00 - Device A (OFFLINE): Records "Delivery D001 status=in_transit"
          Vector Clock: {A: 1, B: 0, Server: 0}
          LWW Register: {value: "in_transit", ts: 10:00:00, nodeId: "A"}

10:00:10 - Device B (OFFLINE): Records "Delivery D001 status=delayed"
          Vector Clock: {A: 0, B: 1, Server: 0}
          LWW Register: {value: "delayed", ts: 10:00:10, nodeId: "B"}

10:05:00 - Device A connects to server
          Sends: "in_transit" with timestamp 10:00:00
          Server LWW: {value: "in_transit", ts: 10:00:00}

10:06:00 - Device B connects to server
          Sends: "delayed" with timestamp 10:00:10
          Server LWW compares: 10:00:10 > 10:00:00
          → ACCEPTS "delayed" (newer timestamp wins)
          
Result: All devices eventually agree: status = "delayed"
        NO manual intervention needed
        DETERMINISTIC resolution
```

### 📊 **Alternative CRDTs (Why NOT Chosen)**

| CRDT Type | Pros | Cons | Why Not |
|-----------|------|------|---------|
| **LWW (Chosen)** | Simple, fast, deterministic | Loses older writes | N/A ✓ |
| **Multi-Value** | Preserves all updates | Complex merge logic | Overkill for status |
| **Operational Transform** | Preserves intent | Requires central server | Needs internet ✗ |
| **EPOCH** | Groups writes | Complex ordering | Disaster ≠ grouped ✗ |
| **Text CRDT (Yjs)** | For collaborative text | Overkill for structured data | Wrong domain ✗ |

---

## Question 2: How Does System Ensure Consistency When Devices Update Same Data Offline?

### 🔄 **The Complete Consistency Journey**

```
DEVICE OFFLINE                  EVENTUAL CONSISTENCY ACHIEVED

Device A (Boat)                Device B (Drone)              Server
│                              │                             │
├─ User Updates                ├─ User Updates              │
│  Delivery Status             │  Delivery Status           │
│  • LOCAL mutation recorded   │  • LOCAL mutation recorded │
│  • VC: {A: 1, B: 0}          │  • VC: {A: 0, B: 1}       │
│  • LWW: val="in_transit"     │  • LWW: val="delayed"     │
│  • Timestamp: 10:00:00       │  • Timestamp: 10:00:10    │
│  • Stored in IndexedDB       │  • Stored in IndexedDB    │
│  ├─ Sent via Mesh Relay     │  ├─ Sent via Mesh Relay   │
│  │  (peer-to-peer if nearby) │  │  (peer-to-peer if nearby)
│                              │                             │
├─ Device Comes Online         │                            │
│  POST /api/sync/delta        │                    ┌───────┤
│  Body: {                     │                    │       │
│    mutations: [{             │                    │  Server
│      record: "D001",         │                    │  Receives
│      newValue: "in_transit", │                    │  Mutation A:
│      ts: 10:00:00,           │                    │  • Updates LWW
│      VC: {A: 1}              │                    │    register
│    }],                       │                    │  • Stores in
│    sinceVC: {A: 1, B: 0}    │                    │    Ledger
│  }                           │                    │  VC: {A: 1}
│  ↓                           │                    │
│  Response:                   │                    │
│  • Accepts mutation          │                    │
│  • ServerVC: {A: 1, B: 0}    │                    │
│  • serverDelta: [{...}]      │                    │
│  ├─ Applies locally          │                    │
│  ├─ Merges VC                │                    │
│  └─ Updates IndexedDB        │                    │
│                              │                    │
│                              ├─ Device Comes Online
│                              │  POST /api/sync/delta
│                              │  Body: {
│                              │    mutations: [{
│                              │      record: "D001",
│                              │      newValue: "delayed",
│                              │      ts: 10:00:10,
│                              │      VC: {B: 1}
│                              │    }],
│                              │    sinceVC: {A: 0, B: 1}
│                              │  }
│                              │  ↓
│                              │  Conflict Detection:
│                              │  • Both record_id=D001
│                              │  • Both field=status
│                              │  • Different values
│                              │  • Concurrent (no causal order)
│                              │  → CONFLICT!
│                              │  ↓
│                              │  LWW Resolution:
│                              │  ts_B (10:00:10) > ts_A (10:00:00)
│                              │  → Accept "delayed"
│                              │  → Reject "in_transit"
│                              │  ↓
│                              │  Response to Device B:
│                              │  • serverDelta: [{
│                              │      record: "D001",
│                              │      value: "delayed",
│                              │      reason: "lww_conflict_resolved"
│                              │    }]
│                              │  • conflicts: {
│                              │      resolved: "delayed",
│                              │      vs: "in_transit"
│                              │    }
│                              │  ├─ Applies locally
│                              │  └─ Updates IndexedDB
│
RESULT: All 3 systems agree: D001.status = "delayed"
```

### 🛡️ **Consistency Guarantees Provided**

**1. Eventual Consistency**
```javascript
// Definition: All replicas eventually converge to same state
// Timeline: Milliseconds to hours depending on connectivity

const delivery = {
  id: "D001",
  status: "pending"  // Initial state: all devices agree
};

// Device A goes offline, updates status
deviceA.delivery.status = "in_transit";  // Only local at first

// Device B goes offline, updates status
deviceB.delivery.status = "delayed";     // Different value!

// Both reconnect → LWW resolves automatically
// After sync: ALL devices show status = "delayed"
```

**2. Causal Consistency**
```javascript
// Definition: Order of causally-related events is preserved

// Device A's thread of execution:
event1: recordOrder()           // VC: {A: 1}
event2: markOrderReceived()     // VC: {A: 2}
event3: startDelivery()         // VC: {A: 3}

// Device B receives:
// Always sees: recordOrder → markOrderReceived → startDelivery
// NEVER sees: startDelivery before recordOrder
// WHY: Vector clock establishes happens-before relationship
```

**3. Conflict-Free Deterministic Merge**
```javascript
// All devices run same resolution logic
// Same inputs → Same outputs (deterministic)

function resolveLWW(local, remote) {
  // Rule: Later timestamp always wins
  if (remote.timestamp > local.timestamp) {
    return remote.value;  // Deterministic
  } else if (local.timestamp > remote.timestamp) {
    return local.value;   // Deterministic
  } else if (remote.nodeId > local.nodeId) {
    return remote.value;  // Lexicographic tiebreaker (deterministic)
  }
  return local.value;
}

// No matter the merge order, result is ALWAYS SAME
server.resolveLWW(A, B) === deviceC.resolveLWW(A, B);
```

### 🔐 **Data Structure for Consistency**

```javascript
// Mutation: Atomic unit of change
{
  id: "mut-D001-status-1681234567",
  record_id: "D001",           // What changed
  field: "status",              // Which field
  oldValue: "pending",          // Before
  newValue: "in_transit",       // After
  timestamp: 1681234567,        // Real-world clock
  vectorClock: {                // Logical clock
    "device-1": 1,
    "device-2": 0,
    "device-3": 5
  },
  nodeId: "device-1",          // Who changed it
  type: "UPDATE"                // Operation type
}

// LWW Register (maintains for each field)
{
  record_id: "D001",
  field: "status",
  value: "delayed",             // Current winning value
  timestamp: 1681234577,        // From mutation that won
  sourceNodeId: "device-2",     // Which device won
  appliedAt: 1681240000,        // When merged
  priorValue: "in_transit",     // Previous value
  conflictCount: 1              // How many conflicts resolved
}
```

### ⏰ **Time Handling (Critical for Offline)**

```javascript
// Problem: Device clocks may be out of sync
// Solution: Use BOTH real-time AND logical time

// Real-time timestamp (for LWW)
// - Even if device clock is wrong, LWW still works
// - Older clock = older timestamp = loses conflict
// - Newer clock = newer timestamp = wins conflict
// - If clocks skew too much: Falls back to lexicographic nodeId

// Logical clock (Vector Clock for causality)
// - Independent of real time
// - Only incremented by LOCAL changes or received updates
// - Preserves CAUSALITY not REALTIME
// - Example: offline → 100 local changes → VC = {myDevice: 100}

Example:
Device A's clock is 5 hours ahead (battery issue):
  Record: timestamp = 2026-04-13 (real) vs 2026-04-18 (skewed)
  Result: A's mutations always win in LWW
  ← This is acceptable! Later timestamps should win anyway

Device B's clock is 5 hours behind:
  Record: timestamp = 2026-04-08 (real) vs 2026-04-13 (skewed)
  Result: B's mutations always lose in LWW
  ← This prevents B's old data from overwriting newer data
```

---

## Question 3: How Are Conflicts Detected and Resolved?

### 🚨 **Conflict Detection Algorithm**

```
Step 1: TWO MUTATIONS ARRIVE
  Mutation A: {field: "status", recordId: "D001", value: "in_transit"}
  Mutation B: {field: "status", recordId: "D001", value: "delayed"}

Step 2: CHECK IF SAME RECORD & FIELD
  A.recordId == B.recordId? ✓ YES (both D001)
  A.field == B.field? ✓ YES (both status)
  → Potential conflict

Step 3: CHECK VECTOR CLOCKS FOR CAUSALITY
  Vector Clock A: {device1: 3, device2: 0}
  Vector Clock B: {device1: 0, device2: 5}
  
  Does A happen-before B?
    A[device1]=3 > B[device1]=0  → NO
    (A is NOT completely before B)
  
  Does B happen-before A?
    B[device2]=5 > A[device2]=0  → NO
    (B is NOT completely before A)
  
  Result: CONCURRENT = CONFLICT DETECTED ✓

Step 4: CHECK FOR IDENTICAL VALUES
  A.newValue == B.newValue? 
  "in_transit" == "delayed"? NO
  → ACTUAL CONFLICT (not just same change)

VERDICT: ⚠️ CONFLICT - Needs Resolution
```

### 🎯 **Conflict Detection Code Example**

```javascript
import { VectorClock, ConflictDetector } from '../services/crdt.js';

// Two devices make concurrent updates
const mutationA = {
  record_id: "D001",
  field: "status",
  newValue: "in_transit",
  timestamp: 1681234567,
  nodeId: "device-1",
  vectorClock: { "device-1": 5, "device-2": 0, "server": 3 }
};

const mutationB = {
  record_id: "D001",
  field: "status",
  newValue: "delayed",
  timestamp: 1681234570,
  nodeId: "device-2",
  vectorClock: { "device-1": 0, "device-2": 4, "server": 3 }
};

// Detect conflict
const conflict = ConflictDetector.detect(mutationA, mutationB);

console.log(conflict);
// Output:
// {
//   id: "conflict-mut-A-mut-B",
//   record_id: "D001",
//   field: "status",
//   mutation1: { value: "in_transit", timestamp: 1681234567, nodeId: "device-1" },
//   mutation2: { value: "delayed", timestamp: 1681234570, nodeId: "device-2" },
//   detectedAt: "2026-04-13T10:30:00Z"
// }
```

### ⚡ **Conflict Resolution Strategies**

**Strategy 1: Last-Write-Wins (LWW) - Default**

```javascript
// Rule: Most recent timestamp always wins

const conflict = {
  mutation1: { value: "in_transit", timestamp: 1681234567 },
  mutation2: { value: "delayed", timestamp: 1681234570 }
};

const winner = ConflictDetector.resolveLWW(
  conflict.mutation1,
  conflict.mutation2
);

console.log(winner.value);
// Output: "delayed" (newer timestamp wins)

// Tiebreaker (same timestamp):
const conflict2 = {
  mutation1: { value: "in_transit", timestamp: 1681234567, nodeId: "device-1" },
  mutation2: { value: "delayed", timestamp: 1681234567, nodeId: "device-2" }  // Same time!
};

// device-2 > device-1 (lexicographic)
const winner2 = ConflictDetector.resolveLWW(
  conflict2.mutation1,
  conflict2.mutation2
);

console.log(winner2.value);
// Output: "delayed" (nodeId tiebreaker)
```

**Strategy 2: User Resolution - UI**

```jsx
// Frontend presents conflict to field coordinator

import { ConflictModal } from '../components/sync/ConflictModal.jsx';

function SyncStatus() {
  const { pendingConflicts, resolveConflict } = useSyncStore();
  
  return (
    <>
      {pendingConflicts.map(conflict => (
        <ConflictModal
          key={conflict.id}
          conflict={conflict}
          onResolve={async (resolution) => {
            // User chooses: "keep_local", "keep_remote", "merge"
            await resolveConflict(conflict.id, resolution);
          }}
        />
      ))}
    </>
  );
}

// ConflictModal shows:
// ┌─────────────────────────────────────┐
// │  Conflict Detected                  │
// │  Delivery D001 Status               │
// ├─────────────────────────────────────┤
// │  Option 1: "in_transit"             │ [Keep This]
// │  Updated by: Device 1 at 10:00:00   │
// ├─────────────────────────────────────┤
// │  Option 2: "delayed" (Recommended)  │ [Accept]
// │  Updated by: Device 2 at 10:00:10   │
// │  Reason: Newer (LWW)                │
// ├─────────────────────────────────────┤
// │  [ Keep Local ] [ Accept ] [ Merge ]│
// └─────────────────────────────────────┘
```

**Strategy 3: Merge - Combine Updates**

```javascript
// For string fields: preserve history

const conflict = {
  mutation1: { value: "in_transit", timestamp: 1681234567 },
  mutation2: { value: "delayed", timestamp: 1681234570 }
};

const merged = ConflictDetector.resolveCustom(
  conflict.mutation1,
  conflict.mutation2,
  "merge"
);

console.log(merged.value);
// Output: "in_transit|delayed"
// (indicates both states occurred, separated by pipe)

// UI shows: "Status History: in_transit → delayed"
```

### 📊 **Complete Conflict Resolution Flow**

```
╔════════════════════════════════════════════════════════════════════╗
║                    CONFLICT RESOLUTION FLOW                        ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  STEP 1: DETECT CONFLICT                                          ║
║  ├─ Same record? YES                                              ║
║  ├─ Same field? YES                                               ║
║  ├─ Different values? YES                                         ║
║  ├─ Concurrent (no happens-before)? YES                           ║
║  └─ VERDICT: CONFLICT! ⚠️                                         ║
║                                                                    ║
║  STEP 2: CLASSIFY CONFLICT TYPE                                   ║
║  ├─ Data Type: String/Number/Bool/Object                          ║
║  ├─ Business Logic: Critical/Non-Critical                         ║
║  ├─ Field: Status/Location/Count/etc                              ║
║  └─ Auto-Resolution Possible? → YES for LWW                       ║
║                                                                    ║
║  STEP 3: ATTEMPT AUTO-RESOLUTION                                  ║
║  ├─ Apply LWW: Compare(timestamp_A, timestamp_B)                  ║
║  ├─ Result: WINNER determined deterministically                   ║
║  ├─ All devices compute same winner                               ║
║  └─ Consensus reached! ✓                                          ║
║                                                                    ║
║  STEP 4: IF DETERMINISTIC UNCLEAR                                 ║
║  ├─ Present UI conflict modal to user                             ║
║  ├─ Show both options with metadata                               ║
║  ├─ User selects preferred value                                  ║
║  ├─ Record user's choice in audit log                             ║
║  └─ Broadcast resolution to all devices                           ║
║                                                                    ║
║  STEP 5: APPLY RESOLUTION                                         ║
║  ├─ Update local LWW register                                     ║
║  ├─ Merge vector clocks                                           ║
║  ├─ Record in conflict resolution log                             ║
║  ├─ Remove from pending conflicts                                 ║
║  └─ Notify user: "Synced" ✓                                       ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

### 🧪 **Real Example: Delivery Status Conflict**

```javascript
// SCENARIO: Two field teams update same delivery offline

// Device A (Boat) at 10:00:00+00:00
const updateA = {
  record_id: "D001",
  field: "status",
  oldValue: "pending",
  newValue: "in_transit",
  timestamp: 1681234567,      // 10:00:00+00:00
  nodeId: "boat-1",
  vectorClock: { "boat-1": 1, "drone-1": 0 }
};

// Device B (Drone) at 10:00:10+00:00  (GPS moved, started flying)
const updateB = {
  record_id: "D001",
  field: "status",
  oldValue: "pending",
  newValue: "delayed",
  timestamp: 1681234577,      // 10:00:10+00:00
  nodeId: "drone-1",
  vectorClock: { "boat-1": 0, "drone-1": 1 }
};

// Both devices sync to server
// Server conflict detection:
const conflict = ConflictDetector.detect(updateA, updateB);

if (conflict) {
  // Check vector clocks for happens-before
  const vcA = new VectorClock(updateA.vectorClock);
  const vcB = new VectorClock(updateB.vectorClock);
  
  console.log(vcA.happensBefore(vcB));  // false (A not before B)
  console.log(vcB.happensBefore(vcA));  // false (B not before A)
  console.log(vcA.isConcurrent(vcB));   // true ← CONCURRENT!
  
  // Apply LWW resolution
  const winner = ConflictDetector.resolveLWW(updateA, updateB);
  
  console.log(winner.newValue);  // "delayed"
  console.log(winner.timestamp); // 1681234577 (newer)
  
  // Store in ledger
  server.updateDelivery("D001", {
    status: "delayed",
    lastUpdatedBy: "drone-1",
    resolvedConflict: {
      conflictingValue: "in_transit",
      reason: "lww",
      timestamp: 1681240000
    }
  });
}

// Result:
// ✓ Device A sees: D001.status = "delayed" (updated from server)
// ✓ Device B sees: D001.status = "delayed" (their own update wins)
// ✓ Server shows: D001.status = "delayed" (definitive)
// ✓ Audit log shows: Both updates + resolution method
```

---

## 🏗️ **Complete System Architecture**

```
┌────────────────────────────────────────────────────────────────┐
│                 Digital Delta CRDT Architecture                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  FRONTEND (React + Zustand)                                   │
│  ┌──────────────────────────────────┐                         │
│  │ useSyncStore()                   │                         │
│  │ ├─ vectorClock: {}               │                         │
│  │ ├─ localMutations: []            │                         │
│  │ ├─ pendingConflicts: []          │                         │
│  │ └─ sync(): POST /api/sync/delta  │                         │
│  └────────────┬─────────────────────┘                         │
│               │                                                │
│               ├─ crdt.js (CRDT Engine)                        │
│               │  ├─ LWWRegister                              │
│               │  ├─ VectorClock                              │
│               │  ├─ ConflictDetector                         │
│               │  └─ OfflineSyncEngine                        │
│               │                                                │
│               └─ idb.js (IndexedDB)                           │
│                  └─ Offline persistence                       │
│                                                                │
│  NETWORK (Offline Support)                                    │
│  ┌──────────────────────────────────┐                         │
│  │ Mesh Network (P2P Relay)         │                         │
│  │ Bluetooth / LoRa / Radio         │                         │
│  │ BroadcastChannel (Same Device)   │                         │
│  └──────────────────────────────────┘                         │
│                                                                │
│  BACKEND (Node.js Express)                                    │
│  ┌──────────────────────────────────┐                         │
│  │ sync.routes.js                   │                         │
│  │ ├─ POST /api/sync/delta          │                         │
│  │ │  └─ Mutation processing        │                         │
│  │ └─ GET /api/sync/vector-clock    │                         │
│  │    └─ Server state               │                         │
│  │                                  │                         │
│  │ db.js (Ledger)                   │                         │
│  │ ├─ appendLedgerMutation()        │                         │
│  │ ├─ getLedgerDelta()              │                         │
│  │ └─ All mutations (immutable)     │                         │
│  │                                  │                         │
│  │ Other Routes (Protected by RBAC) │                         │
│  │ ├─ POST /api/deliveries          │                         │
│  │ ├─ POST /api/inventory           │                         │
│  │ ├─ POST /api/fleet               │                         │
│  │ └─ [...] (All create mutations)  │                         │
│  └──────────────────────────────────┘                         │
│                                                                │
│  DATABASE (SQLite)                                            │
│  ┌──────────────────────────────────┐                         │
│  │ ledger_mutations (append-only)   │                         │
│  │ ├─ id, record_id, field          │                         │
│  │ ├─ oldValue, newValue            │                         │
│  │ ├─ timestamp, vectorClock        │                         │
│  │ └─ nodeId, type                  │                         │
│  │                                  │                         │
│  │ conflicts (for audit)            │                         │
│  │ ├─ id, record_id, field          │                         │
│  │ ├─ conflictingValues             │                         │
│  │ ├─ resolution_strategy           │                         │
│  │ └─ resolved_at, resolved_by      │                         │
│  └──────────────────────────────────┘                         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 📋 **Summary: Answers to Module 2 Questions**

### **Q1: Which CRDT and Why?**
✅ **Last-Write-Wins (LWW) Register with Vector Clocks**
- Deterministic conflict resolution (same result everywhere)
- Works completely offline, no internet needed
- Fast O(1) operations
- Perfect for disaster relief where coordination is difficult
- Automatic resolution without human intervention (except UI when unclear)

### **Q2: Ensuring Consistency Offline?**
✅ **Vector Clocks + LWW Timestamp**
- Each device maintains a vector clock (logical timestamp per device)
- Detects causality: if event A happened-before event B, we apply updates in order
- If events are concurrent: LWW rule applies (newer timestamp wins, with nodeId tiebreaker)
- All devices compute same resolution deterministically
- Conflicts stored in audit log for transparency

### **Q3: Conflict Detection & Resolution?**
✅ **Multi-step process:**
1. **Detect**: Same record + same field + different values + concurrent (no happens-before)
2. **Classify**: Type of conflict and auto-resolution possibility
3. **Resolve**: LWW algorithm (latest timestamp wins) deterministically
4. **If Unclear**: Present UI to user for manual selection
5. **Apply**: Update all devices, record in audit log, broadcast resolution

---

## 🚀 **Running the System**

```bash
# Backend
cd backend && npm run dev

# Frontend
cd frontend && npm run dev

# Go offline, make changes, reconnect → Automatic CRDT sync
```

**Status:** ✅ Module 2 (Distributed DB & CRDT Sync) FULLY IMPLEMENTED
