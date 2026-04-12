import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Shield, Loader2, User, Lock, Droplets, ChevronRight, Check, Zap, Eye, EyeOff, RefreshCw } from 'lucide-react';
import OTPInput from '../components/auth/OTPInput'; 
import { otpService } from '../services/otp';

const ROLES = [
  { id: 'admin', name: 'Admin', color: 'from-purple-500 to-purple-600', description: 'Full system access' },
  { id: 'commander', name: 'Commander', color: 'from-blue-500 to-blue-600', description: 'Field coordination' },
  { id: 'manager', name: 'Manager', color: 'from-green-500 to-green-600', description: 'Supply management' },
  { id: 'drone_operator', name: 'Drone Operator', color: 'from-cyan-500 to-cyan-600', description: 'Fleet operations' },
  { id: 'volunteer', name: 'Volunteer', color: 'from-amber-500 to-amber-600', description: 'Field volunteer' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();
  
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [selectedRole, setSelectedRole] = useState(null);
  const [animateIn, setAnimateIn] = useState(false);
  
  const [otp, setOtp] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [generatedCode, setGeneratedCode] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setAnimateIn(true);
    otpService.loadStoredSecrets();
  }, []);

  useEffect(() => {
    let interval;
    if (step === 3 && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            return 30;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, timeRemaining]);

  const handleUsernameSubmit = () => {
    if (username.trim()) {
      setStep(2);
    }
  };

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setStep(3);
  };

  const generateAndShowCode = useCallback(async () => {
    if (!username.trim()) return;
    
    setIsGenerating(true);
    
    try {
      const result = await otpService.generateTOTP(username);
      setGeneratedCode(result.otp);
      setTimeRemaining(result.remainingSeconds);
      setShowCode(true);
      
      setTimeout(() => {
        setShowCode(false);
      }, 10000);
    } catch (err) {
      console.error('Failed to generate OTP:', err);
    }
    
    setIsGenerating(false);
  }, [username]);

  useEffect(() => {
    if (step === 3) {
      generateAndShowCode();
    }
  }, [step, generateAndShowCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    
    if (otp.length !== 6) {
      return;
    }
    
    const result = await login(username, otp);
    if (result.success) {
      navigate('/dashboard');
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 1: return 'Welcome Back';
      case 2: return 'Select Role';
      case 3: return 'Verify OTP';
      default: return 'Sign In';
    }
  };

  const getTimeColor = () => {
    if (timeRemaining <= 5) return 'text-red-400';
    if (timeRemaining <= 10) return 'text-amber-400';
    return 'text-green-400';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[100px]"></div>
        <div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[80px]"></div>
      </div>

      <div className={`relative w-full max-w-md transition-all duration-700 ${animateIn ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl mb-6 shadow-2xl shadow-blue-500/30 transform rotate-3 hover:rotate-0 transition-transform duration-300">
            <Droplets className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
            Digital Delta
          </h1>
          <p className="text-slate-400 text-lg">
            Offline-First Disaster Relief
          </p>
        </div>

        <div className="bg-slate-800/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-slate-700/50">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-500/20 rounded-xl">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">
              {getStepTitle()}
            </h2>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUsernameSubmit()}
                    className="w-full pl-12 pr-4 py-4 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-slate-700/70 transition-all"
                    placeholder="Enter your username"
                    autoFocus
                  />
                </div>
              </div>
              <button
                onClick={handleUsernameSubmit}
                disabled={!username.trim()}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
              >
                Continue
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3 animate-fade-in">
              <p className="text-sm text-slate-400 mb-4">Select your role:</p>
              {ROLES.map((role) => (
                <button
                  key={role.id}
                  onClick={() => handleRoleSelect(role.id)}
                  className="w-full p-4 bg-slate-700/50 border border-slate-600/50 rounded-xl hover:border-blue-500/50 hover:bg-slate-700/70 transition-all group flex items-center gap-4"
                >
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${role.color} flex items-center justify-center text-white font-bold`}>
                    {role.name[0]}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-white group-hover:text-blue-300 transition-colors">
                      {role.name}
                    </p>
                    <p className="text-xs text-slate-500">{role.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-blue-400 transition-colors" />
                </button>
              ))}
            </div>
          )}

          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  One-Time Password
                </label>
                
                {generatedCode && showCode && (
                  <div className="mb-4 p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-green-400">Generated Code (Demo Mode)</span>
                      <button
                        type="button"
                        onClick={() => setShowCode(false)}
                        className="text-green-400 hover:text-green-300"
                      >
                        <EyeOff className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-mono font-bold text-green-400 tracking-widest">
                        {generatedCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedCode);
                          setOtp(generatedCode);
                        }}
                        className="p-2 bg-green-500/20 rounded-lg hover:bg-green-500/30 transition-colors"
                      >
                        <Check className="w-4 h-4 text-green-400" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Click the checkmark or copy to auto-fill
                    </p>
                  </div>
                )}

                <div className="bg-slate-700/30 rounded-xl p-4">
                  <OTPInput value={otp} onChange={setOtp} />
                </div>
                
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-slate-500" />
                    <span className="text-xs text-slate-500">Expires in:</span>
                    <span className={`text-xs font-mono font-bold ${getTimeColor()}`}>
                      {timeRemaining}s
                    </span>
                    <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${
                          timeRemaining <= 5 ? 'bg-red-500' : 
                          timeRemaining <= 10 ? 'bg-amber-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${(timeRemaining / 30) * 100}%` }}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={generateAndShowCode}
                    disabled={isGenerating}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3 h-3" />
                        New Code
                      </>
                    )}
                  </button>
                </div>
                
                <div className="mt-3 flex items-start gap-2 text-xs text-slate-500">
                  <Lock className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>Demo mode: Click the checkmark above to auto-fill, or enter any 6 digits</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 py-4 bg-slate-700/50 text-white rounded-xl font-medium hover:bg-slate-600/50 transition-all border border-slate-600/50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading || otp.length !== 6}
                  className="flex-1 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In
                      <Check className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-slate-700/50">
            <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                <span>Offline Ready</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>TOTP Enabled</span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center mt-8">
          <p className="text-slate-500 text-sm">
            HackFusion 2026 • IEEE CS LU SB Chapter
          </p>
        </div>
      </div>
    </div>
  );
}
