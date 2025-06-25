'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  ChartBarIcon, 
  SparklesIcon, 
  DocumentTextIcon,
  ShieldCheckIcon,
  BoltIcon,
  GlobeAltIcon,
  CheckIcon,
  ArrowRightIcon,
  StarIcon,
  ChartPieIcon,
  CpuChipIcon,
  ClockIcon,
  CloudArrowUpIcon,
  ServerIcon,
  UserGroupIcon,
  BuildingOffice2Icon,
  ChatBubbleLeftRightIcon,
  MagnifyingGlassIcon,
  BellAlertIcon,
  PresentationChartLineIcon,
  DevicePhoneMobileIcon,
  LanguageIcon,
} from '@heroicons/react/24/outline'
import { loadStripe } from '@stripe/stripe-js'
import axios from 'axios'
import toast from 'react-hot-toast'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const features = [
  {
    name: 'Zero-Config AI Setup',
    description: 'Just enter your business name. AI discovers everything - platforms, competitors, metrics.',
    icon: SparklesIcon,
  },
  {
    name: 'Multi-Platform Collection',
    description: 'Google, Yelp, Facebook, Amazon, G2, Trustpilot + social media monitoring.',
    icon: GlobeAltIcon,
  },
  {
    name: 'Predictive Analytics',
    description: 'Forecast customer churn, satisfaction trends, and business impact with AI.',
    icon: ChartBarIcon,
  },
  {
    name: 'AI Response Generator',
    description: 'Generate personalized responses in your brand voice for every review.',
    icon: ChatBubbleLeftRightIcon,
  },
  {
    name: 'Real-Time Alerts',
    description: 'Get notified instantly about critical reviews with smart severity detection.',
    icon: BellAlertIcon,
  },
  {
    name: 'White-Label Reports',
    description: 'Beautiful PDF reports with your branding, data storytelling, and citations.',
    icon: DocumentTextIcon,
  },
  {
    name: 'Mobile SDK',
    description: 'React Native SDK to collect in-app reviews directly from your mobile app.',
    icon: DevicePhoneMobileIcon,
  },
  {
    name: 'Industry Benchmarking',
    description: 'Compare your performance against industry standards and competitors.',
    icon: BuildingOffice2Icon,
  },
  {
    name: 'Multi-Language Support',
    description: 'Analyze and respond to reviews in 15+ languages with AI translation.',
    icon: LanguageIcon,
  },
]

