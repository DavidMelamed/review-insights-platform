import Stripe from 'stripe';
import { prisma } from '../database';
import { PlanType, User } from '@prisma/client';
import { logger } from '../utils/logger';

export interface PricingPlan {
  id: PlanType;
  name: string;
  price: number;
  priceId: string;
  credits: number;
  features: string[];
}

export class StripeService {
  private stripe: Stripe;
  
  private readonly plans: PricingPlan[] = [
    {
      id: PlanType.FREE,
      name: 'Free',
      price: 0,
      priceId: '',
      credits: 10,
      features: [
        '10 review analyses per month',
        '1 brand report',
        'Basic sentiment analysis',
        'CSV export',
      ],
    },
    {
      id: PlanType.STARTER,
      name: 'Starter',
      price: 49,
      priceId: process.env.STRIPE_STARTER_PRICE_ID || '',
      credits: 100,
      features: [
        '100 review analyses per month',
        '10 brand reports',
        'Advanced sentiment analysis',
        'Competitor tracking',
        'CSV & PDF export',
        'Email support',
      ],
    },
    {
      id: PlanType.PROFESSIONAL,
      name: 'Professional',
      price: 199,
      priceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID || '',
      credits: 500,
      features: [
        '500 review analyses per month',
        'Unlimited brand reports',
        'AI-powered insights',
        'Custom branding',
        'API access',
        'Priority support',
        'LLM prompt generation',
      ],
    },
    {
      id: PlanType.ENTERPRISE,
      name: 'Enterprise',
      price: 999,
      priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || '',
      credits: -1, // Unlimited
      features: [
        'Unlimited review analyses',
        'Unlimited reports',
        'White-label options',
        'Dedicated account manager',
        'Custom integrations',
        'SLA guarantee',
        'Training & onboarding',
      ],
    },
  ];

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2023-10-16',
    });
  }

  getPlans(): PricingPlan[] {
    return this.plans;
  }

  getPlan(planId: PlanType): PricingPlan | undefined {
    return this.plans.find(p => p.id === planId);
  }

  async createCustomer(user: User): Promise<string> {
    const customer = await this.stripe.customers.create({
      email: user.email,
      name: user.name || undefined,
      metadata: {
        userId: user.id,
      },
    });

    return customer.id;
  }

  async createCheckoutSession(
    userId: string,
    planId: PlanType,
    successUrl: string,
    cancelUrl: string
  ): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const plan = this.getPlan(planId);
    if (!plan || !plan.priceId) {
      throw new Error('Invalid plan');
    }

    // Create or get Stripe customer
    let customerId = user.subscription?.stripeCustomerId;
    if (!customerId) {
      customerId = await this.createCustomer(user);
    }

    // Create checkout session
    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: user.id,
        planId: plan.id,
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
    });

    return session.url || '';
  }

  async createBillingPortalSession(userId: string, returnUrl: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user?.subscription?.stripeCustomerId) {
      throw new Error('No subscription found');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.subscription.stripeCustomerId,
      return_url: returnUrl,
    });

    return session.url;
  }

  async handleWebhook(
    payload: string | Buffer,
    signature: string
  ): Promise<void> {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );
    } catch (err) {
      logger.error('Webhook signature verification failed', err);
      throw new Error('Invalid webhook signature');
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        logger.info(`Unhandled webhook event type: ${event.type}`);
    }
  }

  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId as PlanType;

    if (!userId || !planId) {
      logger.error('Missing metadata in checkout session', session);
      return;
    }

    const subscription = await this.stripe.subscriptions.retrieve(
      session.subscription as string
    );

    await prisma.subscription.upsert({
      where: { userId },
      update: {
        stripePriceId: subscription.items.data[0].price.id,
        stripeStatus: subscription.status,
        plan: planId,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
      create: {
        userId,
        stripeCustomerId: session.customer as string,
        stripePriceId: subscription.items.data[0].price.id,
        stripeStatus: subscription.status,
        plan: planId,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });

    // Grant initial credits
    const plan = this.getPlan(planId);
    if (plan && plan.credits > 0) {
      await prisma.usageRecord.create({
        data: {
          userId,
          action: 'subscription_credits',
          credits: plan.credits,
          metadata: { planId },
        },
      });
    }
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const dbSubscription = await prisma.subscription.findUnique({
      where: { stripeCustomerId: subscription.customer as string },
    });

    if (!dbSubscription) {
      logger.error('Subscription not found for customer', subscription.customer);
      return;
    }

    const newPlan = this.plans.find(p => p.priceId === subscription.items.data[0].price.id);

    await prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: {
        stripePriceId: subscription.items.data[0].price.id,
        stripeStatus: subscription.status,
        plan: newPlan?.id || dbSubscription.plan,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    await prisma.subscription.update({
      where: { stripeCustomerId: subscription.customer as string },
      data: {
        stripeStatus: 'canceled',
        plan: PlanType.FREE,
      },
    });
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { stripeCustomerId: invoice.customer as string },
    });

    if (!subscription) {
      return;
    }

    // Send payment failed email
    const user = await prisma.user.findUnique({
      where: { id: subscription.userId },
    });

    if (user) {
      logger.info(`Payment failed for user ${user.email}`);
      // Send email notification
    }
  }

  async checkCredits(userId: string, required: number = 1): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) return false;

    // Enterprise has unlimited credits
    if (user.subscription?.plan === PlanType.ENTERPRISE) {
      return true;
    }

    // Calculate remaining credits
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const usedCredits = await prisma.usageRecord.aggregate({
      where: {
        userId,
        createdAt: { gte: currentMonth },
        credits: { lt: 0 }, // Only count debits
      },
      _sum: { credits: true },
    });

    const plan = this.getPlan(user.subscription?.plan || PlanType.FREE);
    const totalCredits = plan?.credits || 10;
    const used = Math.abs(usedCredits._sum.credits || 0);

    return (totalCredits - used) >= required;
  }

  async deductCredits(userId: string, amount: number, action: string): Promise<void> {
    const hasCredits = await this.checkCredits(userId, amount);
    if (!hasCredits) {
      throw new Error('Insufficient credits');
    }

    await prisma.usageRecord.create({
      data: {
        userId,
        action,
        credits: -amount,
        metadata: { timestamp: new Date() },
      },
    });
  }
}