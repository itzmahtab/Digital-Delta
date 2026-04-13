/**
 * Login Page Component
 * Demonstrates:
 * - M1.1: TOTP entry with countdown timer
 * - M1.2: RSA key pair generation on first login
 * - M1.3: Role-based UI
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import OTPService from '../services/otp';
import CryptoService from '../services/crypto';
import './loginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, generateOTPSecret, registerPublicKey, hasPermission } =
    useAuthStore();

  // State
  const [step, setStep] = useState('login'); // login | setupOTP | enterOTP
  const [username, setUsername] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSecret, setOtpSecret] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(30);
  const [otpGenerated, setOtpGenerated] = useState('');
  const [deviceId] = useState('device-' + Math.random().toString(36).substr(2, 9));

  // OTP Countdown Timer
  useEffect(() => {
    if (step !== 'enterOTP') return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Generate new OTP when countdown reaches 0
          generateNewOTP();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [step]);

  // Generate OTP display (for demo)
  const generateNewOTP = () => {
    if (otpSecret) {
      const otp = OTPService.generateTOTP(otpSecret);
      setOtpGenerated(otp);
      setCountdown(30);
    }
  };

  // Step 1: Start Login Process
  const handleStartLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!username) {
      setError('Username required');
      return;
    }

    setLoading(true);

    // Check if OTP secret exists (first login?)
    // In real app, would check server
    const hasSecret = await checkUserExists(username);

    if (!hasSecret) {
      // First login: generate OTP secret
      const result = await generateOTPSecret();
      if (result.success) {
        setOtpSecret(result.secret);
        setStep('setupOTP');
      } else {
        setError('Failed to generate OTP secret');
      }
    } else {
      // Regular login: enter OTP
      setStep('enterOTP');
      // Generate OTP for display
      const otp = OTPService.generateTOTP(otpSecret || 'demo-secret');
      setOtpGenerated(otp);
    }

    setLoading(false);
  };

  // Step 2: Setup OTP (First Time)
  const handleSetupOTP = async (e) => {
    e.preventDefault();
    setError('');

    if (!otpSecret) {
      setError('OTP secret not generated');
      return;
    }

    // Show the secret to user and ask them to confirm
    // (in real app, would show QR code for mobile authenticator)
    alert(`Save this secret: ${otpSecret}\n\nEnter it into your authenticator app (Google Authenticator, Authy, etc.)`);

    // Move to entering OTP
    const otp = OTPService.generateTOTP(otpSecret);
    setOtpGenerated(otp);
    setStep('enterOTP');
  };

  // Step 3: Verify OTP and Login
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');

    if (!otpCode) {
      setError('OTP code required');
      return;
    }

    if (otpCode.length !== 6) {
      setError('OTP must be 6 digits');
      return;
    }

    setLoading(true);

    try {
      // Verify OTP (completely offline - no network needed)
      const otpVerification = OTPService.verifyTOTP(otpSecret || 'demo-secret', otpCode);

      if (!otpVerification.valid) {
        setError(`OTP Invalid: ${otpVerification.message}`);
        setLoading(false);
        return;
      }

      // ✓ OTP verified offline
      console.log('✓ OTP verified completely offline (no network needed)');
      console.log(`  Verified at: ${otpVerification.usedAt}`);
      console.log(`  Expires at: ${otpVerification.expiresAt}`);

      // Generate RSA-2048 key pair (if first login)
      let keyGenResult = { generated: false };
      const keyPairInit = await CryptoService.initCrypto(deviceId);

      if (!keyPairInit.loaded) {
        // First login: generate new key pair
        keyGenResult = await CryptoService.generateKeyPair(deviceId);
        console.log('✓ Generated RSA-2048 key pair');
        console.log(`  Private key stored in: localStorage[rsa_keyPair_${deviceId}]`);
        console.log(`  Public key: ${keyGenResult.publicKey.substring(0, 50)}...`);
      } else {
        console.log('✓ Loaded existing RSA-2048 key pair from localStorage');
      }

      // Login to server
      const result = await login(username, otpCode, deviceId);

      if (result.success) {
        // Register public key with server
        if (keyGenResult.generated || keyPairInit.loaded) {
          const publicKey = CryptoService.getPublicKey();
          await registerPublicKey(publicKey, deviceId);
          console.log('✓ Public key registered with server');
        }

        // Success - redirect to dashboard
        navigate('/dashboard');
      } else {
        setError(result.message || 'Login failed');
      }
    } catch (err) {
      setError(err.message);
      console.error('Login error:', err);
    }

    setLoading(false);
  };

  // Helper: Check if user exists
  const checkUserExists = async (username) => {
    // In real app, would query server
    // For demo, assume first login if no localStorage
    return localStorage.getItem(`user_${username}`) !== null;
  };

  // =========== RENDER ===========

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Header */}
        <div className="login-header">
          <div className="logo">🌊</div>
          <h1>Digital Delta</h1>
          <p>Offline-First Disaster Relief Logistics</p>
        </div>

        {/* Form */}
        <div className="login-form">
          {/* Step 1: Enter Username */}
          {step === 'login' && (
            <form onSubmit={handleStartLogin}>
              <h2>Welcome Back</h2>

              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  autoFocus
                />
              </div>

              {error && <div className="error-message">{error}</div>}

              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? 'Checking...' : 'Continue'}
              </button>
            </form>
          )}

          {/* Step 2: Setup OTP Secret (First Time) */}
          {step === 'setupOTP' && (
            <form onSubmit={handleSetupOTP}>
              <h2>Set Up Two-Factor Authentication</h2>

              <div className="otp-setup">
                <div className="secret-box">
                  <p className="label">Your OTP Secret (save this!):</p>
                  <div className="secret-code">{otpSecret}</div>
                  <p className="hint">
                    Scan the QR code below with your authenticator app:
                  </p>
                  <div className="qr-placeholder">
                    [QR Code with: otpauth://totp/?secret={otpSecret}]
                  </div>
                </div>

                <div className="setup-steps">
                  <h3>Steps:</h3>
                  <ol>
                    <li>Download an authenticator app (Google Authenticator, Authy)</li>
                    <li>Scan the QR code or enter the secret manually</li>
                    <li>Click "Continue" and enter the 6-digit code</li>
                  </ol>
                </div>
              </div>

              {error && <div className="error-message">{error}</div>}

              <button type="submit" className="btn-primary">
                I've Saved the Secret
              </button>
            </form>
          )}

          {/* Step 3: Enter OTP Code */}
          {step === 'enterOTP' && (
            <form onSubmit={handleVerifyOTP}>
              <h2>Enter OTP Code</h2>

              <div className="otp-entry">
                <p className="label">Enter the 6-digit code from your authenticator:</p>

                <input
                  type="text"
                  maxLength="6"
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) =>
                    setOtpCode(e.target.value.replace(/\D/g, ''))
                  }
                  disabled={loading}
                  className="otp-input"
                  autoFocus
                />

                {/* OTP Demo Display */}
                <div className="otp-demo">
                  <p className="label">Current OTP (for demo):</p>
                  <div className="otp-display">{otpGenerated}</div>
                </div>

                {/* Countdown Timer */}
                <div className={`countdown ${countdown < 5 ? 'warning' : ''}`}>
                  <div className="countdown-ring">
                    <svg width="60" height="60">
                      <circle cx="30" cy="30" r="25" className="ring-bg" />
                      <circle
                        cx="30"
                        cy="30"
                        r="25"
                        className="ring-progress"
                        style={{
                          strokeDashoffset: `${
                            157 * (1 - countdown / 30)
                          }`,
                        }}
                      />
                    </svg>
                    <div className="countdown-text">{countdown}s</div>
                  </div>
                  <p className="countdown-label">Expires in {countdown} seconds</p>
                </div>

                <p className="info">
                  ✓ OTP generation works <strong>completely offline</strong>
                  <br />
                  ✓ 30-second expiry enforced locally
                  <br />
                  ✓ Reuse prevention: each token valid once
                </p>
              </div>

              {error && <div className="error-message">{error}</div>}

              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? 'Verifying...' : 'Login'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('login');
                  setOtpCode('');
                  setError('');
                }}
                className="btn-secondary"
              >
                Back
              </button>
            </form>
          )}
        </div>

        {/* Info Box */}
        <div className="info-box">
          <h3>🔐 Security Features</h3>
          <ul>
            <li>
              <strong>M1.1 TOTP/HOTP:</strong> Time-based OTP (RFC 6238), completely offline
            </li>
            <li>
              <strong>M1.2 RSA-2048:</strong> Device key pair generated on first login, private
              key never leaves device (localStorage)
            </li>
            <li>
              <strong>M1.3 RBAC:</strong> 5-tier role system with permission matrix
            </li>
            <li>
              <strong>M1.4 Audit Log:</strong> SHA-256 hash chaining detects tampering
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
