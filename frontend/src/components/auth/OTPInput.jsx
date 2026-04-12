import { useState, useEffect, useRef } from 'react';

export default function OTPInput({ value, onChange, length = 6 }) {
  const [otp, setOtp] = useState(new Array(length).fill(''));
  const [focusedIndex, setFocusedIndex] = useState(0);
  const inputRefs = useRef([]);

  // Sync external value changes (e.g. auto-fill button) into internal state
  useEffect(() => {
    if (value && typeof value === 'string') {
      const digits = value.replace(/\D/g, '').slice(0, length).split('');
      const newOtp = new Array(length).fill('');
      digits.forEach((d, i) => { newOtp[i] = d; });
      setOtp(newOtp);
    }
  }, [value, length]);

  useEffect(() => {
    const otpString = otp.join('');
    onChange(otpString);
  }, [otp, onChange, length]);

  useEffect(() => {
    inputRefs.current[focusedIndex]?.focus();
  }, [focusedIndex]);

  const handleChange = (index, e) => {
    const val = e.target.value;
    
    if (val.length > 1) {
      const digits = val.replace(/\D/g, '').slice(0, length).split('');
      const newOtp = [...otp];
      digits.forEach((digit, i) => {
        if (index + i < length) {
          newOtp[index + i] = digit;
        }
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, length - 1);
      setFocusedIndex(nextIndex);
      return;
    }
    
    if (/^\d?$/.test(val)) {
      const newOtp = [...otp];
      newOtp[index] = val;
      setOtp(newOtp);
      
      if (val && index < length - 1) {
        setFocusedIndex(index + 1);
      }
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        setFocusedIndex(index - 1);
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
      } else {
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      }
    } else if (e.key === 'ArrowLeft') {
      setFocusedIndex(Math.max(0, index - 1));
    } else if (e.key === 'ArrowRight') {
      setFocusedIndex(Math.min(length - 1, index + 1));
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    
    if (pastedData) {
      const newOtp = pastedData.split('').padEnd(length, '').slice(0, length);
      setOtp(newOtp);
      setFocusedIndex(Math.min(pastedData.length, length - 1));
    }
  };

  const handleFocus = (index) => {
    setFocusedIndex(index);
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {otp.map((digit, index) => (
        <input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          type="text"
          inputMode="numeric"
          pattern="[0-9]"
          maxLength={index === focusedIndex ? 2 : 1}
          value={digit}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onFocus={() => handleFocus(index)}
          className={`w-12 h-14 text-center text-2xl font-bold bg-slate-700/50 border-2 rounded-xl text-white transition-all duration-200 ${
            focusedIndex === index
              ? 'border-blue-500 bg-slate-700 shadow-lg shadow-blue-500/25 ring-2 ring-blue-500/50'
              : digit
              ? 'border-slate-500/50'
              : 'border-slate-600/30 hover:border-slate-500/50'
          }`}
          style={{ caretColor: '#3B82F6' }}
          autoComplete="one-time-code"
        />
      ))}
    </div>
  );
}
