import axios from 'axios';

interface GooglePlaceInfo {
  name: string;
  rating: number;
  user_ratings_total: number;
  place_id: string;
  formatted_address: string;
  website?: string;
  types: string[];
}

interface SocialProfile {
  platform: string;
  url: string;
  followers?: number;
  rating?: number;
}

export interface DiscoveredBusinessInfo {
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
    instagram?: string;
    twitter?: string;
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
  description?: string;
  keywords?: string[];
  contactInfo?: {
    email?: string;
    phone?: string;
  };
}

export class BusinessDiscoveryService {
  private cache = new Map<string, DiscoveredBusinessInfo>();

  async discover(identifier: string): Promise<DiscoveredBusinessInfo> {
    // Check cache first
    if (this.cache.has(identifier)) {
      return this.cache.get(identifier)!;
    }

    let discoveredInfo: DiscoveredBusinessInfo;

    // Determine identifier type
    if (this.isEmail(identifier)) {
      discoveredInfo = await this.discoverFromEmail(identifier);
    } else if (this.isWebsite(identifier)) {
      discoveredInfo = await this.discoverFromWebsite(identifier);
    } else {
      discoveredInfo = await this.discoverFromBusinessName(identifier);
    }

    // Enrich with additional data
    discoveredInfo = await this.enrichBusinessInfo(discoveredInfo);

    // Cache the result
    this.cache.set(identifier, discoveredInfo);

    return discoveredInfo;
  }

  private isEmail(identifier: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
  }

  private isWebsite(identifier: string): boolean {
    return /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/.test(identifier);
  }

