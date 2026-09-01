'use client';

import React, { useState } from 'react';
import { api } from '@/lib/axios';
import { useAuth } from '@/context/AuthContext';
import { Lock, Phone, Loader2, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Forgot password dialog state
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetPhone, setResetPhone] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [resetError, setResetError] = useState('');
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);

  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/login', { phone: phone.trim(), password });
      login(data);
    } catch (err: any) {
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setError('Connection timed out. Unable to reach backend server.');
      } else if (err.code === 'ERR_NETWORK') {
        setError('Network error: Unable to connect to the backend server. Please verify backend server is running.');
      } else {
        setError(err.response?.data?.error || err.message || 'Failed to login. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetSubmitting(true);
    setResetMsg('');
    setResetError('');

    try {
      const { data } = await api.post('/auth/forgot-password', { phone: resetPhone });
      setResetMsg(data.message || 'Request submitted successfully.');
    } catch (err: any) {
      setResetError(err.response?.data?.error || 'Failed to submit password reset request.');
    } finally {
      setIsResetSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF7EE] p-4 font-sans">
      <Card className="w-full max-w-md shadow-[0_10px_30px_rgba(74,46,27,0.08)] border border-[#EDE4D5] bg-[#FFFDF8] rounded-3xl overflow-hidden">
        <CardHeader className="space-y-4 text-center pt-8 pb-4">
          <div className="mx-auto w-16 h-16 bg-[#E87A18] rounded-2xl flex items-center justify-center shadow-lg shadow-[#E87A18]/25">
            <Store className="w-8 h-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-extrabold tracking-tight text-[#2C1B10]">Bakery ERP</CardTitle>
            <CardDescription className="pt-2 text-xs font-medium text-[#8C7361]">
              Sign in to the management portal
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="px-6 sm:px-8 pb-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-center text-center">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-[#4A2E1B]">Phone Number</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8C7361]">
                    <Phone className="h-4 w-4" />
                  </div>
                  <Input
                    id="phone"
                    type="text"
                    placeholder="0912..."
                    className="pl-10 h-12 rounded-2xl focus-visible:ring-[#E87A18] focus-visible:border-transparent bg-[#F4ECE1]/50 text-[#2C1B10] placeholder:text-[#A48F7F] border-[#EDE4D5] focus:bg-white transition-all font-medium"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-[#4A2E1B]">Password</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetPhone(phone);
                      setResetMsg('');
                      setResetError('');
                      setIsResetOpen(true);
                    }}
                    className="text-xs text-[#E87A18] hover:text-[#d46d13] font-bold underline underline-offset-2 transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8C7361]">
                    <Lock className="h-4 w-4" />
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10 h-12 rounded-2xl focus-visible:ring-[#E87A18] focus-visible:border-transparent bg-[#F4ECE1]/50 text-[#2C1B10] placeholder:text-[#A48F7F] border-[#EDE4D5] focus:bg-white transition-all font-medium"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-2xl text-base font-extrabold bg-[#E87A18] hover:bg-[#d46d13] text-white shadow-lg shadow-[#E87A18]/25 transition-all mt-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Authenticating...
                </>
              ) : (
                'Sign In to Dashboard'
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center text-xs font-medium text-[#8C7361] border-t border-[#EDE4D5] bg-[#F4ECE1]/30 py-4">
          Secure connection to Bakery ERP Management
        </CardFooter>
      </Card>

      {/* Forgot Password Request Modal */}
      {isResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in-0">
          <div className="bg-[#FFFDF8] rounded-3xl p-6 w-full max-w-md shadow-2xl border border-[#EDE4D5] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#EDE4D5]">
              <h3 className="text-base font-extrabold text-[#2C1B10]">Request Password Reset</h3>
              <button
                onClick={() => setIsResetOpen(false)}
                className="text-[#8C7361] hover:text-[#4A2E1B] text-lg font-bold p-1 transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#8C7361] font-medium leading-relaxed">
              Enter your registered phone number. Your Bakery Owner or Branch Manager will receive the request and generate a new temporary password for you.
            </p>

            {resetMsg ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 text-center space-y-3">
                <p>{resetMsg}</p>
                <Button
                  onClick={() => setIsResetOpen(false)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-10 rounded-xl"
                >
                  Return to Login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleResetSubmit} className="space-y-4">
                {resetError && (
                  <div className="p-3 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl text-center">
                    {resetError}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="reset-phone" className="text-xs font-bold uppercase tracking-wider text-[#4A2E1B]">Phone Number</Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8C7361]">
                      <Phone className="h-4 w-4" />
                    </div>
                    <Input
                      id="reset-phone"
                      type="text"
                      placeholder="0912..."
                      className="pl-10 h-11 rounded-xl bg-[#F4ECE1]/50 text-[#2C1B10] border-[#EDE4D5] focus:bg-white focus-visible:ring-[#E87A18]"
                      value={resetPhone}
                      onChange={(e) => setResetPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsResetOpen(false)}
                    className="flex-1 h-11 rounded-xl text-xs font-bold bg-[#F4ECE1] hover:bg-[#E0D5C3] text-[#4A2E1B] border-[#EDE4D5]"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isResetSubmitting}
                    className="flex-1 h-11 rounded-xl text-xs font-extrabold bg-[#E87A18] hover:bg-[#d46d13] text-white shadow-md shadow-[#E87A18]/20"
                  >
                    {isResetSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Reset Request'
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
