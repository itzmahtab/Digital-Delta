# Digital Delta CRDT System - Visual Architecture

## 🏗️ System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DIGITAL DELTA DISASTER RELIEF                        │
│                       Offline-First CRDT Sync System                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────┐      ┌──────────────────────┐     ┌─────────────────────────────┐
│    DEVICE A (Boat Team)     │      │  DEVICE B (Drone)    │     │  DEVICE C (Team Lead)       │
│  - Mobile Phone             │      │  - Tablet            │     │  - Laptop                   │
│  - 3G/WiFi (unreliable)     │      │  - WiFi Only (offline)      │  - WiFi (occasionally up)  │
├─────────────────────────────┤      ├──────────────────────┤     ├─────────────────────────────┤
│                             │      │                      │     │                             │
│ React App                   │      │ React App            │     │ React App                   │
│  ↓                          │      │  ↓                   │     │  ↓                          │
│ Zustand State Manager       │      │ Zustand State Manager│     │ Zustand State Manager       │
│  ├─ useSync store           │      │  ├─ useSync store    │     │  ├─ useSync store           │
│  └─ trackMutations()        │      │  └─ trackMutations() │     │  └─ trackMutations()        │
│  ↓                          │      │  ↓                   │     │  ↓                          │
│ IndexedDB                   │      │ IndexedDB            │     │ IndexedDB                   │
│ ┌──────────────────────┐    │      │ ┌─────────────────┐  │     │ ┌──────────────────────┐    │
│ │ Mutations Table      │    │      │ │ Mutations Table │  │     │ │ Mutations Table      │    │
│ │ ┌────────────────┐   │    │      │ │ ┌─────────────┐ │  │     │ │ ┌────────────────┐   │    │
│ │ │Delivery D001   │   │    │      │ │ │Delivery D001│ │  │     │ │ │Delivery D001   │   │    │
│ │ │status→         │   │    │      │ │ │status→      │ │  │     │ │ │status→         │   │    │
│ │ │"in_transit"    │   │    │      │ │ │"delayed"    │ │  │     │ │ │"pending"       │   │    │
│ │ │TS: 1000001     │   │    │      │ │ │TS: 1000011  │ │  │     │ │ │TS: (none yet)  │   │    │
│ │ │VC: {A:1,B:0}   │   │    │      │ │ │VC: {A:0,B:1}│ │  │     │ │ │VC: {A:0,B:0}   │   │    │
│ │ │Node: boat-1    │   │    │      │ │ │Node: drone-1│ │  │     │ │ │Node: lead-1    │   │    │
│ │ └────────────────┘   │    │      │ │ └─────────────┘ │  │     │ │ └────────────────┘   │    │
│ └──────────────────────┘    │      │ └─────────────────┘ │  │     │ └──────────────────────┘    │
│  ↓                          │      │  ↓                   │     │  ↓                          │
│ CRDT Service Layer          │      │ CRDT Service Layer   │     │ CRDT Service Layer          │
│ ┌──────────────────────┐    │      │ ┌─────────────────┐  │     │ ┌──────────────────────┐    │
│ │ LWWRegister          │    │      │ │ LWWRegister     │  │     │ │ LWWRegister          │    │
│ │ {val, ts, node}      │    │      │ │ {val, ts, node} │  │     │ │ {val, ts, node}      │    │
│ ├──────────────────────┤    │      │ ├─────────────────┤  │     │ ├──────────────────────┤    │
│ │ VectorClock          │    │      │ │ VectorClock     │  │     │ │ VectorClock          │    │
│ │ {A:1, B:0}           │    │      │ │ {A:0, B:1}      │  │     │ │ {A:0, B:0}           │    │
│ ├──────────────────────┤    │      │ ├─────────────────┤  │     │ ├──────────────────────┤    │
│ │ ConflictDetector     │    │      │ │ ConflictDetector│  │     │ │ ConflictDetector     │    │
│ │ .detect()            │    │      │ │ .detect()       │  │     │ │ .detect()            │    │
│ │ .resolveLWW()        │    │      │ │ .resolveLWW()   │  │     │ │ .resolveLWW()        │    │
│ ├──────────────────────┤    │      │ ├─────────────────┤  │     │ ├──────────────────────┤    │
│ │ OfflineSyncEngine    │    │      │ │ SyncEngine      │  │     │ │ SyncEngine           │    │
│ │ .recordMutation()    │    │      │ │ .recordMutation │  │     │ │ .recordMutation()    │    │
│ │ .mergeMutations()    │    │      │ │ .mergeMutations │  │     │ │ .mergeMutations()    │    │
│ └──────────────────────┘    │      │ └─────────────────┘ │  │     │ └──────────────────────┘    │
│                             │      │                     │     │                             │
│ Status: OFFLINE ❌          │      │ Status: OFFLINE ❌  │     │ Status: ONLINE ✓           │
└─────────────────────────────┘      └──────────────────────┘     └─────────────────────────────┘
        │                                     │                            │
        │     ┌─── (later) ─── ┌─────────────┴──────────────┐              │
        │     │                │                            │              │
        ┃     ┃ [HTTP Post]    ┃                            ┃              ┃
        ┃     ┃                ┃                            ┃              ┃
        └─────────────────────────────────────────────────────────────────┘
                                        │
                                        ↓
                    ┌──────────────────────────────────┐
                    │   AWS SERVER (Express.js)        │
                    ├──────────────────────────────────┤
                    │  POST /api/sync/delta            │
                    │                                  │
                    │  1. Receive mutations from A, B  │
                    │  2. Check mutation_ledger        │
                    │  3. Detect conflicts:            │
                    │     - Same record? YES           │
                    │     - Same field? YES            │
                    │     - Different values? YES      │
                    │     - Concurrent? (VC check)     │
                    │       A.VC={1,0} B.VC={0,1}      │
                    │       Neither happens-before     │
                    │       → CONCURRENT ✓             │
                    │                                  │
                    │  4. Apply LWW Resolution:        │
                    │     A.ts(1000001)                │
                    │     B.ts(1000011) ← WINNER       │
                    │     1000011 > 1000001? YES       │
                    │     Result: "delayed"            │
                    │                                  │
                    │  5. Update mutation_ledger       │
                    │     (immutable, append-only)     │
                    │  6. Record conflict resolution   │
                    │  7. Send delta to all devices    │
                    │     A: "Now status='delayed'"    │
                    │     B: "Synced, you were right"  │
                    │     C: "New status available"    │
                    │                                  │
                    │  Response:                       │
                    │  {                               │
                    │    serverDelta: [...],           │
                    │    serverVC: {A:1, B:1},         │
                    │    conflicts: [                  │
                    │      {                           │
                    │        field: "status",          │
                    │        resolved_to: "delayed",   │
                    │        reason: "lww"             │
                    │      }                           │
                    │    ]                             │
                    │  }                               │
                    │                                  │
                    ├──────────────────────────────────┤
                    │  PostgreSQL                      │
                    │  ┌────────────────────────────┐  │
                    │  │ mutation_ledger            │  │
                    │  │ (immutable, audit trail)   │  │
                    │  │ ┌──────────────────────┐   │  │
                    │  │ │ID: mut-boat-1        │   │  │
                    │  │ │D001, status, deleted │   │  │
                    │  │ │TS: 1000001, VC:...   │   │  │
                    │  │ └──────────────────────┘   │  │
                    │  │ ┌──────────────────────┐   │  │
                    │  │ │ID: mut-drone-1       │   │  │
                    │  │ │D001, status, delayed │   │  │
                    │  │ │TS: 1000011, VC:...   │   │  │
                    │  │ └──────────────────────┘   │  │
                    │  │ ┌──────────────────────┐   │  │
                    │  │ │ID: conflict-res-1    │   │  │
                    │  │ │Resolved D001 status  │   │  │
                    │  │ │Winner: drone-1       │   │  │
                    │  │ │Reason: lww_timestamp │   │  │
                    │  │ └──────────────────────┘   │  │
                    │  └────────────────────────────┘  │
                    │                                  │
                    │  ┌────────────────────────────┐  │
                    │  │ deliveries table           │  │
                    │  │ ┌──────────────────────┐   │  │
                    │  │ │D001:                 │   │  │
                    │  │ │ status: "delayed"    │   │  │
                    │  │ │ updated_at: server   │   │  │
                    │  │ │ updated_by: LWW algo │   │  │
                    │  │ └──────────────────────┘   │  │
                    │  └────────────────────────────┘  │
                    │                                  │
                    └──────────────────────────────────┘
                                        │
                        ┌───────────────┼───────────────┐
                        ↓               ↓               ↓
                    [B gets]        [A gets]        [C gets]
                      delta           delta           delta
                        │               │               │
                        ↓               ↓               ↓
              ┌─────────────────┐  ┌──────────────┐  ┌──────────────┐
              │ Device B        │  │ Device A     │  │ Device C     │
              │                 │  │              │  │              │
              │ Merge response: │  │ Merge delta: │  │ Merge delta: │
              │ ✓ Synced        │  │ status=      │  │ Sees update: │
              │                 │  │ "delayed"    │  │ "delayed" ✓  │
              │ Status updated: │  │ ✓ Synced     │  │              │
              │ "delayed"       │  │              │  │ All 3 now    │
              │ (you were right)│  │ Updated from │  │ see same     │
              │                 │  │ "in_transit" │  │ value!       │
              │ UI shows:       │  │              │  │              │
              │ ✓ "Synced"      │  │ UI shows:    │  │ UI shows:    │
              │ ✅ Conflict     │  │ ✓ "Synced"   │  │ ✓ "Synced"   │
              │    Resolved     │  │              │  │              │
              └─────────────────┘  └──────────────┘  └──────────────┘
