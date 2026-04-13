# Module 2 Quick Reference - CRDT System Architecture

## 🎯 System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DIGITAL DELTA SYNC                                 │
│                     (Offline CRDT-Based System)                             │
└─────────────────────────────────────────────────────────────────────────────┘

DEVICE A (Boat)                  DEVICE B (Drone)                  SERVER (AWS)
┌──────────────────┐            ┌──────────────────┐             ┌──────────────┐
│  React + Zustand │            │  React + Zustand │             │  Express.js  │
│  ↓               │            │  ↓               │             │  ↓           │
│  IndexedDB       │            │  IndexedDB       │             │  PostgreSQL  │
│  ↓               │            │  ↓               │             │  ↓           │
│  CRDT Service    │            │  CRDT Service    │             │  Mutation    │
│  ├─ LWW Reg      │            │  ├─ LWW Reg      │             │  Ledger      │
│  ├─ VectorClock  │────HTTP────│  ├─ VectorClock  │             │  (immutable) │
│  ├─ ConflictDet  │◄──────────►│  ├─ ConflictDet  │             │  ↓           │
│  └─ SyncEngine   │            │  └─ SyncEngine   │             │  Dedup +     │
│                  │            │                  │             │  LWW Merge   │
└──────────────────┘            └──────────────────┘             └──────────────┘
      Offline OK                     Offline OK                   Single Source
      Local Mutations                Local Mutations              of Truth
      Auto-Recovery                  Auto-Recovery
```

## 🔧 Key Components

### 1️⃣ Frontend: `frontend/src/services/crdt.js`

```javascript
// Core Classes:

class LWWRegister {
  // Last-Write-Wins value storage
  constructor(value, timestamp, nodeId)
  update(newValue, newTimestamp, newNodeId) → {applied, reason}
  getValue() → value
  // Implements: {value, timestamp, nodeId}
}

class VectorClock {
  // Causality tracking
  constructor(clock_obj = {device-1: 5, device-2: 3})
  increment(nodeId) → void
  isConcurrent(other) → boolean
  happensBefore(other) → boolean
  // Methods track event ordering across devices
}

class CRDTMutation {
  // Atomic change representation
  {
    id, record_id, field,
    oldValue, newValue,
    timestamp, nodeId,
    vectorClock,
    deviceId, createdAt
  }
}

class ConflictDetector {
  // Detect & resolve conflicts
  static detect(mutA, mutB) → conflict_object | null
  static resolveLWW(mutA, mutB) → winner_mutation
  static resolveCustom(mutA, mutB, userChoice) → resolved_mutation
}

class OfflineSyncEngine {
  // Manages entire sync workflow
  recordMutation(record_id, field, value) → void
  mergeMutations(incomingMutations) → {conflicts, resolved}
  getStats() → {pending, conflicts, synced}
}
```

### 2️⃣ Frontend State: `frontend/src/store/syncStore.js`

```javascript
// Zustand store managing:
useSync = {
  // State
  syncStatus: "synced" | "syncing" | "pending" | "conflict",
  mutations: [{...}],
  conflicts: [{...}],
  serverVC: { device-1: 5 },
  
  // Actions
  recordMutation(change),
  sync(),
  resolveConflict(choice),
  resetSync()
}

// Used by components:
// const { syncStatus, mutations } = useSync()
```

### 3️⃣ Backend: `backend/src/routes/sync.routes.js`

```javascript
// POST /api/sync/delta
Request: {
  sinceVC: { clientVC },
  mutations: [{
    record_id, field, oldValue, newValue,
    timestamp, nodeId, vectorClock
  }]
}

Processing:
1. Accept incoming mutations
2. Check for conflicts vs existing ledger
3. Apply LWW resolution
4. Update server vector clock
5. Return delta (what client needs)

Response: {
  serverDelta: [updated records],
  serverVC: { updated clock },
  conflicts: [{resolved}],
  status: "synced"
}
```

### 4️⃣ Backend Storage: Immutable Mutation Ledger

```sql
-- PostgreSQL Table
CREATE TABLE mutation_ledger (
  id TEXT PRIMARY KEY,
  device_id TEXT,
  record_id TEXT,
  field TEXT,
  value NOT NULL,
  timestamp INTEGER,
  vector_clock JSONB,
  sync_batch_id TEXT,
  resolved_from_conflict BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW()
);

-- IMMUTABLE (never delete/update, only append)
-- Source of truth for all conflicts
```

## 📊 Data Flow Examples

### Example 1: Normal Offline Sync

```
1. User makes change offline
   App: deliveries.D001.status = "delivered"
   
2. CRDT records mutation
   mutation = {
     record_id: "D001",
     field: "status",
     value: "delivered",
     timestamp: Date.now(),
     vectorClock: {boat: 2}
   }
   
3. Sync to server
   POST /api/sync/delta
   
4. Server accepts
   No conflicts (no concurrent update)
   Adds to ledger
   VC: {boat: 2}
   
5. Response
   { serverDelta: [], conflicts: [] }
   
6. App merges
   Status updated ✓
   Synced indicator shown ✓
```

### Example 2: Conflict Resolution

```
1. Two devices offline, both update same field
   Boat:  D001.status = "in_transit" (ts: 1000)
   Drone: D001.status = "delayed"    (ts: 2000)
   
2. Each records locally + shows pending
   App: Status shows ⏳ "Pending Sync"
   
3. First device syncs (Boat)
   Server accepts: LWW = "in_transit" (ts: 1000)
   Ledger updated
   
4. Second device syncs (Drone)
   Server detects CONFLICT:
   - Same record (D001)
   - Same field (status)
   - Different values
   - Concurrent (vector clocks)
   
