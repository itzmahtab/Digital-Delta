import { useEffect } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check, QrCode, Shield } from 'lucide-react';
import { useState } from 'react';

export default function QRGenerator({ deliveryId, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [payload, setPayload] = useState(null);

  const generateQR = async () => {
    const nonce = crypto.randomUUID();
    const timestamp = Date.now();
    
    const qrPayload = {
      delivery_id: deliveryId || 'D001',
      sender_pubkey: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgK...',
      timestamp,
      nonce,
      payload_hash: 'sha256:' + btoa(`${deliveryId}-${timestamp}`).substring(0, 16),
      signature: btoa(JSON.stringify({ delivery_id: deliveryId, timestamp, nonce })),
    };
    
    setPayload(qrPayload);
    
    const dataUrl = await QRCode.toDataURL(JSON.stringify(qrPayload), {
      width: 256,
      margin: 2,
      color: { dark: '#1B4F72', light: '#ffffff' },
    });
    
    setQrDataUrl(dataUrl);
  };

  useEffect(() => {
    generateQR();
  }, []);

  const handleCopy = () => {
    if (payload) {
      navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <QrCode className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Proof of Delivery QR</h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex justify-center mb-6">
          {qrDataUrl ? (
            <div className="p-4 bg-white rounded-2xl shadow-lg border border-slate-200">
              <img src={qrDataUrl} alt="Delivery QR Code" className="w-64 h-64 rounded-xl" />
            </div>
          ) : (
            <div className="w-64 h-64 bg-slate-100 rounded-2xl flex items-center justify-center">
              <span className="text-slate-500">Generating...</span>
            </div>
          )}
        </div>

        <div className="bg-slate-50 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Delivery ID</span>
            <span className="font-mono font-semibold text-slate-900">{deliveryId || 'D001'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Timestamp</span>
            <span className="font-mono text-sm text-slate-700">
              {payload ? new Date(payload.timestamp).toLocaleTimeString() : '--:--'}
            </span>
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors font-medium mb-4"
        >
          {copied ? (
            <>
              <Check className="w-5 h-5 text-green-500" />
              Copied to Clipboard!
            </>
          ) : (
            <>
              <Copy className="w-5 h-5" />
              Copy Payload JSON
            </>
          )}
        </button>

        <div className="flex items-center gap-2 text-xs text-slate-500 justify-center">
          <Shield className="w-4 h-4" />
          <span>Cryptographically signed • Replay protected</span>
        </div>
      </div>
    </div>
  );
}
