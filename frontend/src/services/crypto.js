/**
 * Web Crypto API wrapper for RSA-PSS signing and verification
 */

const KEY_ALGO = {
  name: 'RSA-PSS',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
};

export async function generateKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    KEY_ALGO,
    true, // extractable
    ['sign', 'verify']
  );

  const publicKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);

  return {
    publicKey: publicKeyJwk,
    privateKey: privateKeyJwk,
    keyPair,
  };
}

export async function storeKeys(username, keys) {
  try {
    localStorage.setItem(`dd_pkey_${username}`, JSON.stringify(keys.privateKey));
    localStorage.setItem(`dd_pubk_${username}`, JSON.stringify(keys.publicKey));
  } catch (e) {
    console.error('Failed to store keys in localStorage:', e);
  }
}

export async function getStoredPrivateKey(username) {
  const jwk = localStorage.getItem(`dd_pkey_${username}`);
  if (!jwk) return null;
  
  return await window.crypto.subtle.importKey(
    'jwk',
    JSON.parse(jwk),
    KEY_ALGO,
    false,
    ['sign']
  );
}

export async function signData(username, data) {
  const privateKey = await getStoredPrivateKey(username);
  if (!privateKey) throw new Error('Private key not found for user: ' + username);

  const encoder = new TextEncoder();
  const encoded = encoder.encode(data);
  
  const signature = await window.crypto.subtle.sign(
    { name: 'RSA-PSS', saltLength: 32 },
    privateKey,
    encoded
  );

  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export async function verifySignature(publicKeyJwk, data, signatureB64) {
  const publicKey = await window.crypto.subtle.importKey(
    'jwk',
    publicKeyJwk,
    KEY_ALGO,
    false,
    ['verify']
  );

  const encoder = new TextEncoder();
  const encoded = encoder.encode(data);
  
  const signature = new Uint8Array(
    atob(signatureB64).split('').map(c => c.charCodeAt(0))
  );

  return await window.crypto.subtle.verify(
    { name: 'RSA-PSS', saltLength: 32 },
    publicKey,
    signature,
    encoded
  );
}

export async function sha256(message) {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
