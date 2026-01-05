'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@repo/ui/toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { FormField } from '@/app/components/FormComponents';
import { useState } from 'react';

const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be at most 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string()
    .min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
  role: z.enum(['user', 'admin']),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function Register() {
  const router = useRouter();
  const { register: registerUser, isAuthenticated } = useAuth();
  const [serverError, setServerError] = useState<string>('');
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      username: '',
      password: '',
      confirmPassword: '',
      role: 'user',
    },
  });

  const role = watch('role');

  if (isAuthenticated) {
    router.push('/matches');
    return null;
  }

  const onSubmit = async (data: RegisterFormData) => {
    setServerError('');
    try {
      await registerUser(data.email, data.password, data.username, data.role);
      toast.success('Registration successful! Redirecting...');
      router.push('/matches');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Registration failed';
      if ((err as any)?.isPendingApproval) {
        toast.info(errorMsg);
        toast.info('An existing admin will review and approve your request.', { duration: 5000 });
      } else {
        setServerError(errorMsg);
        toast.error(errorMsg);
      }
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
            <p className="text-gray-400 text-xs sm:text-sm">Join the cricket community</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4">
            {/* Server Error Alert */}
            {serverError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start space-x-3 animate-in fade-in slide-in-from-top-1">
                <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm font-medium text-red-300">{serverError}</p>
              </div>
            )}

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

            {/* Username */}
            <FormField 
              label="Username" 
              required 
              error={errors.username?.message}
              helperText="3-50 characters, letters, numbers, and underscores only"
            >
              <input
                type="text"
                {...register('username')}
                placeholder="your_username"
                className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg bg-slate-800/50 text-white placeholder-gray-500 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent transition-all duration-200 ${
                  errors.username ? 'border-red-500' : 'border-slate-700'
                }`}
              />
            </FormField>

            {/* Role */}
            <FormField label="User Role" required error={errors.role?.message}>
              <select
                {...register('role')}
                className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg bg-slate-800/50 text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent transition-all duration-200 ${
                  errors.role ? 'border-red-500' : 'border-slate-700'
                }`}
              >
                <option value="user">Normal User</option>
                <option value="admin">Admin</option>
              </select>
              <p className="mt-1 text-xs text-gray-400">
                {role === 'admin'
                  ? 'Admin: Request approval from existing admins to manage matches'
                  : 'User: Can view matches and data'}
              </p>
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

            {/* Confirm Password */}
            <FormField label="Confirm Password" required error={errors.confirmPassword?.message}>
              <input
                type="password"
                {...register('confirmPassword')}
                placeholder="••••••••"
                className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg bg-slate-800/50 text-white placeholder-gray-500 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent transition-all duration-200 ${
                  errors.confirmPassword ? 'border-red-500' : 'border-slate-700'
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
                  <span>Creating account...</span>
                </>
              ) : (
                <span>Create Account</span>
              )}
            </button>
          </form>

          {/* Sign In Link */}
          <div className="mt-6 text-center">
            <p className="text-gray-400 text-xs sm:text-sm">
              Already have an account?{' '}
              <Link
                href="/login"
                className="text-lime-400 hover:text-lime-300 font-semibold transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
