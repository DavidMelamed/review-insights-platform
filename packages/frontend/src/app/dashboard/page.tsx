'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ChartBarIcon, 
  DocumentTextIcon, 
  PlusIcon,
  ArrowDownTrayIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface DashboardStats {
  totalCollections: number
  totalReviews: number
  averageRating: number
  sentimentBreakdown: {
    positive: number
    negative: number
    neutral: number
  }
  recentActivity: Array<{
    id: string
    type: 'collection' | 'report'
    title: string
    timestamp: string
    status: string
  }>
  monthlyTrend: Array<{
    month: string
    reviews: number
    averageRating: number
  }>
  topComplaints: Array<{
    category: string
    count: number
    severity: string
  }>
}

export default function DashboardPage() {
  const router = useRouter()
  const [selectedTimeRange, setSelectedTimeRange] = useState('30d')

  // Fetch dashboard stats
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', selectedTimeRange],
    queryFn: async () => {
      const response = await axios.get('/api/dashboard/stats', {
        params: { range: selectedTimeRange },
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      })
      return response.data
    },
  })

  // Check authentication
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
    }
  }, [router])

  if (isLoading || !stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // Chart configurations
  const sentimentChartData = {
    labels: ['Positive', 'Negative', 'Neutral'],
    datasets: [
      {
        data: [
          stats.sentimentBreakdown.positive,
          stats.sentimentBreakdown.negative,
          stats.sentimentBreakdown.neutral,
        ],
        backgroundColor: ['#10b981', '#ef4444', '#6b7280'],
        borderWidth: 0,
      },
    ],
  }

  const trendChartData = {
    labels: stats.monthlyTrend.map(d => d.month),
    datasets: [
      {
        label: 'Review Count',
        data: stats.monthlyTrend.map(d => d.reviews),
        borderColor: '#6366f1',
        backgroundColor: '#6366f120',
        fill: true,
        tension: 0.4,
        yAxisID: 'y',
      },
      {
        label: 'Average Rating',
        data: stats.monthlyTrend.map(d => d.averageRating),
        borderColor: '#f59e0b',
        backgroundColor: '#f59e0b20',
        fill: true,
        tension: 0.4,
        yAxisID: 'y1',
      },
    ],
  }

  const complaintsChartData = {
    labels: stats.topComplaints.map(c => c.category),
    datasets: [
      {
        label: 'Complaint Count',
        data: stats.topComplaints.map(c => c.count),
        backgroundColor: stats.topComplaints.map(c => 
          c.severity === 'high' ? '#ef4444' : 
          c.severity === 'medium' ? '#f59e0b' : 
          '#6b7280'
        ),
      },
    ],
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">
                Welcome back! Here's your review analysis overview.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={selectedTimeRange}
                onChange={(e) => setSelectedTimeRange(e.target.value)}
                className="rounded-md border-gray-300 text-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="365d">Last year</option>
              </select>
              <button
                onClick={() => router.push('/dashboard/collect')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                New Collection
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Collections</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalCollections}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <DocumentTextIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Reviews</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalReviews.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <SparklesIcon className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Average Rating</p>
                <p className="text-2xl font-bold text-gray-900">{stats.averageRating.toFixed(1)}/5.0</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Issues</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.topComplaints.filter(c => c.severity === 'high').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          {/* Sentiment Breakdown */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Sentiment Breakdown</h3>
            <div className="h-64">
              <Doughnut 
                data={sentimentChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                    },
                  },
                }}
              />
            </div>
          </div>

          {/* Monthly Trend */}
          <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Review Trends</h3>
            <div className="h-64">
              <Line 
                data={trendChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: {
                    mode: 'index' as const,
                    intersect: false,
                  },
                  scales: {
                    y: {
                      type: 'linear' as const,
                      display: true,
                      position: 'left' as const,
                      title: {
                        display: true,
                        text: 'Review Count',
                      },
                    },
                    y1: {
                      type: 'linear' as const,
                      display: true,
                      position: 'right' as const,
                      title: {
                        display: true,
                        text: 'Average Rating',
                      },
                      grid: {
                        drawOnChartArea: false,
                      },
                      min: 0,
                      max: 5,
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>

        {/* Complaints Analysis */}
        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Complaint Categories</h3>
          <div className="h-64">
            <Bar
              data={complaintsChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y' as const,
                plugins: {
                  legend: {
                    display: false,
                  },
                },
                scales: {
                  x: {
                    beginAtZero: true,
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow mt-6">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {stats.recentActivity.map((activity) => (
              <div key={activity.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`flex-shrink-0 h-2 w-2 rounded-full ${
                      activity.status === 'completed' ? 'bg-green-400' :
                      activity.status === 'processing' ? 'bg-yellow-400' :
                      'bg-gray-400'
                    }`} />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                      <p className="text-sm text-gray-500">
                        {activity.type === 'collection' ? 'Review Collection' : 'Report Generated'}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {format(new Date(activity.timestamp), 'MMM d, h:mm a')}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="px-6 py-3 border-t">
            <button
              onClick={() => router.push('/dashboard/activity')}
              className="text-sm text-indigo-600 hover:text-indigo-500 font-medium"
            >
              View all activity →
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <button
            onClick={() => router.push('/dashboard/collect')}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow text-left"
          >
            <PlusIcon className="h-8 w-8 text-indigo-600 mb-3" />
            <h4 className="text-lg font-semibold text-gray-900">Collect Reviews</h4>
            <p className="text-sm text-gray-600 mt-1">
              Start a new review collection from multiple sources
            </p>
          </button>

          <button
            onClick={() => router.push('/dashboard/reports')}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow text-left"
          >
            <DocumentTextIcon className="h-8 w-8 text-green-600 mb-3" />
            <h4 className="text-lg font-semibold text-gray-900">Generate Report</h4>
            <p className="text-sm text-gray-600 mt-1">
              Create branded reports with insights and recommendations
            </p>
          </button>

          <button
            onClick={() => router.push('/dashboard/export')}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow text-left"
          >
            <ArrowDownTrayIcon className="h-8 w-8 text-purple-600 mb-3" />
            <h4 className="text-lg font-semibold text-gray-900">Export Data</h4>
            <p className="text-sm text-gray-600 mt-1">
              Download your reviews and insights as CSV or JSON
            </p>
          </button>
        </div>
      </div>
    </div>
  )
}