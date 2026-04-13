#!/usr/bin/env node

/**
 * Digital Delta Authentication & RBAC Demo
 * 
 * This script demonstrates:
 * 1. Complete login flow with OTP generation and verification
 * 2. Role-based access control on different endpoints
 * 3. Authorization failures for insufficient permissions
 * 
 * Usage: node test-auth-rbac.js
 */

const API_BASE = 'http://localhost:3001/api';

// Test scenarios
const scenarios = {
  loginFlow: {
    title: '1. Complete Login Flow',
    description: 'Register user, generate OTP, login, and obtain JWT token'
  },
  rbacDelivery: {
    title: '2. RBAC - Delivery Endpoint',
    description: 'Test role-based access to delivery operations'
  },
  rbacFleet: {
    title: '3. RBAC - Fleet Operations (Drone Operator)',
    description: 'Test drone operator permissions for fleet rendezvous'
  },
  rbacSync: {
    title: '4. RBAC - Sync Endpoint (Commander Only)',
    description: 'Test sync delta posting requires start_sync permission'
  },
  unauthorizedAccess: {
    title: '5. Unauthorized Access Test',
    description: 'Attempt to access admin-only endpoints with volunteer role'
  }
};

console.log('\n🔐 Digital Delta Authentication & RBAC Test Suite\n');
console.log('=' .repeat(60));
console.log('Available scenarios:');
Object.entries(scenarios).forEach(([key, val]) => {
  console.log(`  ${key}: ${val.title}`);
  console.log(`          ${val.description}\n`);
});

console.log('=' .repeat(60));
console.log('\n📝 Role Hierarchy (highest to lowest):');
console.log('  SYNC_ADMIN (admin) > CAMP_COMMANDER (commander) > DRONE_OPERATOR (drone_operator)');
console.log('           > SUPPLY_MANAGER (manager) > FIELD_VOLUNTEER (volunteer)\n');

console.log('📋 Permission Matrix:');
console.log('  Admin:         All permissions');
console.log('  Commander:     Triage, Network, Sync, Audit');
console.log('  Drone Operator: Fleet operations, view deliveries');
console.log('  Manager:       Inventory, supply chain, deliveries');
console.log('  Volunteer:     View-only deliveries and inventory\n');

