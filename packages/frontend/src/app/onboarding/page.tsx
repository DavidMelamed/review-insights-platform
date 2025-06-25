'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { MagnifyingGlassIcon, SparklesIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { useForm } from 'react-hook-form'
import axios from 'axios'
import toast from 'react-hot-toast'
import { BusinessDiscoveryService } from '@/services/business-discovery'
import { OnboardingPredictionService } from '@/services/onboarding-prediction'

interface OnboardingData {
  businessIdentifier: string; // Email, website, or business name
  discoveredInfo?: DiscoveredBusinessInfo;
  selectedPlan?: string;
  predictedNeeds?: PredictedNeeds;
}

interface DiscoveredBusinessInfo {
  businessName: string;
  website?: string;
  industry?: string;
  location?: string;
  size?: 'small' | 'medium' | 'large' | 'enterprise';
  socialProfiles?: {
    google?: string;
    yelp?: string;
    facebook?: string;
    linkedin?: string;
  };
  competitorNames?: string[];
  reviewSources?: string[];
  estimatedReviewVolume?: number;
  currentRating?: number;
  logo?: string;
  brandColors?: {
    primary: string;
    secondary: string;
  };
}

interface PredictedNeeds {
  recommendedPlan: string;
  suggestedFeatures: string[];
  reportFrequency: 'daily' | 'weekly' | 'monthly';
  alertPreferences: {
    negativeReviews: boolean;
    competitorMentions: boolean;
    volumeSpikes: boolean;
    responseTime: 'immediate' | '1hour' | 'daily';
  };
  integrations: string[];
  teamSize: number;
}

