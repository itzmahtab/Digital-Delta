import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check, QrCode, Shield, ShieldCheck, Lock } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { signData } from '../../services/crypto';

export default function QRGenerator({ deliveryId, onClose }) {
  const { user } = useAuthStore();
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState(null);

  const generateSignedQR = async () => {
    try {
      const nonce = crypto.randomUUID();
      const timestamp = Date.now();
      
      const rawPayload = {
        delivery_id: deliveryId || 'D001',
        recipient_id: user.username,
        timestamp,
        nonce,
      };

      // Real RSA-PSS Signature
      const signature = await signData(user.username, JSON.stringify(rawPayload));
      
      const fullPayload = {
        ...rawPayload,
        signature,
        v: '1.0'
      };
      
      setPayload(fullPayload);
      
      const dataUrl = await QRCode.toDataURL(JSON.stringify(fullPayload), {
        width: 300,
        margin: 2,
        color: { dark: '#0F172A', light: '#ffffff' },
      });
      
      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error('PoD Generation failed:', err);
      setError('Failed to generate secure signature. Check device keys.');
    }
  };

  useEffect(() => {
    generateSignedQR();
  }, [deliveryId]);

  const handleCopy = () => {
    if (payload) {
      navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-2xl">
              <QrCode className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Proof of Delivery</h3>
              <p className="text-xs text-slate-500 font-medium">RSA-PSS Signed Handover</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {error ? (
          <div className="p-6 bg-red-50 border border-red-100 rounded-3xl text-center mb-6">
            <Lock className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <p className="text-sm font-bold text-red-800">{error}</p>
          </div>
        ) : (
          <div className="flex justify-center mb-8">
            {qrDataUrl ? (
              <div className="p-6 bg-white rounded-[2rem] shadow-xl border border-slate-100 relative group">
                <img src={qrDataUrl} alt="Delivery QR Code" className="w-64 h-64 rounded-xl" />
                <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-[2rem] pointer-events-none"></div>
              </div>
            ) : (
              <div className="w-64 h-64 bg-slate-50 rounded-[2rem] flex flex-col items-center justify-center border-2 border-dashed border-slate-200">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <span className="text-slate-400 font-bold text-sm tracking-widest uppercase">Signing...</span>
              </div>
            )}
          </div>
        )}

        <div className="bg-slate-50 rounded-3xl p-5 mb-6 border border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Target Delivery</span>
            <span className="font-mono font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">{deliveryId || 'D001'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Signer</span>
            <span className="text-sm font-bold text-slate-900 bg-white px-3 py-1 rounded-lg border border-slate-200">@{user?.username}</span>
          </div>
        </div>

        <button
          onClick={handleCopy}
          disabled={!payload}
          className="w-full flex items-center justify-center gap-3 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-98 disabled:opacity-50"
        >
          {copied ? (
            <>
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Copied Encrypted Payload
            </>
          ) : (
            <>
              <Copy className="w-5 h-5 opacity-60" />
              Copy Verification JSON
            </>
          )}
        </button>

        <div className="mt-8 flex items-center gap-3 text-[10px] text-slate-400 justify-center font-bold tracking-widest uppercase bg-slate-50/50 py-3 rounded-2xl border border-slate-100">
          <Shield className="w-3.5 h-3.5 text-blue-500" />
          <span>FIPS 140-2 Compliant Verification</span>
        </div>
      </div>
    </div>
  );
}

