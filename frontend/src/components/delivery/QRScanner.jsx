import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, CheckCircle, Camera, Shield, AlertTriangle } from 'lucide-react';

export default function QRScanner({ onClose }) {
  const [scannedData, setScannedData] = useState(null);
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(true);
  const [useDemo, setUseDemo] = useState(false);
  const scannerRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const startScanner = async () => {
      try {
        if (!mounted) return;
        
        scannerRef.current = new Html5Qrcode('qr-reader');
        await scannerRef.current.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 250 },
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

  const handleScan = (data) => {
    try {
      const parsed = JSON.parse(data);
      setScannedData({ ...parsed, verified: false });
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    } catch {
      setError('Invalid QR code format');
    }
  };

  const useDemoData = () => {
    setScannedData({
      delivery_id: 'D001',
      sender_pubkey: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgK...',
      timestamp: Date.now(),
      nonce: crypto.randomUUID(),
      verified: false,
    });
    setUseDemo(true);
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
    }
  };

  const verifyScan = () => {
    if (scannedData) {
      setScannedData({ ...scannedData, verified: true });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-xl">
              <Camera className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Scan Proof of Delivery</h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
            <p className="text-sm text-yellow-800">{error}</p>
          </div>
        )}

        {!scannedData ? (
          <>
            <div className="bg-slate-100 rounded-2xl overflow-hidden mb-4">
              <div id="qr-reader" className="w-full" style={{ minHeight: '250px' }}></div>
            </div>
            <p className="text-sm text-slate-500 text-center mb-4">
              Position the QR code within the frame
            </p>
            <button
              onClick={useDemoData}
              className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors font-medium"
            >
              Use Demo Data
            </button>
          </>
        ) : (
          <div className="text-center">
            {scannedData.verified ? (
              <div className="py-8">
                <div className="p-4 bg-green-100 rounded-full inline-flex mb-4">
                  <CheckCircle className="w-16 h-16 text-green-500" />
                </div>
                <h4 className="text-xl font-semibold text-green-700 mb-2">Delivery Verified!</h4>
                <p className="text-slate-600">
                  Delivery ID: <span className="font-mono font-semibold">{scannedData.delivery_id}</span>
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-green-600 mt-3">
                  <Shield className="w-4 h-4" />
                  <span>Cryptographic verification successful</span>
                </div>
              </div>
            ) : (
              <>
                <div className="p-4 bg-blue-50 rounded-2xl mb-4">
                  <div className="p-3 bg-blue-100 rounded-full inline-flex mb-4">
                    <CheckCircle className="w-12 h-12 text-blue-500" />
                  </div>
                  <h4 className="text-lg font-semibold text-slate-900 mb-4">QR Code Scanned</h4>
                  <div className="text-left bg-white rounded-xl p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-sm">Delivery ID</span>
                      <span className="font-mono font-semibold">{scannedData.delivery_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-sm">Timestamp</span>
                      <span className="font-mono text-sm">
                        {new Date(scannedData.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={verifyScan}
                  className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:opacity-90 shadow-lg shadow-green-500/25 transition-all"
                >
                  Confirm Delivery
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
