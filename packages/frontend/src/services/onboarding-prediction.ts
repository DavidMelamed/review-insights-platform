import { DiscoveredBusinessInfo } from './business-discovery';

export interface PredictedNeeds {
  recommendedPlan: 'starter' | 'growth' | 'scale' | 'enterprise';
  suggestedFeatures: string[];
  reportFrequency: 'daily' | 'weekly' | 'monthly';
  alertPreferences: {
    negativeReviews: boolean;
    competitorMentions: boolean;
    volumeSpikes: boolean;
    responseTime: 'immediate' | '1hour' | 'daily';
    crisisDetection: boolean;
  };
  integrations: string[];
  teamSize: number;
  reviewResponseStrategy: 'all' | 'negative_only' | 'ai_suggested';
  competitorTracking: boolean;
  industryBenchmarking: boolean;
  whiteLabel: boolean;
  apiAccess: boolean;
  customReports: boolean;
  prioritySupport: boolean;
}

export class OnboardingPredictionService {
  predictNeeds(businessInfo: DiscoveredBusinessInfo): PredictedNeeds {
    // Base predictions on business characteristics
    const size = businessInfo.size || 'small';
    const industry = businessInfo.industry || 'General Business';
    const reviewVolume = businessInfo.estimatedReviewVolume || 100;
    const hasMultipleLocations = this.detectMultipleLocations(businessInfo);
    const isHighRisk = this.isHighRiskIndustry(industry);
    const needsCompliance = this.needsComplianceFeatures(industry);

    // Predict plan based on size and volume
    const recommendedPlan = this.predictPlan(size, reviewVolume, hasMultipleLocations);
    
    // Predict features needed
    const suggestedFeatures = this.predictFeatures(industry, size, reviewVolume);
    
    // Predict report frequency
    const reportFrequency = this.predictReportFrequency(industry, reviewVolume);
    
    // Predict alert preferences
    const alertPreferences = this.predictAlertPreferences(industry, size, isHighRisk);
    
    // Predict integrations
    const integrations = this.predictIntegrations(industry, size);
    
    // Predict team size
    const teamSize = this.predictTeamSize(size, hasMultipleLocations);
    
    // Predict response strategy
    const reviewResponseStrategy = this.predictResponseStrategy(reviewVolume, size);
    
    // Additional predictions
    const competitorTracking = size !== 'small' || industry === 'Restaurant';
    const industryBenchmarking = size === 'large' || size === 'enterprise';
    const whiteLabel = size === 'enterprise' || industry === 'Agency';
    const apiAccess = size !== 'small' || industry === 'Technology';
    const customReports = size === 'large' || size === 'enterprise';
    const prioritySupport = recommendedPlan === 'scale' || recommendedPlan === 'enterprise';

    return {
      recommendedPlan,
      suggestedFeatures,
      reportFrequency,
      alertPreferences,
      integrations,
      teamSize,
      reviewResponseStrategy,
      competitorTracking,
      industryBenchmarking,
      whiteLabel,
      apiAccess,
      customReports,
      prioritySupport,
    };
  }

  private predictPlan(
    size: string, 
    reviewVolume: number, 
    hasMultipleLocations: boolean
  ): 'starter' | 'growth' | 'scale' | 'enterprise' {
    if (size === 'enterprise' || hasMultipleLocations) {
      return 'enterprise';
    }
    
    if (size === 'large' || reviewVolume > 2000) {
      return 'scale';
    }
    
    if (size === 'medium' || reviewVolume > 500) {
      return 'growth';
    }
    
    return 'starter';
  }

  private predictFeatures(industry: string, size: string, reviewVolume: number): string[] {
    const features: string[] = ['sentiment_analysis', 'competitor_tracking'];
    
    // Industry-specific features
    const industryFeatures: Record<string, string[]> = {
      'Restaurant': ['menu_feedback', 'service_quality', 'food_trends'],
      'Hotel': ['room_feedback', 'amenity_analysis', 'booking_insights'],
      'E-commerce': ['product_sentiment', 'shipping_feedback', 'return_analysis'],
      'Healthcare': ['patient_satisfaction', 'appointment_feedback', 'staff_analysis'],
      'SaaS': ['feature_requests', 'bug_reports', 'churn_prediction'],
      'Retail': ['product_availability', 'store_experience', 'staff_feedback'],
    };
    
    if (industryFeatures[industry]) {
      features.push(...industryFeatures[industry]);
    }
    
    // Size-based features
    if (size === 'medium' || size === 'large' || size === 'enterprise') {
      features.push('team_collaboration', 'custom_reports', 'api_access');
    }
    
    if (size === 'large' || size === 'enterprise') {
      features.push('white_label', 'sso', 'audit_logs', 'role_based_access');
    }
    
    // Volume-based features
    if (reviewVolume > 1000) {
      features.push('bulk_responses', 'automated_workflows', 'advanced_analytics');
    }
    
    return features;
  }