// Sample test case demonstrating API calls
async function testLoginFlow() {
  console.log('\n🧪 Test: Complete Login Flow\n');
  
  try {
    // Step 1: Check if user exists (first time user)
    console.log('  Step 1: Check user existence...');
    let response = await fetch(`${API_BASE}/auth/check/testuser1`, {
      method: 'GET'
    });
    let data = await response.json();
    console.log(`    ✓ User exists: ${data.exists}`);
    
    if (!data.exists) {
      console.log('\n  Step 2: Auto-register with role selection...');
      // Frontend will generate OTP secret and send it
      response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testuser1',
          role: 'commander',
          otp: '123456', // Demo bypass
          deviceId: 'device-001'
        })
      });
      data = await response.json();
      
      if (response.ok) {
        console.log(`    ✓ User registered: ${data.user.username}`);
        console.log(`    ✓ Role assigned: ${data.user.role}`);
        if (data.newSecret) {
          console.log(`    ✓ OTP Secret generated (store in authenticator app)`);
        }
      } else {
        console.log(`    ✗ Failed: ${data.message}`);
        return;
      }
    }
    
    // Step 3: Login with OTP
    console.log('\n  Step 3: Login with OTP verification...');
    response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser1',
        otp: '123456', // Demo bypass (real OTP in production)
        role: 'commander',
        deviceId: 'device-001'
      })
    });
    data = await response.json();
    
    if (response.ok && data.token) {
      console.log(`    ✓ OTP verified`);
      console.log(`    ✓ JWT token issued: ${data.token.substring(0, 20)}...`);
      console.log(`    ✓ User role: ${data.user.role}`);
      
      // Step 4: Test authenticated request
      console.log('\n  Step 4: Access protected endpoint with token...');
      response = await fetch(`${API_BASE}/deliveries`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${data.token}`
        }
      });
      data = await response.json();
      
      if (response.ok) {
        console.log(`    ✓ Successfully accessed deliveries endpoint`);
        console.log(`    ✓ Retrieved ${data.deliveries?.length || 0} deliveries`);
      }
      
      return data.token;
    } else {
      console.log(`    ✗ Login failed: ${data.message}`);
    }
  } catch (error) {
    console.error(`    ✗ Error: ${error.message}`);
  }
}

async function testRBACViolation() {
  console.log('\n🧪 Test: RBAC Violation (Unauthorized Access)\n');
  
  try {
    // First login as volunteer
    console.log('  Step 1: Login as volunteer...');
    let response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'volunteer1',
        role: 'volunteer',
        otp: '123456',
        deviceId: 'device-002'
      })
    });
    let data = await response.json();
    
    if (!response.ok) {
      console.log('    ℹ  User needs to register first');
      // Register volunteer
      response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'volunteer1',
          role: 'volunteer',
          otp: '123456',
          deviceId: 'device-002'
        })
      });
      data = await response.json();
    }
    
    if (response.ok && data.token) {
      console.log(`    ✓ Logged in as: ${data.user.role}`);
      
      // Step 2: Attempt to access admin-only endpoint
      console.log('\n  Step 2: Attempt to access admin-only audit logs...');
      response = await fetch(`${API_BASE}/auth/audit/logs`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${data.token}`
        }
      });
      
      if (response.status === 403) {
        const errorData = await response.json();
        console.log(`    ✓ Access denied as expected`);
        console.log(`    ✓ Error: ${errorData.message}`);
      } else if (response.ok) {
        console.log(`    ✗ Unexpectedly granted access!`);
      }
      
      // Step 3: Attempt to perform operation requiring higher role
      console.log('\n  Step 3: Volunteer attempts to update delivery (requires manager+)...');
      response = await fetch(`${API_BASE}/deliveries/D123/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${data.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'in_transit' })
      });
      
      if (response.status === 403) {
        const errorData = await response.json();
        console.log(`    ✓ Operation denied as expected`);
        console.log(`    ✓ Error: ${errorData.message}`);
      } else {
        console.log(`    Status: ${response.status}`);
      }
    }
  } catch (error) {
    console.error(`    ✗ Error: ${error.message}`);
  }
}

// Instructions for manual testing
console.log('\n📖 Manual Testing Instructions:\n');
console.log('1. Start backend server:');
console.log('   cd backend && npm run dev\n');

console.log('2. Example: Login flow in browser console or curl:');
console.log('   curl -X POST http://localhost:3001/api/auth/login \\');
console.log('     -H "Content-Type: application/json" \\');
console.log('     -d \'{"username":"test1","role":"commander","otp":"123456"}\'\n');

console.log('3. Use returned JWT for subsequent requests:');
console.log('   curl -X GET http://localhost:3001/api/deliveries \\');
console.log('     -H "Authorization: Bearer <JWT_TOKEN>"\n');

console.log('4. Observe RBAC in action:');
console.log('   - Commander CAN: view/create deliveries, start sync');
console.log('   - Volunteer CANNOT: modify deliveries, view audit logs\n');

console.log('=' .repeat(60));
console.log('\n✅ Authentication System Features Implemented:\n');
console.log('✓ OTP generation and verification (TOTP RFC 6238)');
console.log('✓ Role-based access control (5-tier hierarchy)');
console.log('✓ Permission matrix per role');
console.log('✓ JWT token issuance and verification');
console.log('✓ Audit logging of all auth events');
console.log('✓ Demo mode for development (NODE_ENV=development)');
console.log('✓ Production-ready TOTP verification');
console.log('\n' + '=' .repeat(60) + '\n');

// Run tests if explicitly called (for automated CI/CD later)
const args = process.argv.slice(2);
if (args.includes('--run')) {
  (async () => {
    await testLoginFlow();
    await testRBACViolation();
  })();
}

export { testLoginFlow, testRBACViolation };
