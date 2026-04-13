/**
 * Database Migration for Module 1: Authentication & Identity
 * 
 * Creates tables for:
 * - M1.1: Users with OTP secrets
 * - M1.2: Public keys per device
 * - M1.3: Roles for RBAC
 * - M1.4: Audit logs with hash chaining
 */

exports.up = async function (knex) {
  // Users table
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('username').notNullable().unique();
    table.string('password_hash').nullable(); // Optional if using OTP only
    table.enum('role', [
      'FIELD_VOLUNTEER',
      'SUPPLY_MANAGER',
      'DRONE_OPERATOR',
      'CAMP_COMMANDER',
      'SYNC_ADMIN',
    ]).defaultTo('FIELD_VOLUNTEER');
    
    // M1.1: OTP Secret (TOTP)
    table.string('otp_secret').notNullable(); // Base32-encoded TOTP secret
    table.string('otp_backup_codes').nullable(); // Comma-separated backup codes
    
    // M1.2: Public Key
    table.text('public_key').nullable(); // RSA-2048 public key (PEM format)
    table.string('device_id').nullable(); // Device identifier
    table.timestamp('key_registered_at').nullable();
    
    // Metadata
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('last_login_at').nullable();
    table.boolean('is_active').defaultTo(true);
    
    // Indexes
    table.index('username');
    table.index('role');
    table.index('device_id');
  });

  // Audit Logs table (M1.4)
  await knex.schema.createTable('audit_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    // User & Event Info
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.enum('event_type', [
      'LOGIN_SUCCESS',
      'LOGIN_FAILED',
      'OTP_FAILED',
      'OTP_EXPIRED',
      'OTP_ALREADY_USED',
      'PUBLIC_KEY_REGISTERED',
      'LOGOUT',
      'USER_REGISTERED',
      'PERMISSION_DENIED',
      'CREATE_DELIVERY',
      'MODIFY_INVENTORY',
      'WRITE_TRIAGE_DECISION',
      'WRITE_NETWORK_OVERRIDE',
      'CONFLICT_RESOLUTION',
      'TAMPER_DETECTED',
      'CRDT_RESET',
    ]).notNullable();
    
    // Action details
    table.jsonb('details').notNullable(); // {reason, deviceId, etc}
    table.jsonb('metadata').nullable(); // {ip, userAgent, etc}
    
    // Hash Chaining (M1.4)
    table.string('prev_hash').notNullable(); // SHA-256 of previous entry
    table.string('hash').notNullable().unique(); // SHA-256 of this entry
    table.integer('timestamp').notNullable(); // Unix timestamp
    
    // Severity level
    table.enum('severity', ['INFO', 'WARNING', 'CRITICAL']).defaultTo('INFO');
    
    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index('user_id');
    table.index('event_type');
    table.index('hash');
    table.index('prev_hash');
    table.index('created_at');
  });

  // Conflict Resolutions table
  await knex.schema.createTable('conflict_resolutions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('record_id').notNullable();
    table.enum('resolution_type', ['CHOOSE_LOCAL', 'CHOOSE_REMOTE', 'MERGE']).notNullable();
    table.uuid('resolved_by').notNullable().references('id').inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['record_id', 'created_at']);
  });

  // Session tokens table (optional - for token management)
  await knex.schema.createTable('sessions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('device_id').notNullable();
    table.text('refresh_token').notNullable();
    table.timestamp('last_used_at').defaultTo(knex.fn.now());
    table.timestamp('expires_at').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['user_id', 'device_id']);
  });

  console.log('✓ Module 1 tables created');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('sessions');
  await knex.schema.dropTableIfExists('conflict_resolutions');
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('users');
};