  private predictReportFrequency(industry: string, reviewVolume: number): 'daily' | 'weekly' | 'monthly' {
    // High-velocity industries need more frequent reports
    const dailyIndustries = ['Restaurant', 'Hotel', 'E-commerce'];
    if (dailyIndustries.includes(industry) && reviewVolume > 500) {
      return 'daily';
    }
    
    // Most businesses benefit from weekly reports
    if (reviewVolume > 100) {
      return 'weekly';
    }
    
    // Low-volume businesses can use monthly
    return 'monthly';
  }

  private predictAlertPreferences(industry: string, size: string, isHighRisk: boolean): any {
    const basePreferences = {
      negativeReviews: true, // Everyone needs this
      competitorMentions: size !== 'small',
      volumeSpikes: true,
      responseTime: 'immediate' as const,
      crisisDetection: isHighRisk,
    };
    
    // Industry-specific adjustments
    if (industry === 'Healthcare' || industry === 'Financial Services') {
      basePreferences.responseTime = 'immediate';
      basePreferences.crisisDetection = true;
    }
    
    if (industry === 'E-commerce' || industry === 'SaaS') {
      basePreferences.responseTime = '1hour' as const;
    }
    
    // Size adjustments
    if (size === 'small') {
      basePreferences.responseTime = 'daily' as const;
      basePreferences.volumeSpikes = false;
    }
    
    return basePreferences;
  }

  private predictIntegrations(industry: string, size: string): string[] {
    const integrations: string[] = ['email'];
    
    // Everyone gets Slack if not small
    if (size !== 'small') {
      integrations.push('slack');
    }
    
    // Industry-specific integrations
    const industryIntegrations: Record<string, string[]> = {
      'E-commerce': ['shopify', 'woocommerce', 'magento'],
      'SaaS': ['intercom', 'zendesk', 'hubspot', 'salesforce'],
      'Restaurant': ['opentable', 'resy', 'toast'],
      'Hotel': ['booking.com', 'expedia', 'pms_integration'],
      'Healthcare': ['epic', 'cerner', 'athenahealth'],
      'Retail': ['square', 'clover', 'lightspeed'],
    };
    
    if (industryIntegrations[industry]) {
      integrations.push(...industryIntegrations[industry].slice(0, 2));
    }
    
    // Size-based integrations
    if (size === 'large' || size === 'enterprise') {
      integrations.push('webhook', 'api', 'custom_integration');
    }
    
    return integrations;
  }

  private predictTeamSize(size: string, hasMultipleLocations: boolean): number {
    const baseSizes = {
      small: 1,
      medium: 3,
      large: 10,
      enterprise: 25,
    };
    
    let teamSize = baseSizes[size as keyof typeof baseSizes] || 1;
    
    if (hasMultipleLocations) {
      teamSize = Math.round(teamSize * 1.5);
    }
    
    return teamSize;
  }

  private predictResponseStrategy(reviewVolume: number, size: string): 'all' | 'negative_only' | 'ai_suggested' {
    if (reviewVolume < 50) {
      return 'all'; // Can handle responding to all
    }
    
    if (size === 'small' || reviewVolume < 200) {
      return 'negative_only'; // Focus on damage control
    }
    
    return 'ai_suggested'; // Use AI to prioritize
  }

  private detectMultipleLocations(businessInfo: DiscoveredBusinessInfo): boolean {
    // Look for franchise/chain indicators
    const chainIndicators = /franchise|chain|locations|branches|stores/i;
    return chainIndicators.test(businessInfo.businessName) || 
           chainIndicators.test(businessInfo.description || '');
  }

  private isHighRiskIndustry(industry: string): boolean {
    const highRiskIndustries = [
      'Healthcare',
      'Financial Services',
      'Legal Services',
      'Automotive',
      'Real Estate',
    ];
    
    return highRiskIndustries.includes(industry);
  }

  private needsComplianceFeatures(industry: string): boolean {
    const complianceIndustries = [
      'Healthcare',
      'Financial Services',
      'Legal Services',
      'Education',
    ];
    
    return complianceIndustries.includes(industry);
  }