```

## 🔄 Conflict Resolution Flow

```
START: Two devices offline, same field changed differently
        │
        ├─ Device A: status="in_transit" (ts=1000001, vc={A:1,B:0})
        └─ Device B: status="delayed" (ts=1000011, vc={A:0,B:1})
        
        ↓
        
CHECK 1: Same record?
├─ A.record_id == B.record_id? (both D001)
├─ Result: YES ✓
└─ Continue...

        ↓
        
CHECK 2: Same field?
├─ A.field == B.field? (both "status")
├─ Result: YES ✓
└─ Continue...

        ↓
        
CHECK 3: Different values?
├─ A.value != B.value? ("in_transit" != "delayed")
├─ Result: YES ✓
└─ Continue...

        ↓
        
CHECK 4: Concurrent (not causally ordered)?
├─ Does A happen-before B?
│  └─ Check: A.vc {1,0} happens-before B.vc {0,1}?
│     └─ NO (A[drone]=0 < B[drone]=1, but A[boat]=1 > B[boat]=0)
│
├─ Does B happen-before A?
│  └─ Check: B.vc {0,1} happens-before A.vc {1,0}?
│     └─ NO (B[boat]=0 < A[boat]=1, but B[drone]=1 > A[drone]=0)
│
└─ Neither happens before the other
   → CONCURRENT ✓

        ↓
        