5. LWW Resolution
   Compare: ts(2000) > ts(1000)? YES
   Winner: "delayed"
   Reason: Newer timestamp
   
6. Server response to Drone
   {
     conflicts: [{
       field: "status",
       your_value: "delayed",
       resolved_value: "delayed",
       reason: "lww_you_won"
     }]
   }
   
7. Boat receives update
   Server sends delta:
   { serverDelta: [{D001: {status: "delayed"}}] }
   
8. Both devices now agree ✓
   Boat: D001.status = "delayed"
   Drone: D001.status = "delayed"
   Server: D001.status = "delayed"
```

## 🚀 Usage Examples

### Record a Change

```javascript
// In React component:
import { useSync } from '@/store/syncStore'

export function DeliveryForm() {
  const { recordMutation } = useSync()
  
  const handleStatusChange = (newStatus) => {
    // Automatically records + stores mutation
    recordMutation('D001', 'status', newStatus)
  }
  
  return (
    <select onChange={(e) => handleStatusChange(e.target.value)}>
      <option>in_transit</option>
      <option>delayed</option>
      <option>completed</option>
    </select>
  )
}
```

### Handle Conflicts

```javascript
// In ConflictModal component:
const { resolveConflict } = useSync()

export function ConflictModal({ conflict }) {
  return (
    <div>
      <h3>Conflict detected</h3>
      <p>Your value: {conflict.yourValue}</p>
      <p>Server value: {conflict.serverValue}</p>
      
      <button onClick={() => resolveConflict('keep_yours')}>
        Keep mine
      </button>
      <button onClick={() => resolveConflict('accept_server')}>
        Accept server's
      </button>
    </div>
  )
}
```

### Sync Manually

```javascript
// Manual sync trigger:
const { sync, syncStatus } = useSync()

export function SyncButton() {
  return (
    <button 
      onClick={() => sync()}
      disabled={syncStatus === 'syncing'}
    >
      {syncStatus === 'syncing' ? '⟳ Syncing...' : '↻ Sync Now'}
    </button>
  )
}
```

## 🧪 Testing the System

### Run CRDT Tests

```bash
node backend/test-crdt-demo.js
```

Output shows:
- ✓ LWW Register: Newer timestamp wins
- ✓ Vector Clock: Causality tracked correctly
- ✓ Conflict Detection: Concurrent updates identified
- ✓ LWW Resolution: Same result on all devices
- ✓ Offline Sync: Complete workflow demonstrated

### Test Conflict Scenario

```javascript
// In test-crdt-demo.js, Test 5:

// Device A goes offline, makes change
const mutationA = new CRDTMutation({
  record_id: 'D001',
  field: 'status',
  oldValue: 'pending',
  newValue: 'in_transit',
  timestamp: 1000001,
  nodeId: 'boat'
});

// Device B goes offline, makes DIFFERENT change
const mutationB = new CRDTMutation({
  record_id: 'D001',
  field: 'status',
  oldValue: 'pending',
  newValue: 'delayed',
  timestamp: 1000011,
  nodeId: 'drone'
});

// Both sync to server
const conflict = ConflictDetector.detect(mutationA, mutationB);
console.log(conflict); // Shows concurrent conflict

// Server resolves
const winner = ConflictDetector.resolveLWW(mutationA, mutationB);
console.log(winner.newValue); // "delayed" (newer timestamp wins)
```

## 🎓 Key Concepts

```
VECTOR CLOCK
The "causality detector"
│
├─ Tracks: What events happened before what other events
├─ Format: {device-1: 5, device-2: 3}
├─ Increment: When device makes change
├─ Compare: Are these changes concurrent?
│   ├─ If A.VC happens-before B.VC → A caused B (no conflict)
│   ├─ If B.VC happens-before A.VC → B caused A (no conflict)
│   └─ If neither → concurrent (potential conflict)
└─ Never: Don't trust computer clocks for causality


LWW REGISTER
The "conflict resolver"
│
├─ Stores: {value, timestamp, nodeId}
├─ Decision Rule: "Newer timestamp wins"
├─ Tiebreaker: If same timestamp, lexicographic nodeId
├─ Guarantee: Same inputs = same winner on ALL devices
├─ Speed: O(1) comparison, instant
└─ Perfect for: Disaster scenarios with unreliable connectivity


IMMUTABLE LEDGER
The "source of truth"
│
├─ Records: Every mutation that ever happened
├─ Never: Delete or update existing entries
├─ Append: New mutations always added to end
├─ Purpose: Answer "what really happened?" during disputes
├─ Audit: Full history for accountability
└─ Recovery: Can replay history to recover any lost state
```

## 🔗 Integration Points

```
User makes change in UI
    ↓
React component calls recordMutation()
    ↓
syncStore records to IndexedDB (survives offline)
    ↓
Shows ⏳ "Pending" indicator
    ↓
When connectivity detected:
    ↓
POST to /api/sync/delta with mutations
    ↓
Server processes + checks for conflicts
    ↓
If conflict: LWW resolution automatic
    ↓
Response includes serverDelta + resolved values
    ↓
App merges into local state
    ↓
Shows ✓ "Synced" indicator
    ↓
If UI was showing conflict:
    → Show resolution result
    → Update UI with winner
    → Mark as resolved
```

## ⚡ Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Record mutation | O(1) | Just append to memory |
| Conflict detection | O(1) | Simple equality + VC compare |
| LWW resolution | O(1) | Single timestamp comparison |
| Sync with 100 mutations | ~100ms | Network limited, not compute |
| Vector clock comparison | O(k) | k = number of devices (usually <10) |

---

**All 3 questions answered with working code!** 🎉
