const TOTP_DIGITS = 6;
const TOTP_PERIOD = 30;

function base32ToBytes(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  base32 = base32.replace(/=+$/, '').toUpperCase();
  
  let bits = '';
  for (let i = 0; i < base32.length; i++) {
    const val = alphabet.indexOf(base32[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substr(i, 8), 2));
  }
  return new Uint8Array(bytes);
}

async function hmacSha1(key, message) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, message);
  return new Uint8Array(signature);
}

function truncateHotp(hmacResult) {
  const offset = hmacResult[hmacResult.length - 1] & 0x0f;
  const binary = 
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);
  
  return binary % Math.pow(10, TOTP_DIGITS);
}

async function generateHotp(secret, counter) {
  const counterBytes = new Uint8Array(8);
  let counterValue = counter;
  
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = counterValue & 0xff;
    counterValue = Math.floor(counterValue / 256);
  }
  
  const key = base32ToBytes(secret);
  const hmacResult = await hmacSha1(key, counterBytes);
  return truncateHotp(hmacResult);
}

class OTPService {
  constructor() {
    this.secrets = new Map();
  }

  generateSecret() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    const randomValues = new Uint8Array(20);
    crypto.getRandomValues(randomValues);
    
    for (let i = 0; i < 20; i++) {
      secret += chars[randomValues[i] % chars.length];
    }
    return secret;
  }

  async storeSecret(username, secret) {
    this.secrets.set(username, secret);
    
    const stored = {
      username,
      secret,
      createdAt: Date.now(),
    };
    
    try {
      localStorage.setItem(`otp_secret_${username}`, JSON.stringify(stored));
    } catch (e) {
      console.error('Failed to store secret:', e);
    }
  }

  loadStoredSecrets() {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('otp_secret_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          this.secrets.set(data.username, data.secret);
        } catch (e) {
          console.error('Failed to load secret:', e);
        }
      }
    }
  }

  getCurrentCounter() {
    return Math.floor(Date.now() / 1000 / TOTP_PERIOD);
  }

  async generateTOTP(username) {
    let secret = this.secrets.get(username);
    
    if (!secret) {
      const storedData = localStorage.getItem(`otp_secret_${username}`);
      if (storedData) {
        try {
          const data = JSON.parse(storedData);
          secret = data.secret;
          this.secrets.set(username, secret);
        } catch (e) {
          console.error('Failed to load stored secret:', e);
        }
      }
    }
    
    if (!secret) {
      secret = this.generateSecret();
      await this.storeSecret(username, secret);
    }
    
    const counter = this.getCurrentCounter();
    const otp = await generateHotp(secret, counter);
    
    return {
      otp: otp.toString().padStart(TOTP_DIGITS, '0'),
      remainingSeconds: TOTP_PERIOD - (Math.floor(Date.now() / 1000) % TOTP_PERIOD),
      secret,
    };
  }

  async verifyTOTP(username, token) {
    const secret = this.secrets.get(username);
    
    if (!secret) {
      const storedData = localStorage.getItem(`otp_secret_${username}`);
      if (storedData) {
        try {
          const data = JSON.parse(storedData);
          this.secrets.set(username, data.secret);
        } catch (e) {
          return { valid: false, error: 'No secret found' };
        }
      } else {
        return { valid: false, error: 'No secret found' };
      }
    }
    
    const currentCounter = this.getCurrentCounter();
    
    for (let i = -1; i <= 1; i++) {
      const counter = currentCounter + i;
      const expectedOtp = await generateHotp(secret, counter);
      const expectedStr = expectedOtp.toString().padStart(TOTP_DIGITS, '0');
      
      if (expectedStr === token) {
        return { valid: true, counter };
      }
    }
    
    return { valid: false, error: 'Invalid OTP' };
  }

  getTimeRemaining() {
    return TOTP_PERIOD - (Math.floor(Date.now() / 1000) % TOTP_PERIOD);
  }

  getProvisioningUri(username, secret, issuer = 'DigitalDelta') {
    const base32Secret = secret.replace(/[^A-Z2-7]/gi, '').toUpperCase();
    const label = encodeURIComponent(`${issuer}:${username}`);
    const params = new URLSearchParams({
      secret: base32Secret,
      issuer,
      digits: TOTP_DIGITS.toString(),
      period: TOTP_PERIOD.toString(),
    });
    return `otpauth://totp/${label}?${params.toString()}`;
  }
}

const otpService = new OTPService();

export { otpService, TOTP_DIGITS, TOTP_PERIOD };
export default otpService;
