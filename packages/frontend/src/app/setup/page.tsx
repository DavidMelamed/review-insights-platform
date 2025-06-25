'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Sparkles, 
  Search, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  ChevronRight,
  Building2,
  Globe,
  Users,
  BarChart3,
  Bell,
  FileText,
  Zap,
  Brain
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface SetupStep {
  id: string
  name: string
  icon: any
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
}

export default function ZeroConfigSetup() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [setupStarted, setSetupStarted] = useState(false)
  const [setupId, setSetupId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('')
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const [setupComplete, setSetupComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const steps: SetupStep[] = [
    { id: 'discovery', name: 'Discovering your business', icon: Search, status: 'pending' },
    { id: 'competitors', name: 'Finding competitors', icon: Users, status: 'pending' },
    { id: 'sources', name: 'Locating review sources', icon: Globe, status: 'pending' },
    { id: 'monitoring', name: 'Setting up monitoring', icon: Bell, status: 'pending' },
    { id: 'reporting', name: 'Configuring reports', icon: FileText, status: 'pending' },
    { id: 'integrations', name: 'Preparing integrations', icon: Zap, status: 'pending' },
    { id: 'ai', name: 'Training AI assistant', icon: Brain, status: 'pending' },
    { id: 'finalize', name: 'Finalizing setup', icon: CheckCircle2, status: 'pending' },
  ]

  const handleStartSetup = async () => {
    if (!identifier.trim()) return

    setIsSearching(true)
    setError(null)

    try {
      const response = await fetch('/api/setup/zero-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      })

      if (!response.ok) throw new Error('Setup failed')

      const data = await response.json()
      setSetupId(data.businessId)
      setSetupStarted(true)
      
      // Start polling for progress
      pollSetupProgress(data.businessId)
    } catch (err) {
      setError('Unable to start setup. Please try again.')
      setIsSearching(false)
    }
  }

  const pollSetupProgress = async (id: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/setup/status/${id}`)
        if (!response.ok) throw new Error('Failed to get status')

        const data = await response.json()
        
        setProgress(data.progress.percentComplete)
        setCurrentStep(data.progress.currentStep)
        setCompletedSteps(data.progress.completedSteps)

        if (data.status === 'completed') {
          clearInterval(pollInterval)
          setSetupComplete(true)
          setTimeout(() => {
            router.push('/dashboard')
          }, 2000)
        } else if (data.status === 'failed') {
          clearInterval(pollInterval)
          setError('Setup failed. Please try again.')
          setSetupStarted(false)
          setIsSearching(false)
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }, 1000)

    // Clean up on unmount
    return () => clearInterval(pollInterval)
  }

  const getStepStatus = (stepId: string): SetupStep['status'] => {
    if (completedSteps.includes(stepId)) return 'completed'
    if (currentStep === stepId) return 'in_progress'
    return 'pending'
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          {/* Header */}
          <div className="text-center mb-12">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.6 }}
              className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mb-6"
            >
              <Sparkles className="w-10 h-10 text-white" />
            </motion.div>
            
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              {setupStarted ? 'Setting up your account' : 'Let\'s get started'}
            </h1>
            
            <p className="text-xl text-gray-600 dark:text-gray-300">
              {setupStarted 
                ? 'Sit back while we configure everything for you'
                : 'Just tell us who you are, and we\'ll handle the rest'
              }
            </p>
          </div>

          <AnimatePresence mode="wait">
            {!setupStarted ? (
              // Initial search form
              <motion.div
                key="search"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8"
              >
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Enter your business name, website, or email
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleStartSetup()}
                        placeholder="e.g., Acme Corp, acme.com, or john@acme.com"
                        className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        disabled={isSearching}
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                        {isSearching ? (
                          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                        ) : (
                          <Search className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 text-red-600 dark:text-red-400"
                    >
                      <AlertCircle className="w-5 h-5" />
                      <span>{error}</span>
                    </motion.div>
                  )}

                  <button
                    onClick={handleStartSetup}
                    disabled={!identifier.trim() || isSearching}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 px-6 rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        Get Started
                        <ChevronRight className="w-5 h-5" />
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex-1">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Our AI will automatically:
                      </p>
                      <ul className="mt-2 space-y-1 text-sm text-gray-500 dark:text-gray-400">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          Discover your business details
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          Find all your review sources
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          Identify your competitors
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          Configure monitoring & alerts
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              // Setup progress
              <motion.div
                key="progress"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8"
              >
                {/* Progress bar */}
                <div className="mb-8">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Setup Progress
                    </span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {progress}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <motion.div
                      className="bg-gradient-to-r from-purple-600 to-pink-600 h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>

                {/* Steps */}
                <div className="space-y-4">
                  {steps.map((step, index) => {
                    const status = getStepStatus(step.id)
                    const Icon = step.icon

                    return (
                      <motion.div
                        key={step.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`flex items-center gap-4 p-4 rounded-lg transition-all ${
                          status === 'in_progress' 
                            ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700'
                            : status === 'completed'
                            ? 'bg-green-50 dark:bg-green-900/20'
                            : 'bg-gray-50 dark:bg-gray-700/50'
                        }`}
                      >
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                          status === 'completed' 
                            ? 'bg-green-500 text-white'
                            : status === 'in_progress'
                            ? 'bg-purple-500 text-white'
                            : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                        }`}>
                          {status === 'completed' ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : status === 'in_progress' ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Icon className="w-5 h-5" />
                          )}
                        </div>

                        <div className="flex-1">
                          <h3 className={`font-medium ${
                            status === 'pending' 
                              ? 'text-gray-500 dark:text-gray-400' 
                              : 'text-gray-900 dark:text-white'
                          }`}>
                            {step.name}
                          </h3>
                          {status === 'in_progress' && (
                            <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                              Processing...
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>

                {setupComplete && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 text-center"
                  >
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full mb-4">
                      <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      Setup Complete!
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      Redirecting to your dashboard...
                    </p>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Features showcase */}
          {!setupStarted && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {[
                {
                  icon: Building2,
                  title: 'Business Discovery',
                  description: 'We automatically find and verify your business information',
                },
                {
                  icon: BarChart3,
                  title: 'Instant Analytics',
                  description: 'Get insights from your existing reviews immediately',
                },
                {
                  icon: Users,
                  title: 'Competitor Analysis',
                  description: 'Discover and monitor your competition automatically',
                },
                {
                  icon: Brain,
                  title: 'AI Configuration',
                  description: 'Personalized AI responses based on your industry',
                },
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md"
                >
                  <feature.icon className="w-8 h-8 text-purple-600 dark:text-purple-400 mb-4" />
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}