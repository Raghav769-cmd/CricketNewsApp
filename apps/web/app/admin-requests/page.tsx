'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface AdminRequest {
  id: number;
  email: string;
  name: string;
  status: string;
  created_at: string;
}

export default function AdminRequestsPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Redirect to matches if not superadmin
  useEffect(() => {
    if (!authLoading && isAuthenticated && user?.role !== 'superadmin') {
      router.push('/matches');
    }
  }, [authLoading, isAuthenticated, user?.role, router]);

  // Fetch pending requests
  useEffect(() => {
    if (isAuthenticated && user?.role === 'superadmin') {
      fetchPendingRequests();
    }
  }, [isAuthenticated, user?.role]);

  const fetchPendingRequests = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${apiBase}/api/auth/admin-requests/pending`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests);
      } else {
        setError('Failed to fetch requests');
      }
    } catch (err) {
      setError('Error fetching requests');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      setMessage('');
      setError('');
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${apiBase}/api/auth/admin-requests/${id}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setMessage('Request approved successfully!');
        // Remove from list
        setRequests(requests.filter((r) => r.id !== id));
        setTimeout(() => setMessage(''), 3000);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to approve request');
      }
    } catch (err) {
      setError('Error approving request');
      console.error(err);
    }
  };

  const handleReject = async (id: number, reason?: string) => {
    try {
      setMessage('');
      setError('');
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${apiBase}/api/auth/admin-requests/${id}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: reason || 'Rejected by admin' }),
      });

      if (response.ok) {
        setMessage('Request rejected successfully!');
        // Remove from list
        setRequests(requests.filter((r) => r.id !== id));
        setTimeout(() => setMessage(''), 3000);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to reject request');
      }
    } catch (err) {
      setError('Error rejecting request');
      console.error(err);
    }
  };

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated or not superadmin
  if (!isAuthenticated || user?.role !== 'superadmin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-lime-400 mb-2">Admin Requests</h1>
            <p className="text-gray-400 text-sm sm:text-base">Review and approve new admin registration requests</p>
          </div>

          {/* Back Button */}
          <button
            onClick={() => router.push('/matches')}
            className="mb-6 inline-flex items-center text-lime-400 hover:text-lime-300 font-semibold transition-colors text-sm sm:text-base"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Matches
          </button>

          {/* Messages */}
          {message && (
            <div className="mb-6 p-3 sm:p-4 bg-green-500/20 border border-green-500 rounded-lg">
              <p className="text-green-400 font-medium text-sm sm:text-base">{message}</p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-3 sm:p-4 bg-red-500/20 border border-red-500 rounded-lg">
              <p className="text-red-400 font-medium text-sm sm:text-base">{error}</p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-lime-500"></div>
            </div>
          )}

          {/* Requests List */}
          {!loading && requests.length === 0 && (
            <div className="bg-slate-900 rounded-lg sm:rounded-xl border border-slate-800 p-6 sm:p-8 text-center">
              <svg className="w-10 h-10 sm:w-12 sm:h-12 text-gray-500 mx-auto mb-3 sm:mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-400 text-base sm:text-lg">No pending admin requests</p>
            </div>
          )}

          {!loading && requests.length > 0 && (
            <div className="space-y-3 sm:space-y-4">
              {requests.map((request) => (
                <div key={request.id} className="bg-slate-900 rounded-lg sm:rounded-xl border border-slate-800 p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 gap-3 sm:gap-0">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg sm:text-xl font-semibold text-white mb-1 break-all">{request.email}</h3>
                      {request.name && (
                        <p className="text-gray-400 text-xs sm:text-sm">Name: {request.name}</p>
                      )}
                      <p className="text-gray-500 text-xs mt-2">
                        Requested: {new Date(request.created_at).toLocaleDateString()} at {new Date(request.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <span className="bg-yellow-500/20 border border-yellow-500 px-3 py-1 rounded text-yellow-400 text-xs sm:text-sm font-medium whitespace-nowrap">
                      Pending
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 border-t border-slate-700">
                    <button
                      onClick={() => handleApprove(request.id)}
                      className="flex-1 px-3 sm:px-4 py-2 bg-lime-500 hover:bg-lime-600 text-black font-semibold rounded-lg transition-colors text-sm sm:text-base"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(request.id)}
                      className="flex-1 px-3 sm:px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors text-sm sm:text-base"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
