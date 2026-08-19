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
      const { data } = await api.post('/auth/login', { phone, password });
      login(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to login. Please try again.');
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
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-t-4 border-t-black bg-white">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-black rounded-xl flex items-center justify-center">
            <Store className="w-8 h-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight text-zinc-900">Bakery ERP</CardTitle>
            <CardDescription className="pt-2 text-sm text-zinc-500">
              Sign in to the management portal
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg flex items-center justify-center text-center">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-zinc-700">Phone Number</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                    <Phone className="h-4 w-4" />
                  </div>
                  <Input 
                    id="phone" 
                    type="text" 
                    placeholder="0912..." 
                    className="pl-10 h-12 rounded-xl focus-visible:ring-black bg-zinc-50 text-zinc-900 border-zinc-200"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-zinc-700">Password</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetPhone(phone);
                      setResetMsg('');
                      setResetError('');
                      setIsResetOpen(true);
                    }}
                    className="text-xs text-amber-600 hover:text-amber-700 font-semibold underline underline-offset-2"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••••" 
                    className="pl-10 h-12 rounded-xl focus-visible:ring-black bg-zinc-50 text-zinc-900 border-zinc-200"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl text-base font-semibold bg-black hover:bg-zinc-800 text-white transition-colors" 
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
        <CardFooter className="flex justify-center text-xs text-zinc-400">
          Secure connection to Bakery ERP Management
        </CardFooter>
      </Card>

      {/* Forgot Password Request Modal */}
      {isResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in-0">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <h3 className="text-lg font-bold text-zinc-900">Request Password Reset</h3>
              <button
                onClick={() => setIsResetOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-500">
              Enter your registered phone number. Your Bakery Owner or Branch Manager will receive the request and generate a new temporary password for you.
            </p>

            {resetMsg ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-xs font-medium text-green-700 text-center space-y-3">
                <p>{resetMsg}</p>
                <Button
                  onClick={() => setIsResetOpen(false)}
                  className="w-full bg-green-700 hover:bg-green-800 text-white text-xs font-semibold h-9 rounded-lg"
                >
                  Return to Login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleResetSubmit} className="space-y-4">
                {resetError && (
                  <div className="p-3 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg text-center">
                    {resetError}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="reset-phone" className="text-xs font-semibold text-zinc-700">Phone Number</Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                      <Phone className="h-4 w-4" />
                    </div>
                    <Input
                      id="reset-phone"
                      type="text"
                      placeholder="0912..."
                      className="pl-10 h-10 rounded-xl bg-zinc-50 text-zinc-900 border-zinc-200"
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
                    className="flex-1 h-10 rounded-xl text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isResetSubmitting}
                    className="flex-1 h-10 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white"
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