  // Generate smart defaults for forms
  generateSmartDefaults(businessInfo: DiscoveredBusinessInfo, needs: PredictedNeeds): any {
    return {
      // Account settings
      timezone: this.predictTimezone(businessInfo.location),
      currency: this.predictCurrency(businessInfo.location),
      language: 'en',
      
      // Notification settings
      emailDigest: needs.reportFrequency === 'daily' ? 'daily' : 'weekly',
      alertChannels: needs.integrations.includes('slack') ? ['email', 'slack'] : ['email'],
      
      // Report settings
      reportBranding: {
        useLogo: true,
        useColors: true,
        includeCharts: true,
        includeActionItems: true,
      },
      
      // Response settings
      responseTemplates: this.generateIndustryTemplates(businessInfo.industry),
      autoResponseRules: this.generateAutoResponseRules(needs.reviewResponseStrategy),
      
      // Team settings
      departments: this.predictDepartments(businessInfo.industry, needs.teamSize),
      
      // Integration settings
      autoImport: true,
      syncFrequency: needs.reportFrequency === 'daily' ? 'hourly' : 'daily',
    };
  }

  private predictTimezone(location?: string): string {
    if (!location) return 'America/New_York';
    
    // Simple timezone prediction based on location
    const timezoneMap: Record<string, string> = {
      'CA': 'America/Los_Angeles',
      'NY': 'America/New_York',
      'TX': 'America/Chicago',
      'FL': 'America/New_York',
      'IL': 'America/Chicago',
      'WA': 'America/Los_Angeles',
      'UK': 'Europe/London',
      'AU': 'Australia/Sydney',
    };
    
    for (const [key, timezone] of Object.entries(timezoneMap)) {
      if (location.includes(key)) {
        return timezone;
      }
    }
    
    return 'America/New_York';
  }

  private predictCurrency(location?: string): string {
    if (!location) return 'USD';
    
    if (location.includes('UK')) return 'GBP';
    if (location.includes('EU') || location.includes('Europe')) return 'EUR';
    if (location.includes('Canada')) return 'CAD';
    if (location.includes('Australia')) return 'AUD';
    
    return 'USD';
  }

  private generateIndustryTemplates(industry?: string): any[] {
    const baseTemplates = [
      {
        name: 'Thank You - Positive',
        condition: 'rating >= 4',
        tone: 'friendly',
      },
      {
        name: 'Apology - Negative',
        condition: 'rating <= 2',
        tone: 'apologetic',
      },
    ];
    
    // Add industry-specific templates
    const industryTemplates: Record<string, any[]> = {
      'Restaurant': [
        { name: 'Food Quality Issue', condition: 'keywords:food,taste,cold', tone: 'apologetic' },
        { name: 'Service Complaint', condition: 'keywords:service,wait,staff', tone: 'empathetic' },
      ],
      'E-commerce': [
        { name: 'Shipping Delay', condition: 'keywords:shipping,delivery,late', tone: 'apologetic' },
        { name: 'Product Issue', condition: 'keywords:broken,damaged,wrong', tone: 'helpful' },
      ],
      'Healthcare': [
        { name: 'Wait Time', condition: 'keywords:wait,appointment,delay', tone: 'empathetic' },
        { name: 'Staff Feedback', condition: 'keywords:doctor,nurse,staff', tone: 'professional' },
      ],
    };
    
    if (industry && industryTemplates[industry]) {
      return [...baseTemplates, ...industryTemplates[industry]];
    }
    
    return baseTemplates;
  }

  private generateAutoResponseRules(strategy: string): any[] {
    switch (strategy) {
      case 'all':
        return [
          { condition: 'any', action: 'suggest_response', autoSend: false },
        ];
      
      case 'negative_only':
        return [
          { condition: 'rating <= 3', action: 'suggest_response', autoSend: false },
          { condition: 'rating >= 4', action: 'queue_for_later', autoSend: false },
        ];
      
      case 'ai_suggested':
        return [
          { condition: 'ai_priority = high', action: 'suggest_response', autoSend: false },
          { condition: 'rating = 1', action: 'alert_manager', autoSend: false },
          { condition: 'verified = true AND rating >= 4', action: 'suggest_response', autoSend: true },
        ];
      
      default:
        return [];
    }
  }

  private predictDepartments(industry?: string, teamSize?: number): string[] {
    if (!teamSize || teamSize === 1) {
      return ['General'];
    }
    
    const baseDepartments = ['Management', 'Customer Service'];
    
    const industryDepartments: Record<string, string[]> = {
      'Restaurant': ['Kitchen', 'Front of House', 'Bar'],
      'Hotel': ['Front Desk', 'Housekeeping', 'Concierge', 'Food & Beverage'],
      'E-commerce': ['Fulfillment', 'Product', 'Marketing'],
      'Healthcare': ['Clinical', 'Administration', 'Billing'],
      'SaaS': ['Product', 'Engineering', 'Sales', 'Support'],
      'Retail': ['Sales Floor', 'Inventory', 'Customer Service'],
    };
    
    if (industry && industryDepartments[industry]) {
      return [...baseDepartments, ...industryDepartments[industry].slice(0, teamSize - 2)];
    }
    
    return baseDepartments;
  }
}