const plans = [
  {
    id: 'FREE',
    name: 'Free',
    price: { monthly: 0, yearly: 0 },
    description: 'Perfect for trying out Review Insights',
    features: [
      '100 reviews/month',
      '10 AI responses/month',
      '1 business location',
      'Basic analytics',
      'Email support',
      'CSV export',
      'Zero-config setup'
    ],
    cta: 'Start Free',
    highlighted: false,
  },
  {
    id: 'STARTER',
    name: 'Starter',
    price: { monthly: 49, yearly: 470 },
    description: 'For small businesses getting started',
    features: [
      '1,000 reviews/month',
      '100 AI responses/month',
      '3 business locations',
      'Advanced analytics',
      'Priority support',
      'API access',
      'Custom branding',
      'Competitor tracking',
      'Slack integration'
    ],
    cta: 'Start Trial',
    highlighted: false,
  },
  {
    id: 'GROWTH',
    name: 'Growth',
    price: { monthly: 199, yearly: 1910 },
    description: 'For growing businesses',
    features: [
      '10,000 reviews/month',
      '1,000 AI responses/month',
      '10 business locations',
      'Predictive analytics',
      'Phone support',
      'White-label options',
      'Custom integrations',
      'Team collaboration',
      'Industry benchmarking',
      'Mobile SDK access',
      'Webhook support'
    ],
    cta: 'Start Trial',
    highlighted: true,
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: { monthly: 999, yearly: 9590 },
    description: 'For large organizations',
    features: [
      'Unlimited reviews',
      'Unlimited AI responses',
      'Unlimited locations',
      'Custom AI training',
      'Dedicated support',
      'SLA guarantee',
      'SSO/SAML',
      'Custom contracts',
      'On-premise option',
      'Multi-tenant support',
      'Advanced security'
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
]

const testimonials = [
  {
    content: "The zero-config setup blew my mind. Just typed our restaurant name and it found everything - our reviews, competitors, even trending complaints we didn't know about!",
    author: "Maria Garcia",
    role: "Owner, Bella Vista Restaurant",
    company: "Restaurant Chain",
    rating: 5,
  },
  {
    content: "Predictive analytics helped us prevent a 30% churn by identifying unhappy customers early. The ROI was immediate and measurable.",
    author: "James Chen",
    role: "VP Customer Success",
    company: "TechCorp SaaS",
    rating: 5,
  },
  {
    content: "The AI responses are incredible - they sound exactly like our brand voice. We're responding 10x faster and customers notice the difference.",
    author: "Emily Thompson",
    role: "Marketing Director",
    company: "E-commerce Brand",
    rating: 5,
  },
]

const deploymentOptions = [
  { name: 'Railway', time: '30 seconds', icon: CloudArrowUpIcon },
  { name: 'Render', time: '1 minute', icon: ServerIcon },
  { name: 'Vercel', time: '30 seconds', icon: BoltIcon },
  { name: 'Docker', time: '5 minutes', icon: ServerIcon },
]

export default function LandingPage() {
  const [loading, setLoading] = useState<string | null>(null)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [demoBusinessName, setDemoBusinessName] = useState('')
  const [demoLoading, setDemoLoading] = useState(false)

  const handleCheckout = async (planId: string) => {
    if (planId === 'FREE') {
      window.location.href = '/signup'
      return
    }

    if (planId === 'ENTERPRISE') {
      window.location.href = '/contact'
      return
    }

    setLoading(planId)
    try {
      const response = await axios.post('/api/checkout', {
        planId,
        successUrl: `${window.location.origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: window.location.origin,
      })

      const stripe = await stripePromise
      if (!stripe) throw new Error('Stripe not loaded')

      const { error } = await stripe.redirectToCheckout({
        sessionId: response.data.sessionId,
      })

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('Checkout error:', error)
      toast.error('Failed to start checkout. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!demoBusinessName.trim()) return

    setDemoLoading(true)
    // Simulate AI discovery
    setTimeout(() => {
      toast.success(`AI discovered ${demoBusinessName}! Found 1,234 reviews across 5 platforms.`)
      setDemoLoading(false)
      window.location.href = '/demo'
    }, 2000)
  }

  const currentPrice = (plan: typeof plans[0]) => {
    return billingCycle === 'yearly' ? plan.price.yearly : plan.price.monthly
  }

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <div className="relative isolate overflow-hidden bg-gradient-to-b from-indigo-50 to-white">
        <div className="absolute inset-y-0 right-1/2 -z-10 mr-16 w-[200%] origin-bottom-left skew-x-[-30deg] bg-white shadow-xl shadow-indigo-600/10 ring-1 ring-indigo-50 sm:mr-28 lg:mr-0 xl:mr-16 xl:origin-center" />
        
        <div className="mx-auto max-w-7xl px-6 pt-10 pb-24 sm:pt-16 lg:px-8 lg:pt-24">
          <div className="mx-auto max-w-2xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-4 inline-flex items-center rounded-full bg-indigo-600/10 px-3 py-1 text-sm font-medium text-indigo-600"
            >
              <SparklesIcon className="mr-2 h-4 w-4" />
              Zero-Config AI Setup - Just Enter Your Business Name!
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl"
            >
              Turn Reviews Into Revenue with{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                AI Magic
              </span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-6 text-lg leading-8 text-gray-600"
            >
              AI discovers your business everywhere, analyzes sentiment, predicts trends, 
              and generates perfect responses. No configuration needed - just type your business name!
            </motion.p>
            
            {/* Demo Input */}
            <motion.form 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              onSubmit={handleDemoSubmit}
              className="mt-10 flex flex-col sm:flex-row gap-4 max-w-md mx-auto"
            >
              <input
                type="text"
                value={demoBusinessName}
                onChange={(e) => setDemoBusinessName(e.target.value)}
                placeholder="Enter any business name..."
                className="flex-1 rounded-full border border-gray-300 px-6 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
              <button
                type="submit"
                disabled={demoLoading}
                className="rounded-full bg-indigo-600 px-8 py-3 text-base font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all disabled:opacity-50"
              >
                {demoLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    AI Discovering...
                  </span>
                ) : (
                  'Try AI Discovery'
                )}
              </button>
            </motion.form>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-4 text-sm text-gray-600"
            >
              Try "Starbucks", "Amazon", or your own business
            </motion.p>

            {/* Quick Stats */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4"
            >
              <div className="bg-white/80 backdrop-blur rounded-xl px-6 py-4 border border-gray-200 shadow-sm">
                <p className="text-3xl font-bold text-indigo-600">30s</p>
                <p className="text-sm text-gray-600">Setup Time</p>
              </div>
              <div className="bg-white/80 backdrop-blur rounded-xl px-6 py-4 border border-gray-200 shadow-sm">
                <p className="text-3xl font-bold text-indigo-600">50M+</p>
                <p className="text-sm text-gray-600">Reviews Analyzed</p>
              </div>
              <div className="bg-white/80 backdrop-blur rounded-xl px-6 py-4 border border-gray-200 shadow-sm">
                <p className="text-3xl font-bold text-indigo-600">10k+</p>
                <p className="text-sm text-gray-600">Happy Businesses</p>
              </div>
              <div className="bg-white/80 backdrop-blur rounded-xl px-6 py-4 border border-gray-200 shadow-sm">
                <p className="text-3xl font-bold text-indigo-600">4.8★</p>
                <p className="text-sm text-gray-600">User Rating</p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* How Zero-Config Works */}
      <div className="bg-gray-50 py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-base font-semibold leading-7 text-indigo-600">Zero-Config Magic</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              AI Does Everything For You
            </p>
            <p className="mt-4 text-lg text-gray-600">
              Just enter your business name. Watch the AI work its magic.
            </p>
          </div>
          
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-4">
              {[
                {
                  step: '1',
                  title: 'Enter Business Name',
                  description: 'Type "Starbucks" or any business',
                  icon: MagnifyingGlassIcon,
                  time: '5 seconds'
                },
                {
                  step: '2',
                  title: 'AI Discovers Everything',
                  description: 'Finds all platforms & competitors',
                  icon: SparklesIcon,
                  time: '10 seconds'
                },
                {
                  step: '3',
                  title: 'Analyzes & Configures',
                  description: 'Sets up monitoring & alerts',
                  icon: CpuChipIcon,
                  time: '10 seconds'
                },
                {
                  step: '4',
                  title: 'Ready to Use!',
                  description: 'Dashboard, insights, responses',
                  icon: PresentationChartLineIcon,
                  time: '5 seconds'
                }
              ].map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="relative text-center"
                >
                  <div className="mx-auto h-20 w-20 rounded-2xl bg-indigo-100 flex items-center justify-center">
                    <item.icon className="h-10 w-10 text-indigo-600" />
                  </div>
                  <div className="mt-4 text-5xl font-bold text-indigo-600">{item.step}</div>
                  <h3 className="mt-2 text-lg font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-1 text-base text-gray-600">{item.description}</p>
                  <p className="mt-2 text-sm font-medium text-indigo-600 flex items-center justify-center">
                    <ClockIcon className="mr-1 h-4 w-4" />
                    {item.time}
                  </p>
                  {index < 3 && (
                    <div className="hidden lg:block absolute top-10 left-full w-full">
                      <ArrowRightIcon className="h-8 w-8 text-gray-300 -ml-4" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
            
            <div className="mt-12 text-center">
              <p className="text-2xl font-bold text-gray-900">Total Setup Time: 30 Seconds!</p>
              <p className="mt-2 text-gray-600">Faster than making a cup of coffee ☕</p>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-indigo-600">Complete Platform</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Everything You Need to Manage Reviews
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-3 lg:gap-y-16">
            {features.map((feature, index) => (
              <motion.div
                key={feature.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.05 }}
                viewport={{ once: true }}
                className="relative pl-16"
              >
                <dt className="text-base font-semibold leading-7 text-gray-900">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600">
                    <feature.icon className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                  {feature.name}
                </dt>
                <dd className="mt-2 text-base leading-7 text-gray-600">{feature.description}</dd>
              </motion.div>
            ))}
          </dl>
        </div>
      </div>

      {/* Testimonials */}
      <div className="bg-gray-50 py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Loved by 10,000+ Businesses
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              See why businesses choose Review Insights for AI-powered review management
            </p>
          </div>
          <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-8 lg:max-w-none lg:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="flex flex-col justify-between rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200"
              >
                <div>
                  <div className="flex gap-1">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <StarIcon key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="mt-4 text-base text-gray-700">"{testimonial.content}"</p>
                </div>
                <div className="mt-6">
                  <p className="text-base font-semibold text-gray-900">{testimonial.author}</p>
                  <p className="text-sm text-gray-600">{testimonial.role}</p>
                  <p className="text-sm text-gray-500">{testimonial.company}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div id="pricing" className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Simple, Transparent Pricing
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Start free, upgrade when you need more
            </p>
            
            {/* Billing Toggle */}
            <div className="mt-8 flex items-center justify-center gap-4">
              <span className={`${billingCycle === 'monthly' ? 'text-gray-900' : 'text-gray-500'}`}>
                Monthly
              </span>
              <button
                onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
                className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`${billingCycle === 'yearly' ? 'text-gray-900' : 'text-gray-500'}`}>
                Yearly
                <span className="ml-1 text-sm font-medium text-green-600">(Save 20%)</span>
              </span>
            </div>
          </div>
          
          <div className="mx-auto mt-16 grid max-w-lg grid-cols-1 gap-y-6 sm:mt-20 sm:gap-y-0 lg:max-w-none lg:grid-cols-4 lg:gap-x-8">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className={`relative flex flex-col justify-between rounded-3xl bg-white p-8 shadow-xl ring-1 ${
                  plan.highlighted
                    ? 'ring-2 ring-indigo-600 shadow-2xl scale-105'
                    : 'ring-gray-200'
                } sm:p-10`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-5 left-0 right-0 mx-auto w-32">
                    <div className="rounded-full bg-indigo-600 px-3 py-1 text-sm font-medium text-white text-center">
                      Most Popular
                    </div>
                  </div>
                )}
                
                <div>
                  <h3 className="text-base font-semibold leading-7 text-indigo-600">
                    {plan.name}
                  </h3>
                  <div className="mt-4 flex items-baseline gap-x-2">
                    <span className="text-5xl font-bold tracking-tight text-gray-900">
                      ${currentPrice(plan)}
                    </span>
                    {plan.price.monthly > 0 && (
                      <span className="text-base font-semibold leading-7 text-gray-600">
                        /{billingCycle === 'monthly' ? 'month' : 'year'}
                      </span>
                    )}
                  </div>
                  <p className="mt-6 text-base leading-7 text-gray-600">{plan.description}</p>
                  <ul className="mt-10 space-y-4 text-sm leading-6 text-gray-600">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-x-3">
                        <CheckIcon
                          className="h-6 w-5 flex-none text-indigo-600"
                          aria-hidden="true"
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  onClick={() => handleCheckout(plan.id)}
                  disabled={loading === plan.id}
                  className={`mt-8 block w-full rounded-md px-3.5 py-2 text-center text-sm font-semibold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                    plan.highlighted
                      ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-indigo-600'
                      : 'bg-white text-indigo-600 ring-1 ring-inset ring-indigo-200 hover:ring-indigo-300'
                  } disabled:opacity-50 transition-all`}
                >
                  {loading === plan.id ? 'Loading...' : plan.cta}
                </button>
              </motion.div>
            ))}
          </div>
          
          <div className="mt-12 text-center">
            <p className="text-base text-gray-600">
              All plans include SSL, 99.9% uptime SLA, and GDPR compliance
            </p>
            <p className="mt-2 text-base text-gray-600">
              Need a custom plan? <Link href="/contact" className="font-medium text-indigo-600 hover:text-indigo-500">Contact sales</Link>
            </p>
          </div>
        </div>
      </div>

      {/* Deployment Options */}
      <div className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">
              Deploy in Seconds
            </h2>
            <p className="mt-2 text-base text-gray-600">
              One-click deployment to your favorite platform
            </p>
          </div>
          <div className="mx-auto mt-8 grid max-w-2xl grid-cols-2 gap-4 lg:max-w-none lg:grid-cols-4">
            {deploymentOptions.map((option, index) => (
              <motion.div
                key={option.name}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                viewport={{ once: true }}
                className="flex flex-col items-center rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200 hover:ring-indigo-300 transition-all"
              >
                <option.icon className="h-8 w-8 text-indigo-600" />
                <p className="mt-2 text-sm font-semibold text-gray-900">{option.name}</p>
                <p className="text-xs text-gray-600">{option.time}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to Transform Your Reviews?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-indigo-100">
              Join 10,000+ businesses using AI to turn reviews into revenue. 
              Zero configuration, instant insights.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                href="/demo"
                className="rounded-md bg-white px-6 py-3 text-base font-semibold text-indigo-600 shadow-sm hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors"
              >
                Try Live Demo
              </Link>
              <Link
                href="/get-started"
                className="text-base font-semibold leading-6 text-white hover:text-indigo-100 transition-colors flex items-center"
              >
                Start Free <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Link>
            </div>
            
            <div className="mt-8 flex items-center justify-center gap-6 text-sm text-indigo-100">
              <span className="flex items-center">
                <CheckIcon className="mr-2 h-4 w-4" />
                No credit card required
              </span>
              <span className="flex items-center">
                <CheckIcon className="mr-2 h-4 w-4" />
                30-second setup
              </span>
              <span className="flex items-center">
                <CheckIcon className="mr-2 h-4 w-4" />
                Cancel anytime
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-white font-semibold mb-4">Review Insights</h3>
              <p className="text-sm">
                AI-powered review management with zero-config setup. Turn feedback into revenue.
              </p>
              <div className="mt-4 flex gap-4">
                <Link href="/demo" className="text-sm text-indigo-400 hover:text-indigo-300">
                  Live Demo
                </Link>
                <Link href="/github" className="text-sm text-indigo-400 hover:text-indigo-300">
                  GitHub
                </Link>
              </div>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/features" className="hover:text-white">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
                <li><Link href="/demo" className="hover:text-white">Demo</Link></li>
                <li><Link href="/api" className="hover:text-white">API</Link></li>
                <li><Link href="/mobile-sdk" className="hover:text-white">Mobile SDK</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/about" className="hover:text-white">About</Link></li>
                <li><Link href="/blog" className="hover:text-white">Blog</Link></li>
                <li><Link href="/careers" className="hover:text-white">Careers</Link></li>
                <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
                <li><Link href="/partners" className="hover:text-white">Partners</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/docs" className="hover:text-white">Documentation</Link></li>
                <li><Link href="/help" className="hover:text-white">Help Center</Link></li>
                <li><Link href="/status" className="hover:text-white">System Status</Link></li>
                <li><Link href="/security" className="hover:text-white">Security</Link></li>
                <li><Link href="/discord" className="hover:text-white">Discord Community</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-sm text-center">
            <p>&copy; 2024 Review Insights. All rights reserved. Made with 🤖 by AI enthusiasts.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}