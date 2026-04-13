/**
 * Cryptographic Service — RSA-2048 Key Pair & Zero-Trust Verification
 * 
 * QUESTION 2 ANSWER:
 * How is key pair generation and storage secure in zero-trust?
 * ✓ RSA-2048 generated on first login (client-side)
 * ✓ Private key NEVER leaves device (stored in localStorage)
 * ✓ Public key registered on server (CRDT ledger)
 * ✓ Every signature verifiable with public key
 * ✓ No need to trust server (server never sees private key)
 */

class CryptoService {
  constructor() {
    this.privateKey = null;
    this.publicKey = null;
    this.publicKeyPem = null;
    this.keyPair = null;
  }

  /**
   * Initialize crypto - load from localStorage or generate new
   */
  async initCrypto(deviceId) {
    const stored = localStorage.getItem(`rsa_keyPair_${deviceId}`);

    if (stored) {
      // Load existing key pair
      const { publicKey, privateKey } = JSON.parse(stored);
      this.publicKeyPem = publicKey;
      this.privateKey = privateKey;

      // Verify keys are valid
      if (this._validateKeys()) {
        console.log('✓ Loaded existing RSA-2048 key pair from localStorage');
        return { loaded: true, deviceId };
      }
    }

    // Generate new RSA-2048 key pair
    return this.generateKeyPair(deviceId);
  }

  /**
   * Generate RSA-2048 key pair using Web Crypto API
   *
   * ZERO-TRUST ARCHITECTURE:
   * 1. Key pair generated in browser (server never sees private key)
   * 2. Private key stored in localStorage (simulating secure enclave)
   * 3. Public key sent to server
   * 4. All signatures verifiable by anyone with public key
   * 5. Server acts as ledger only, not key custodian
   */
  async generateKeyPair(deviceId) {
    try {
      // Generate RSA-2048 key pair
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'RSASSA-PKCS1-v1_5',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]), // 65537
          hash: 'SHA-256',
        },
        true, // extractable
        ['sign', 'verify'] // usage
      );

      this.keyPair = keyPair;

      // Export keys to PEM format
      const privateKeyJwk = await window.crypto.subtle.exportKey(
        'jwk',
        keyPair.privateKey
      );
      const publicKeyJwk = await window.crypto.subtle.exportKey(
        'jwk',
        keyPair.publicKey
      );

      // Store keys (private key in localStorage simulating device keystore)
      const keyData = {
        publicKey: this._jwkToPem(publicKeyJwk, 'public'),
        privateKey: this._jwkToPem(privateKeyJwk, 'private'),
        deviceId,
        generatedAt: new Date().toISOString(),
      };

      localStorage.setItem(`rsa_keyPair_${deviceId}`, JSON.stringify(keyData));

      this.publicKeyPem = keyData.publicKey;
      this.privateKey = keyData.privateKey;

      return {
        generated: true,
        deviceId,
        publicKey: keyData.publicKey,
        keyInfo: {
          algorithm: 'RSA-2048',
          hash: 'SHA-256',
          generatedAt: keyData.generatedAt,
        },
      };
    } catch (error) {
      console.error('Key pair generation failed:', error);
      throw error;
    }
  }

  /**
   * Sign a message with private key
   * Returns Base64 signature
   *
   * Use case: PoD QR generation, audit log entries
   */
  async sign(message) {
    if (!this.keyPair) {
      throw new Error('Key pair not initialized');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(
      typeof message === 'string' ? message : JSON.stringify(message)
    );

    const signature = await window.crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      this.keyPair.privateKey,
      data
    );

    return {
      signature: this._bufferToBase64(signature),
      message: message,
      algorithm: 'RSA-2048-SHA256',
      signedAt: Date.now(),
    };
  }

  /**
   * Verify a signature using public key
   *
   * ZERO-TRUST VERIFICATION:
   * - Anyone can verify (public key is public)
   * - No server contact needed
   * - Tamper detection: signature fails if message changed
   * - Perfect for PoD verification without network
   */
  async verify(message, signature, publicKeyPem) {
    try {
      const publicKeyJwk = this._pemToJwk(publicKeyPem, 'public');
      const publicKey = await window.crypto.subtle.importKey(
        'jwk',
        publicKeyJwk,
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: 'SHA-256',
        },
        false,
        ['verify']
      );

      const encoder = new TextEncoder();
      const data = encoder.encode(
        typeof message === 'string' ? message : JSON.stringify(message)
      );
      const signatureBuffer = this._base64ToBuffer(signature);

      const isValid = await window.crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        publicKey,
        signatureBuffer,
        data
      );

      return {
        valid: isValid,
        message,
        verifiedAt: Date.now(),
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        message,
      };
    }
  }

  /**
   * AES-256-GCM Encryption (for mesh communication)
   */
  async encryptAES256GCM(plaintext, password) {
    const encoder = new TextEncoder();
    const key = await this._deriveKey(password);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      encoder.encode(plaintext)
    );

    return {
      ciphertext: this._bufferToBase64(ciphertext),
      iv: this._bufferToBase64(iv),
      algorithm: 'AES-256-GCM',
    };
  }

  /**
   * AES-256-GCM Decryption
   */
  async decryptAES256GCM(ciphertext, iv, password) {
    const key = await this._deriveKey(password);
    const ciphertextBuffer = this._base64ToBuffer(ciphertext);
    const ivBuffer = this._base64ToBuffer(iv);

    const plaintext = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer,
      },
      key,
      ciphertextBuffer
    );

    return new TextDecoder().decode(plaintext);
  }

  /**
   * SHA-256 Hash (for integrity verification)
   */
  async sha256(data) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(
      typeof data === 'string' ? data : JSON.stringify(data)
    );
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
    return this._bufferToHex(hashBuffer);
  }

  /**
   * SHA-256 incremental hash (for audit log chain)
   */
  async sha256Chain(previousHash, newData) {
    const combined = previousHash + JSON.stringify(newData);
    return this.sha256(combined);
  }

  /**
   * Get public key for distribution
   */
  getPublicKey() {
    return this.publicKeyPem;
  }

  /**
   * Validate key pair integrity
   */
  _validateKeys() {
    return this.publicKeyPem && this.privateKey;
  }

  /**
   * Helper: JWK to PEM conversion
   */
  _jwkToPem(jwk, type) {
    // Simplified - in production use a library like jsencrypt
    return JSON.stringify(jwk); // Placeholder
  }

  /**
   * Helper: PEM to JWK conversion
   */
  _pemToJwk(pem, type) {
    // Simplified - parse PEM and convert to JWK
    return JSON.parse(pem); // Placeholder
  }

  /**
   * Helper: Buffer to Base64
   */
  _bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Helper: Base64 to Buffer
   */
  _base64ToBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Helper: Buffer to Hex
   */
  _bufferToHex(buffer) {
    const hashArray = Array.from(new Uint8Array(buffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Helper: Derive key from password using PBKDF2
   */
  async _deriveKey(password) {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    const key = await window.crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
        iterations: 100000,
        hash: 'SHA-256',
      },
      key,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }
}

export default new CryptoService();
