/**
 * Server-side OTP Service
 * Used for validating OTP codes received from clients
 * Implements RFC 6238 (TOTP) and RFC 4226 (HOTP)
 */

const crypto = require('crypto');

class OTPService {
  constructor() {
    this.window = 30; // 30-second time window
    this.digits = 6; // 6-digit OTP
    this.usedTokens = new Map(); // Track used tokens: userId -> { token, timestamp }
  }

  /**
   * Generate HOTP (Counter-based)
   * RFC 4226
   */
  generateHOTP(secret, counter) {
    // Decode base32 secret
    const secretBuffer = this._base32Decode(secret);

    // Counter as 8-byte big-endian
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(counter));

    // HMAC-SHA1(secret, counter)
    const hmac = crypto
      .createHmac('sha1', secretBuffer)
      .update(counterBuffer)
      .digest();

    // Dynamic truncation (RFC 4226 Section 5.3)
    const offset = hmac[hmac.length - 1] & 0xf;
    const otp =
      (((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff)) %
      Math.pow(10, this.digits);

    return String(otp).padStart(this.digits, '0');
  }

  /**
   * Generate TOTP (Time-based)
   * RFC 6238
   */
  generateTOTP(secret, timestamp = null) {
    timestamp = timestamp || Math.floor(Date.now() / 1000);
    const counter = Math.floor(timestamp / this.window);
    return this.generateHOTP(secret, counter);
  }

  /**
   * Verify TOTP token with protection against replay attacks
   *
   * Security checks:
   * 1. Time window validation (±1 window for clock skew)
   * 2. Expiry check: reject if older than 30 seconds
   * 3. Reuse prevention: reject if same token used twice by same user
   */
  verifyTOTP(userId, secret, token, timestamp = null) {
    timestamp = timestamp || Math.floor(Date.now() / 1000);
    const currentCounter = Math.floor(timestamp / this.window);

    // Check replay: has this user used this token recently?
    const usedToken = this.usedTokens.get(userId);
    if (usedToken && usedToken.token === token) {
      const secondsSinceUse = timestamp - usedToken.timestamp;
      if (secondsSinceUse < this.window) {
        return {
          valid: false,
          error: 'TOTP_ALREADY_USED',
          message: 'Token already used. Wait for next window.',
          remainingSeconds: this.window - secondsSinceUse,
        };
      }
    }

    // Check expiry: is token older than time window?
    const expiryTime = timestamp - this.window;
    const tokenTime = Math.floor(this._getTokenTimestamp(token, currentCounter) / this.window) * this.window;
    
    if (tokenTime < expiryTime) {
      return {
        valid: false,
        error: 'TOTP_EXPIRED',
        message: 'Token expired. Generate new token.',
      };
    }

    // Verify: does provided token match current or adjacent windows?
    // RFC 6238 Section 5.2: allow ±1 window for clock skew
    const validTokens = [
      this.generateHOTP(secret, currentCounter - 1),
      this.generateHOTP(secret, currentCounter),
      this.generateHOTP(secret, currentCounter + 1),
    ];

    if (!validTokens.includes(token)) {
      return {
        valid: false,
        error: 'TOTP_INVALID',
        message: 'Invalid token. Check your code and device time.',
      };
    }

    // ✓ Valid token - record for replay prevention
    this.usedTokens.set(userId, {
      token,
      timestamp,
    });

    return {
      valid: true,
      token,
      usedAt: new Date(timestamp * 1000).toISOString(),
      expiresAt: new Date((timestamp + this.window) * 1000).toISOString(),
    };
  }

  /**
   * Generate random base32 secret for TOTP setup
   * Suitable for user registration/setup
   */
  generateSecret(length = 32) {
    const buffer = crypto.randomBytes(Math.ceil(length * 5 / 8));
    return this._base32Encode(buffer);
  }

  /**
   * Generate TOTP provisioning URI for QR code
   * Format: otpauth://totp/?secret=XXX&issuer=DigitalDelta&period=30
   */
  generateProvisioningURI(username, secret, issuer = 'DigitalDelta') {
    const base32Secret = typeof secret === 'string' ? secret : this._base32Encode(secret);
    return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(
      username
    )}?secret=${base32Secret}&issuer=${encodeURIComponent(issuer)}&period=30&digits=6&algorithm=SHA1`;
  }

  /**
   * Get countdown seconds until token expires
   */
  getCountdownSeconds(timestamp = null) {
    timestamp = timestamp || Math.floor(Date.now() / 1000);
    return this.window - (timestamp % this.window);
  }

  /**
   * Check if token will expire soon
   */
  isExpiringSoon(thresholdSeconds = 5) {
    return this.getCountdownSeconds() < thresholdSeconds;
  }

  /**
   * Clear used token cache (for testing or admin)
   */
  clearUsedTokens() {
    this.usedTokens.clear();
  }

  /**
   * Get used token for a user
   */
  getUsedToken(userId) {
    return this.usedTokens.get(userId) || null;
  }

  /**
   * Base32 decode (RFC 4648)
   */
  _base32Decode(input) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const bytes = [];

    for (let i = 0; i < input.length; i += 8) {
      const chunk = input.substr(i, 8).padEnd(8, 'A');
      let bits = 0;

      for (let j = 0; j < 8; j++) {
        bits = (bits << 5) | chars.indexOf(chunk[j]);
      }

      for (let j = 0; j < 5; j++) {
        bytes.push((bits >> (32 - (j + 1) * 8)) & 0xff);
      }
    }

    return Buffer.from(bytes);
  }

  /**
   * Base32 encode (RFC 4648)
   */
  _base32Encode(buffer) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;

      while (bits >= 5) {
        output += chars[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += chars[(value << (5 - bits)) & 31];
    }

    return output;
  }

  /**
   * Get approximate timestamp when token was generated
   */
  _getTokenTimestamp(token, counter) {
    return counter * this.window;
  }

  /**
   * Export state for monitoring
   */
  exportState() {
    return {
      window: this.window,
      digits: this.digits,
      usedTokensCount: this.usedTokens.size,
    };
  }
}

// Export singleton instance
module.exports = new OTPService();
