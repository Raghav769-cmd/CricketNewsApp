'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@repo/ui/toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { FormField } from '@/app/components/FormComponents';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  if (isAuthenticated) {
    router.push('/matches');
    return null;
  }

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data.email, data.password);
      toast.success('Login successful! Redirecting...');
      router.push('/matches');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Login failed';
      toast.error(errorMsg);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-black via-slate-900 to-black flex items-center justify-center p-3 sm:p-4 md:p-6">
      <div className="w-full max-w-md">
        <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700/50 p-6 sm:p-8">
          {/* Logo and Header */}
          <div className="mb-6 sm:mb-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-linear-to-br from-lime-400 to-lime-500 rounded-lg sm:rounded-xl mb-3 sm:mb-4 shadow-lg shadow-lime-500/30">
              <svg className="w-7 h-7 sm:w-8 sm:h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">CricketLive</h1>
            <p className="text-gray-400 text-xs sm:text-sm">Real-time Cricket Updates & Scoring</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5">
            {/* Email */}
            <FormField label="Email Address" required error={errors.email?.message}>
              <input
                type="text"
                {...register('email')}
                placeholder="you@example.com"
                className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg bg-slate-800/50 text-white placeholder-gray-500 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent transition-all duration-200 ${
                  errors.email ? 'border-red-500' : 'border-slate-700'
                }`}
              />
            </FormField>

            {/* Password */}
            <FormField label="Password" required error={errors.password?.message}>
              <input
                type="password"
                {...register('password')}
                placeholder="••••••••"
                className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg bg-slate-800/50 text-white placeholder-gray-500 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent transition-all duration-200 ${
                  errors.password ? 'border-red-500' : 'border-slate-700'
                }`}
              />
            </FormField>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-4 py-3 mt-4 sm:mt-6 bg-linear-to-r from-lime-500 to-lime-600 hover:from-lime-600 hover:to-lime-700 disabled:from-lime-500/50 disabled:to-lime-600/50 text-black font-bold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:shadow-none flex items-center justify-center space-x-2 text-sm sm:text-base"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <p className="text-gray-400 text-xs sm:text-sm">
              Don't have an account?{' '}
              <Link
                href="/register"
                className="text-lime-400 hover:text-lime-300 font-semibold transition-colors"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