  private async discoverFromEmail(email: string): Promise<DiscoveredBusinessInfo> {
    const domain = email.split('@')[1];
    const cleanDomain = domain.replace(/^(www\.)?/, '').replace(/\.(com|net|org|io|co)$/, '');
    
    // Predict business name from domain
    const businessName = cleanDomain
      .split(/[-_.]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return {
      businessName,
      website: `https://${domain}`,
      contactInfo: { email },
    };
  }

  private async discoverFromWebsite(website: string): Promise<DiscoveredBusinessInfo> {
    const cleanUrl = website.replace(/^https?:\/\//, '').replace(/^www\./, '');
    const domain = cleanUrl.split('/')[0];
    
    try {
      // In production, this would scrape the website
      const response = await axios.post('/api/discovery/website', { url: website });
      
      return {
        businessName: response.data.businessName || this.predictBusinessNameFromDomain(domain),
        website: website.startsWith('http') ? website : `https://${website}`,
        industry: response.data.industry,
        description: response.data.description,
        logo: response.data.logo,
        brandColors: response.data.colors,
        contactInfo: response.data.contact,
      };
    } catch (error) {
      // Fallback to domain-based prediction
      return {
        businessName: this.predictBusinessNameFromDomain(domain),
        website: website.startsWith('http') ? website : `https://${website}`,
      };
    }
  }

  private async discoverFromBusinessName(businessName: string): Promise<DiscoveredBusinessInfo> {
    try {
      // Search for business across platforms
      const [googleData, socialData] = await Promise.all([
        this.searchGooglePlaces(businessName),
        this.searchSocialPlatforms(businessName),
      ]);

      // Predict industry from business name
      const industry = this.predictIndustry(businessName);
      
      // Predict website from business name
      const predictedWebsite = this.predictWebsite(businessName);

      return {
        businessName: googleData?.name || businessName,
        website: googleData?.website || predictedWebsite,
        industry,
        location: googleData?.formatted_address,
        currentRating: googleData?.rating,
        estimatedReviewVolume: googleData?.user_ratings_total,
        socialProfiles: socialData,
        reviewSources: this.identifyReviewSources(businessName, industry),
      };
    } catch (error) {
      // Basic fallback
      return {
        businessName,
        industry: this.predictIndustry(businessName),
        website: this.predictWebsite(businessName),
      };
    }
  }

  private async enrichBusinessInfo(info: DiscoveredBusinessInfo): Promise<DiscoveredBusinessInfo> {
    // Enrich with competitors
    info.competitorNames = await this.discoverCompetitors(info.businessName, info.industry);
    
    // Predict business size
    info.size = this.predictBusinessSize(info);
    
    // Identify review sources based on industry
    if (!info.reviewSources) {
      info.reviewSources = this.identifyReviewSources(info.businessName, info.industry);
    }

    // Estimate review volume if not available
    if (!info.estimatedReviewVolume) {
      info.estimatedReviewVolume = this.estimateReviewVolume(info);
    }

    // Extract brand colors from logo if available
    if (info.logo && !info.brandColors) {
      info.brandColors = await this.extractBrandColors(info.logo);
    }

    return info;
  }

  private async searchGooglePlaces(businessName: string): Promise<GooglePlaceInfo | null> {
    try {
      const response = await axios.post('/api/discovery/google-places', { query: businessName });
      return response.data.results?.[0] || null;
    } catch (error) {
      return null;
    }
  }

  private async searchSocialPlatforms(businessName: string): Promise<any> {
    const platforms = ['facebook', 'instagram', 'twitter', 'linkedin', 'yelp'];
    const profiles: any = {};

    // In production, this would search each platform
    for (const platform of platforms) {
      const profile = await this.searchPlatform(platform, businessName);
      if (profile) {
        profiles[platform] = profile;
      }
    }

    return profiles;
  }

  private async searchPlatform(platform: string, businessName: string): Promise<string | null> {
    // Simplified - in production would use platform APIs
    const cleanName = businessName.toLowerCase().replace(/\s+/g, '');
    
    switch (platform) {
      case 'facebook':
        return `https://facebook.com/${cleanName}`;
      case 'instagram':
        return `https://instagram.com/${cleanName}`;
      case 'twitter':
        return `https://twitter.com/${cleanName}`;
      case 'linkedin':
        return `https://linkedin.com/company/${cleanName}`;
      case 'yelp':
        return `https://yelp.com/biz/${cleanName}`;
      default:
        return null;
    }
  }

  private predictIndustry(businessName: string): string {
    const name = businessName.toLowerCase();
    
    // Industry keywords mapping
    const industryPatterns: [RegExp, string][] = [
      [/restaurant|cafe|coffee|pizza|burger|sushi|bar|grill|diner|bistro/i, 'Restaurant'],
      [/hotel|motel|inn|resort|lodge|hostel/i, 'Hospitality'],
      [/clinic|medical|doctor|dental|health|hospital|pharmacy/i, 'Healthcare'],
      [/salon|spa|beauty|hair|nail|barber/i, 'Beauty & Wellness'],
      [/gym|fitness|yoga|pilates|crossfit/i, 'Fitness'],
      [/store|shop|mart|retail|boutique/i, 'Retail'],
      [/tech|software|app|digital|cyber|data|cloud/i, 'Technology'],
      [/law|legal|attorney|lawyer/i, 'Legal Services'],
      [/real estate|realty|property|homes/i, 'Real Estate'],
      [/auto|car|vehicle|motor|tire|mechanic/i, 'Automotive'],
      [/plumb|electric|hvac|repair|handyman|contractor/i, 'Home Services'],
      [/school|academy|institute|university|college|education/i, 'Education'],
      [/bank|financial|insurance|mortgage|loan|credit/i, 'Financial Services'],
    ];

    for (const [pattern, industry] of industryPatterns) {
      if (pattern.test(name)) {
        return industry;
      }
    }

    return 'General Business';
  }

  private predictWebsite(businessName: string): string {
    const cleanName = businessName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/\s+/g, '');
    
    return `https://www.${cleanName}.com`;
  }

  private predictBusinessNameFromDomain(domain: string): string {
    const cleanDomain = domain.replace(/\.(com|net|org|io|co)$/, '');
    return cleanDomain
      .split(/[-_.]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private async discoverCompetitors(businessName: string, industry?: string): Promise<string[]> {
    // In production, this would use search APIs and competitor analysis
    const industryCompetitors: Record<string, string[]> = {
      'Restaurant': ['Chipotle', 'Panera Bread', 'Subway', 'Local Competitors'],
      'E-commerce': ['Amazon', 'eBay', 'Etsy', 'Shopify Stores'],
      'SaaS': ['Salesforce', 'HubSpot', 'Zendesk', 'Industry Leaders'],
      'Hotel': ['Marriott', 'Hilton', 'Airbnb', 'Local Hotels'],
      'Retail': ['Target', 'Walmart', 'Local Stores', 'Online Retailers'],
    };

    return industryCompetitors[industry || 'General Business'] || ['Industry Leaders'];
  }

  private predictBusinessSize(info: DiscoveredBusinessInfo): 'small' | 'medium' | 'large' | 'enterprise' {
    // Use various signals to predict size
    if (info.estimatedReviewVolume) {
      if (info.estimatedReviewVolume > 10000) return 'enterprise';
      if (info.estimatedReviewVolume > 1000) return 'large';
      if (info.estimatedReviewVolume > 100) return 'medium';
    }

    // Industry-based defaults
    const enterpriseKeywords = /corporation|corp|inc|group|global|international/i;
    if (enterpriseKeywords.test(info.businessName)) {
      return 'enterprise';
    }

    return 'small';
  }

  private identifyReviewSources(businessName: string, industry?: string): string[] {
    const commonSources = ['google', 'facebook'];
    
    const industrySpecificSources: Record<string, string[]> = {
      'Restaurant': ['yelp', 'tripadvisor', 'opentable', 'doordash'],
      'Hotel': ['tripadvisor', 'booking', 'expedia', 'hotels.com'],
      'E-commerce': ['amazon', 'trustpilot', 'sitejabber'],
      'SaaS': ['g2', 'capterra', 'trustradius', 'getapp'],
      'Healthcare': ['healthgrades', 'vitals', 'zocdoc'],
      'Automotive': ['cars.com', 'dealerrater', 'edmunds'],
      'Home Services': ['angi', 'homeadvisor', 'thumbtack'],
    };

    const specificSources = industrySpecificSources[industry || ''] || ['yelp'];
    
    return [...commonSources, ...specificSources];
  }

  private estimateReviewVolume(info: DiscoveredBusinessInfo): number {
    // Estimate based on business size and industry
    const sizeMultipliers = {
      small: 50,
      medium: 500,
      large: 2000,
      enterprise: 10000,
    };

    const industryMultipliers: Record<string, number> = {
      'Restaurant': 2.0,
      'Hotel': 1.5,
      'E-commerce': 3.0,
      'Healthcare': 0.8,
      'SaaS': 0.5,
    };

    const base = sizeMultipliers[info.size || 'small'];
    const multiplier = industryMultipliers[info.industry || 'General'] || 1.0;

    return Math.round(base * multiplier);
  }

  private async extractBrandColors(logoUrl: string): Promise<{ primary: string; secondary: string }> {
    // In production, this would use color extraction API
    // For now, return sensible defaults based on industry
    const industryColors: Record<string, { primary: string; secondary: string }> = {
      'Restaurant': { primary: '#DC2626', secondary: '#FCA5A5' },
      'Healthcare': { primary: '#0891B2', secondary: '#67E8F9' },
      'Technology': { primary: '#4F46E5', secondary: '#818CF8' },
      'Finance': { primary: '#059669', secondary: '#34D399' },
      'Retail': { primary: '#7C3AED', secondary: '#C4B5FD' },
    };

    return industryColors['Technology']; // Default
  }
}