export default function AIOnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<'discovery' | 'confirmation' | 'setup'>('discovery')
  const [loading, setLoading] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    businessIdentifier: '',
  })
  
  const discoveryService = new BusinessDiscoveryService()
  const predictionService = new OnboardingPredictionService()

  const { register, handleSubmit, setValue, watch } = useForm()
  const businessIdentifier = watch('businessIdentifier')

  // Auto-discovery when user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (businessIdentifier && businessIdentifier.length > 3) {
        discoverBusiness(businessIdentifier)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [businessIdentifier])

  const discoverBusiness = async (identifier: string) => {
    setDiscovering(true)
    try {
      // AI-powered business discovery
      const discovered = await discoveryService.discover(identifier)
      const predicted = await predictionService.predictNeeds(discovered)
      
      setOnboardingData({
        businessIdentifier: identifier,
        discoveredInfo: discovered,
        predictedNeeds: predicted,
      })

      // Auto-advance if we found enough info
      if (discovered.businessName && discovered.website) {
        setTimeout(() => setStep('confirmation'), 1500)
      }
    } catch (error) {
      console.error('Discovery failed:', error)
    } finally {
      setDiscovering(false)
    }
  }

  const handleQuickStart = async () => {
    setLoading(true)
    try {
      // Create account with discovered info
      const response = await axios.post('/api/onboarding/quick-setup', {
        discoveredInfo: onboardingData.discoveredInfo,
        predictedNeeds: onboardingData.predictedNeeds,
      })

      toast.success('Account created! Setting up your workspace...')
      
      // Auto-configure everything
      await setupWorkspace(response.data.userId)
      
      router.push('/dashboard')
    } catch (error) {
      toast.error('Setup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const setupWorkspace = async (userId: string) => {
    // Queue initial review collection
    await axios.post('/api/reviews/collect', {
      businessName: onboardingData.discoveredInfo?.businessName,
      sources: onboardingData.discoveredInfo?.reviewSources || ['google', 'yelp'],
      includeCompetitors: true,
    })

    // Set up alerts based on predictions
    if (onboardingData.predictedNeeds?.alertPreferences.negativeReviews) {
      await axios.post('/api/alerts/create', {
        type: 'negative_review',
        enabled: true,
      })
    }

    // Schedule first report
    await axios.post('/api/reports/schedule', {
      frequency: onboardingData.predictedNeeds?.reportFrequency || 'weekly',
      autoSend: true,
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <AnimatePresence mode="wait">
          {step === 'discovery' && (
            <motion.div
              key="discovery"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center">
                <SparklesIcon className="h-16 w-16 text-indigo-600 mx-auto mb-4" />
                <h1 className="text-4xl font-bold text-gray-900 mb-2">
                  Let AI Set Up Everything
                </h1>
                <p className="text-xl text-gray-600">
                  Just tell us who you are. We'll handle the rest.
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-8">
                <form onSubmit={handleSubmit(() => setStep('confirmation'))}>
                  <div className="relative">
                    <input
                      {...register('businessIdentifier')}
                      type="text"
                      placeholder="Enter your email, website, or business name..."
                      className="w-full px-6 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors"
                      autoFocus
                    />
                    {discovering && (
                      <div className="absolute right-4 top-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                      </div>
                    )}
                  </div>

                  {onboardingData.discoveredInfo && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-6 p-6 bg-indigo-50 rounded-xl"
                    >
                      <p className="text-sm font-medium text-indigo-900 mb-2">
                        ✨ We found your business!
                      </p>
                      <div className="space-y-2">
                        {onboardingData.discoveredInfo.logo && (
                          <img 
                            src={onboardingData.discoveredInfo.logo} 
                            alt="Business logo" 
                            className="h-12 w-auto"
                          />
                        )}
                        <p className="font-semibold text-gray-900">
                          {onboardingData.discoveredInfo.businessName}
                        </p>
                        {onboardingData.discoveredInfo.industry && (
                          <p className="text-sm text-gray-600">
                            Industry: {onboardingData.discoveredInfo.industry}
                          </p>
                        )}
                        {onboardingData.discoveredInfo.currentRating && (
                          <p className="text-sm text-gray-600">
                            Current Rating: {onboardingData.discoveredInfo.currentRating}⭐
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}

                  <div className="mt-8 flex justify-center">
                    <button
                      type="submit"
                      disabled={!onboardingData.discoveredInfo}
                      className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      Continue
                    </button>
                  </div>
                </form>

                <div className="mt-8 text-center">
                  <p className="text-sm text-gray-500">
                    Or start with a template:
                  </p>
                  <div className="mt-4 flex justify-center gap-4">
                    <button
                      onClick={() => setValue('businessIdentifier', 'restaurant')}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:border-indigo-500 transition-colors"
                    >
                      🍽️ Restaurant
                    </button>
                    <button
                      onClick={() => setValue('businessIdentifier', 'ecommerce')}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:border-indigo-500 transition-colors"
                    >
                      🛍️ E-commerce
                    </button>
                    <button
                      onClick={() => setValue('businessIdentifier', 'saas')}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:border-indigo-500 transition-colors"
                    >
                      💻 SaaS
                    </button>
                    <button
                      onClick={() => setValue('businessIdentifier', 'hotel')}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:border-indigo-500 transition-colors"
                    >
                      🏨 Hotel
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'confirmation' && onboardingData.discoveredInfo && (
            <motion.div
              key="confirmation"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center">
                <CheckCircleIcon className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <h1 className="text-4xl font-bold text-gray-900 mb-2">
                  Perfect! Here's what we'll set up
                </h1>
                <p className="text-xl text-gray-600">
                  Everything is configured based on businesses like yours
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-8">
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-4">
                      📊 Your Business Profile
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Business</span>
                        <span className="font-medium">{onboardingData.discoveredInfo.businessName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Industry</span>
                        <span className="font-medium">{onboardingData.discoveredInfo.industry}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Location</span>
                        <span className="font-medium">{onboardingData.discoveredInfo.location}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Review Sources</span>
                        <span className="font-medium">
                          {onboardingData.discoveredInfo.reviewSources?.length || 0} platforms
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-4">
                      🎯 AI Recommendations
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Best Plan</span>
                        <span className="font-medium text-indigo-600">
                          {onboardingData.predictedNeeds?.recommendedPlan}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Report Frequency</span>
                        <span className="font-medium">
                          {onboardingData.predictedNeeds?.reportFrequency}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Team Size</span>
                        <span className="font-medium">
                          {onboardingData.predictedNeeds?.teamSize} seats
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Integrations</span>
                        <span className="font-medium">
                          {onboardingData.predictedNeeds?.integrations.join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 p-6 bg-indigo-50 rounded-xl">
                  <h4 className="font-semibold text-indigo-900 mb-3">
                    🚀 What happens next:
                  </h4>
                  <ul className="space-y-2 text-sm text-indigo-800">
                    <li className="flex items-start">
                      <span className="mr-2">1.</span>
                      <span>We'll start collecting your reviews from all platforms</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">2.</span>
                      <span>AI will analyze your current reputation and competitors</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">3.</span>
                      <span>You'll get your first insights report in ~5 minutes</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">4.</span>
                      <span>Alerts will be configured for critical reviews</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-8 flex justify-center gap-4">
                  <button
                    onClick={() => setStep('discovery')}
                    className="px-6 py-3 text-gray-700 font-medium rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleQuickStart}
                    disabled={loading}
                    className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Setting up...
                      </>
                    ) : (
                      <>
                        <SparklesIcon className="h-5 w-5" />
                        Start with AI Setup
                      </>
                    )}
                  </button>
                </div>

                <p className="mt-4 text-center text-sm text-gray-500">
                  Want to customize? You can change everything later in settings.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}