🚨 CONFLICT DETECTED 🚨
Type: concurrent_write
Severity: auto-resolvable

        ↓
        
RESOLUTION PHASE 1: Compare Timestamps
├─ A.timestamp: 1000001
├─ B.timestamp: 1000011
├─ 1000011 > 1000001?
└─ YES! → B is newer → B wins ✓

        ↓
        
DECISION: Apply B's value
├─ Winner: B
├─ New value: "delayed"
├─ New timestamp: 1000011
└─ New nodeId: "drone-1"

        ↓
        
AUDIT LOG: Record the decision
├─ conflict_id: conflict-D001-status-123456
├─ competing_mutations: [A, B]
├─ resolution_strategy: "lww"
├─ winner: B
├─ reason: "timestamp_1000011 > 1000001"
└─ resolved_at: NOW

        ↓
        
PROPAGATE: Notify all devices
├─ Device A: "status updated to 'delayed' by server"
├─ Device B: "sync confirmed, you had the newer update"
└─ Device C: "delivery status is now 'delayed'"

        ↓
        
FINAL STATE: All devices consistent
├─ Device A.D001.status = "delayed" ✓
├─ Device B.D001.status = "delayed" ✓
├─ Device C.D001.status = "delayed" ✓
└─ Server.D001.status = "delayed" ✓

✅ CONFLICT RESOLVED AUTOMATICALLY
   No manual intervention needed
   All teams immediately agree
   Disaster relief operation continues
