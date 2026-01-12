'use client';

import { useState, useEffect, useCallback } from 'react';
import { AuthGuard } from '@/components/auth';
import HistoryTable from '@/components/qc/HistoryTable';
import { jobService } from '@/lib/services';
import { useProfile } from '@/lib/auth/hooks';
import type { Database } from '@/lib/types/database';

type Job = Database['public']['Tables']['jobs']['Row'];
type User = Database['public']['Tables']['profiles']['Row'];

interface FilterOptions {
  dateFrom?: string;
  dateTo?: string;
  status?: Job['status'] | 'all';
  result?: Job['result'] | 'all';
}

export default function HistoryPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useProfile();

  // Load jobs on mount
  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const jobsData = await jobService.getUserJobs();
      setJobs(jobsData);
      setFilteredJobs(jobsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载历史记录失败');
    } finally {
      setLoading(false);
    }
  };

  // Handle filter changes
  const handleFilter = useCallback((filters: FilterOptions) => {
    let filtered = [...jobs];

    // Date range filter
    if (filters.dateFrom) {
      filtered = filtered.filter(job => job.created_at >= filters.dateFrom!);
    }
    if (filters.dateTo) {
      const endDate = new Date(filters.dateTo);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(job => job.created_at <= endDate.toISOString());
    }

    // Status filter
    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(job => job.status === filters.status);
    }

    // Result filter
    if (filters.result && filters.result !== 'all') {
      filtered = filtered.filter(job => job.result === filters.result);
    }

    setFilteredJobs(filtered);
  }, [jobs]);

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-6xl mx-auto py-8 px-4">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-48 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                  <div className="h-4 bg-gray-200 rounded w-4/6"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (error) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-6xl mx-auto py-8 px-4">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">加载失败</h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <button
                  onClick={loadJobs}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  重试
                </button>
              </div>
            </div>
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (!profile) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-6xl mx-auto py-8 px-4">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="text-center text-gray-500">
                加载用户信息中...
              </div>
            </div>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto py-4 sm:py-8 px-4">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="mb-4 sm:mb-0">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                  质检历史记录
                </h1>
                <p className="text-sm sm:text-base text-gray-600">
                  查看和分析质检历史数据
                </p>
              </div>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                <button
                  onClick={loadJobs}
                  className="bg-gray-600 text-white px-4 py-3 sm:py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center touch-manipulation"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  刷新
                </button>
                <a
                  href="/"
                  className="bg-blue-600 text-white px-4 py-3 sm:py-2 rounded-lg hover:bg-blue-700 transition-colors text-center touch-manipulation"
                >
                  开始质检
                </a>
              </div>
            </div>
          </div>

          {/* History Table */}
          <HistoryTable
            jobs={filteredJobs}
            onFilter={handleFilter}
            currentUser={profile}
          />

          {/* Navigation */}
          <div className="mt-4 sm:mt-6 flex justify-center">
            <a
              href="/"
              className="bg-blue-600 text-white px-6 py-3 sm:py-2 rounded-lg hover:bg-blue-700 transition-colors touch-manipulation"
            >
              返回质检
            </a>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}