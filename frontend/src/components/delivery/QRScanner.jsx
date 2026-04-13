import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, CheckCircle, Camera, Shield, AlertTriangle, Loader2, ShieldCheck, ShieldAlert, History } from 'lucide-react';
import { verifySignature } from '../../services/crypto';
import { useUserStore } from '../../store/userStore';
import { useSyncStore } from '../../store/syncStore';
import { useAuthStore } from '../../store/authStore';

export default function QRScanner({ onClose }) {
  const { user: currentUser } = useAuthStore();
  const { getPublicKey, fetchRegistry } = useUserStore();
  const { addMutation } = useSyncStore();

  const [scannedData, setScannedData] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState('idle'); // idle, verifying, success, error
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(true);
  const [useDemo, setUseDemo] = useState(false);
  const scannerRef = useRef(null);

  useEffect(() => {
    fetchRegistry();
    let mounted = true;

    const startScanner = async () => {
      try {
        if (!mounted) return;
        
        scannerRef.current = new Html5Qrcode('qr-reader');
        await scannerRef.current.start(
          { facingMode: 'environment' },
          { fps: 15, qrbox: 250 },
          (decodedText) => {
            handleScan(decodedText);
          },
          () => {}
        );
        if (mounted) setIsScanning(true);
      } catch (err) {
        if (mounted) {
          setError('Camera not available. Use demo mode below.');
          setUseDemo(true);
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleScan = async (data) => {
    try {
      const parsed = JSON.parse(data);
      setScannedData(parsed);
      setVerificationStatus('idle');
      if (scannerRef.current) {
        await scannerRef.current.stop();
      }
    } catch {
      setError('Invalid QR code format');
    }
  };

  const handleVerify = async () => {
    if (!scannedData) return;
    
    setVerificationStatus('verifying');
    setError(null);

    try {
      // 1. Check Expiration (30 minute window)
      const now = Date.now();
      const diff = now - scannedData.timestamp;
      if (diff > 1800000 || diff < -60000) {
        throw new Error('Proof-of-Delivery token has expired or system clock mismatch.');
      }

      // 2. Get Signer Public Key
      const pubKeyJwk = getPublicKey(scannedData.recipient_id);
      if (!pubKeyJwk) {
        throw new Error(`Public key not found for signer: @${scannedData.recipient_id}`);
      }

      // 3. Verify RSA-PSS Signature
      const { signature, v, ...rawPayload } = scannedData;
      const isValid = await verifySignature(pubKeyJwk, JSON.stringify(rawPayload), signature);

      if (!isValid) {
        throw new Error('Cryptographic signature mismatch. The PoD may have been tampered with.');
      }

      // 4. Success - Add Mutation to Ledger
      addMutation({
        type: 'DELIVERY_HANDOVER',
        nodeId: currentUser.username,
        data: {
          delivery_id: scannedData.delivery_id,
          recipient: scannedData.recipient_id,
          carrier: currentUser.username,
          status: 'delivered',
          proof: signature
        }
      });

      setVerificationStatus('success');
    } catch (err) {
      console.error('Verification failed:', err);
      setError(err.message);
      setVerificationStatus('error');
    }
  };

  const useDemoData = () => {
    handleScan(JSON.stringify({
      delivery_id: 'D001',
      recipient_id: 'manager', // Hardcoded for demo if needed
      timestamp: Date.now(),
      nonce: crypto.randomUUID(),
      signature: 'MOCK_SIGNATURE_WILL_FAIL_REAL_VERIFY',
    }));
    setUseDemo(true);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-300 overflow-hidden">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 rounded-2xl">
              <Camera className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Scan Delivery PoD</h3>
              <p className="text-xs text-slate-500 font-medium">Capture signed recipient token</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {error && verificationStatus === 'idle' && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-amber-800">{error}</p>
          </div>
        )}

        {!scannedData ? (
          <>
            <div className="bg-slate-900 rounded-3xl overflow-hidden mb-6 relative group aspect-square">
              <div id="qr-reader" className="w-full h-full"></div>
              <div className="absolute inset-0 border-[32px] border-black/20 pointer-events-none"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-emerald-500/50 rounded-3xl group-hover:scale-105 transition-transform duration-500 border-dashed"></div>
            </div>
            <p className="text-sm font-medium text-slate-500 text-center mb-6">
              Align the recipient's QR code within the frame
            </p>
            <button
              onClick={useDemoData}
              className="w-full py-4 bg-slate-50 text-slate-600 rounded-2xl hover:bg-slate-100 transition-colors font-bold text-xs uppercase tracking-widest border border-slate-200"
            >
              Simulate Scan (Demo)
            </button>
          </>
        ) : (
          <div className="animate-in slide-in-from-bottom-4 duration-500">
            {verificationStatus === 'success' ? (
              <div className="text-center py-4">
                <div className="relative inline-block mb-6">
                  <div className="absolute inset-0 bg-emerald-500 blur-2xl opacity-20 animate-pulse"></div>
                  <div className="p-6 bg-emerald-100 rounded-full relative">
                    <CheckCircle className="w-16 h-16 text-emerald-600" />
                  </div>
                </div>
                <h4 className="text-2xl font-black text-slate-900 mb-2">Verified Successfully</h4>
                <div className="bg-emerald-50 text-emerald-700 font-bold px-4 py-2 rounded-xl text-sm inline-flex items-center gap-2 mb-6 border border-emerald-100">
                  <ShieldCheck className="w-4 h-4" /> Valid RSA Signature
                </div>
                
                <div className="bg-slate-50 rounded-3xl p-5 mb-8 text-left border border-slate-100">
                  <div className="flex justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cargo ID</span>
                    <span className="font-mono font-bold text-slate-900">{scannedData.delivery_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Signer</span>
                    <span className="text-xs font-bold text-slate-900">@{scannedData.recipient_id}</span>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all active:scale-95"
                >
                  Return to Dashboard
                </button>
              </div>
            ) : (
              <>
                <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 mb-6">
                   <div className="flex items-center gap-4 mb-6">
                     <div className="p-3 bg-blue-100 rounded-2xl">
                       <Shield className="w-6 h-6 text-blue-600" />
                     </div>
                     <div>
                       <h4 className="font-bold text-slate-900">Token Detected</h4>
                       <p className="text-xs text-slate-500 font-medium">Awaiting cryptographic check</p>
                     </div>
                   </div>

                   <div className="space-y-3 mb-6">
                      <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Package</span>
                        <span className="font-mono font-bold text-slate-900">{scannedData.delivery_id}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Issued</span>
                        <span className="text-xs font-bold text-slate-700">{new Date(scannedData.timestamp).toLocaleTimeString()}</span>
                      </div>
                   </div>

                   {verificationStatus === 'error' && (
                     <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 mb-4 animate-in shake duration-500">
                        <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                        <p className="text-[11px] font-bold text-red-800 leading-relaxed">{error}</p>
                     </div>
                   )}
                </div>

                <button
                  onClick={handleVerify}
                  disabled={verificationStatus === 'verifying'}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                >
                  {verificationStatus === 'verifying' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Verifying Signature...
                    </>
                  ) : (
                    <>
                      Verify and Confirm Handover
                      <History className="w-4 h-4 opacity-50 group-hover:rotate-12 transition-transform" />
                    </>
                  )}
                </button>
                <button
                  onClick={() => setScannedData(null)}
                  disabled={verificationStatus === 'verifying'}
                  className="w-full mt-3 py-3 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600 transition-colors"
                >
                  Cancel Scan
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