```

## 📊 Vector Clock Causality Visualization

```
SCENARIO: Three devices make changes sequentially and concurrently

Timeline:
10:00:00  Device A takes delivery D001
          VC_A = {A:1, B:0, C:0}
          
10:00:05  Device A delivers to first location
          VC_A = {A:2, B:0, C:0}
          
10:00:10  Device A syncs with B (learns about B's existence)
          VC_A = {A:2, B:1, C:0}  ← Now aware of B
          VC_B = {A:0, B:1, C:0}
          
10:00:15  Device B changes status
          VC_B = {A:0, B:2, C:0}
          
          Device C (offline) changes same field
          VC_C = {A:0, B:0, C:1}  ← Unaware of A and B
          
10:00:20  BOTH B and C go online


VECTOR CLOCK ANALYSIS:

Event: A makes change 1
  VC = {A:1, B:0, C:0}
  "A has 1 event, no knowledge of B or C"

Event: B makes change 1
  VC = {A:0, B:1, C:0}
  "B has 1 event, no knowledge of A or C"
  
  Do they conflict?
  A.vc={1,0,0} happens-before B.vc={0,1,0}?
  A[A]=1 > B[A]=0 → NO
  B[B]=1 > A[B]=0 → YES (B is aware of B)
  Result: NOT ordered → CONCURRENT ✓

Event: A makes change 2
  VC = {A:2, B:0, C:0}
  "A has 2 events, still unaware of B"
  
  Does A2 causally follow A1?
  A1.vc={1,0,0} happens-before A2.vc={2,0,0}?
  All entries of A1 ≤ A2? YES
  Result: A2 causally after A1 ✓ (not a conflict)

Event: A syncs with B
  Now: VC_A = {A:2, B:1, C:0}
  "A now knows about B's first event"

Event: B makes change 2 (after sync with A)
  VC_B = {A:2, B:2, C:0}
  "B knows about A's 2 events"
  
  Does B2 causally follow A2?
  A2.vc={2,0,0} happens-before B2.vc={2,2,0}?
  All entries of A2 ≤ B2?
  {2,0,0} ≤ {2,2,0}? YES
  Result: B2 is after A2 causally ✓ (not a conflict)

Event: C makes change 1 (still offline)
  VC_C = {A:0, B:0, C:1}
  "C unaware of A and B"
  
  Does C1 conflict with B2?
  B2.vc={2,2,0} happens-before C1.vc={0,0,1}?
  All entries of B2 ≤ C1?
  {2,2,0} ≤ {0,0,1}? NO (B2[A]=2 > C1[A]=0)
  
  Does C1 happen-before B2?
  C1.vc={0,0,1} happens-before B2.vc={2,2,0}?
  All entries of C1 ≤ B2?
  {0,0,1} ≤ {2,2,0}? NO (C1[C]=1 > B2[C]=0)
  
  Result: CONCURRENT (neither ordered) ✓ CONFLICT
```

## 🎯 Key Guarantees

```
┌──────────────────────────────────────────────────────────┐
│      GUARANTEE 1: EVENTUAL CONSISTENCY                   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  All replicas eventually show the same value             │
│                                                          │
│  Maximum time: max(network latency, device response)    │
│  Offline: Minutes → Hours → Days (depending on sync)    │
│                                                          │
│  Example: After all devices sync, everyone sees         │
│           "delayed" for delivery D001                   │
│                                                          │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│      GUARANTEE 2: CAUSAL CONSISTENCY                     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  If A causes B, all devices see A before B              │
│                                                          │
│  Causality tracked by: Vector Clocks                    │
│  preserved by: Immutable ledger                         │
│                                                          │
│  Example: "Order placed" always before "Payment made"   │
│           on every device                               │
│                                                          │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│    GUARANTEE 3: DETERMINISTIC MERGE                      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Same inputs always produce same output                  │
│  No voting, no coordinator, no tie-breaker needed       │
│                                                          │
│  Algorithm: LWW (newer timestamp always wins)          │
│  Tiebreaker: Lexicographic nodeId                       │
│                                                          │
│  Example: All 50 teams compute same conflict winner     │
│           independently, without communication          │
│                                                          │
│  Result: No split-brain, no manual arbitration needed   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

**Visual Architecture Complete!** 🎨
