import { prisma } from '../database';
import { logger } from '../utils/logger';
import { uploadFile } from '../utils/storage';
import sharp from 'sharp';

export interface WhiteLabelConfig {
  id: string;
  userId: string;
  domain?: string;
  branding: BrandingConfig;
  emailTemplates?: EmailTemplateConfig;
  features: FeatureConfig;
  customization: CustomizationConfig;
  analytics?: AnalyticsConfig;
  isActive: boolean;
}

export interface BrandingConfig {
  companyName: string;
  logo: {
    light: string; // URL
    dark: string; // URL
    favicon: string; // URL
  };
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    success: string;
    warning: string;
    error: string;
    text: {
      primary: string;
      secondary: string;
      inverse: string;
    };
    background: {
      primary: string;
      secondary: string;
      elevated: string;
    };
  };
  fonts: {
    heading: string;
    body: string;
    mono: string;
    importUrls?: string[]; // Google Fonts, etc.
  };
  customCSS?: string;
}

export interface EmailTemplateConfig {
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  footer?: string;
  templates: {
    welcome?: string;
    reportReady?: string;
    alertNotification?: string;
    passwordReset?: string;
  };
  styling: {
    headerColor: string;
    buttonColor: string;
    fontFamily: string;
  };
}

export interface FeatureConfig {
  hideReviewInsightsBranding: boolean;
  customDashboard: boolean;
  customReports: boolean;
  apiWhiteLabeling: boolean;
  customDomain: boolean;
  ssoIntegration: boolean;
  customAnalytics: boolean;
  removeWatermarks: boolean;
}

export interface CustomizationConfig {
  loginPage: {
    headline?: string;
    subheadline?: string;
    backgroundImage?: string;
    customContent?: string;
  };
  dashboard: {
    welcomeMessage?: string;
    defaultView?: 'analytics' | 'reviews' | 'reports' | 'custom';
    customWidgets?: CustomWidget[];
  };
  navigation: {
    customLinks?: NavLink[];
    hideItems?: string[];
    reorderItems?: string[];
  };
  terminology?: Record<string, string>; // Custom terminology
}

export interface CustomWidget {
  id: string;
  type: 'chart' | 'metric' | 'list' | 'custom';
  title: string;
  config: any;
  position: { x: number; y: number; w: number; h: number };
}

export interface NavLink {
  label: string;
  url: string;
  icon?: string;
  target?: '_blank' | '_self';
}

export interface AnalyticsConfig {
  googleAnalyticsId?: string;
  mixpanelToken?: string;
  segmentWriteKey?: string;
  customScript?: string;
}

export class WhiteLabelService {
  async createWhiteLabelConfig(
    userId: string,
    config: Partial<WhiteLabelConfig>
  ): Promise<WhiteLabelConfig> {
    try {
      // Verify user has enterprise plan
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { subscription: true },
      });

      if (!user?.subscription || user.subscription.plan !== 'ENTERPRISE') {
        throw new Error('White label features require Enterprise plan');
      }

      // Process and optimize logos
      if (config.branding?.logo) {
        config.branding.logo = await this.processLogos(config.branding.logo);
      }

      // Validate custom domain if provided
      if (config.domain) {
        await this.validateCustomDomain(config.domain);
      }

      // Create configuration
      const whiteLabelConfig: WhiteLabelConfig = {
        id: `wl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        domain: config.domain,
        branding: config.branding || this.getDefaultBranding(),
        emailTemplates: config.emailTemplates,
        features: config.features || this.getDefaultFeatures(),
        customization: config.customization || this.getDefaultCustomization(),
        analytics: config.analytics,
        isActive: false, // Requires activation after setup
      };

      // Store in database
      await this.saveConfig(whiteLabelConfig);

      // Generate custom CSS
      await this.generateCustomCSS(whiteLabelConfig);

      // Set up custom domain if provided
      if (config.domain) {
        await this.setupCustomDomain(config.domain, whiteLabelConfig.id);
      }

      return whiteLabelConfig;
    } catch (error) {
      logger.error('Failed to create white label config', { error, userId });
      throw error;
    }
  }

  async updateWhiteLabelConfig(
    configId: string,
    updates: Partial<WhiteLabelConfig>
  ): Promise<WhiteLabelConfig> {
    try {
      const existingConfig = await this.getConfig(configId);
      if (!existingConfig) {
        throw new Error('White label configuration not found');
      }

      // Merge updates
      const updatedConfig = {
        ...existingConfig,
        ...updates,
        branding: { ...existingConfig.branding, ...updates.branding },
        features: { ...existingConfig.features, ...updates.features },
        customization: { ...existingConfig.customization, ...updates.customization },
      };

      // Regenerate CSS if branding changed
      if (updates.branding) {
        await this.generateCustomCSS(updatedConfig);
      }

      // Update domain if changed
      if (updates.domain && updates.domain !== existingConfig.domain) {
        await this.updateCustomDomain(existingConfig.domain, updates.domain, configId);
      }

      await this.saveConfig(updatedConfig);

      return updatedConfig;
    } catch (error) {
      logger.error('Failed to update white label config', { error, configId });
      throw error;
    }
  }

  async activateWhiteLabel(configId: string): Promise<void> {
    try {
      const config = await this.getConfig(configId);
      if (!config) {
        throw new Error('White label configuration not found');
      }

      // Validate configuration is complete
      this.validateConfiguration(config);

      // Deploy custom domain SSL if needed
      if (config.domain) {
        await this.deploySSL(config.domain);
      }

      // Activate configuration
      config.isActive = true;
      await this.saveConfig(config);

      // Clear caches
      await this.clearCaches(config.userId);

      logger.info('White label configuration activated', { configId });
    } catch (error) {
      logger.error('Failed to activate white label', { error, configId });
      throw error;
    }
  }

  private async processLogos(logos: any): Promise<any> {
    const processed: any = {};

    // Process light logo
    if (logos.light) {
      const lightBuffer = await this.downloadImage(logos.light);
      const optimized = await sharp(lightBuffer)
        .resize(200, 60, { fit: 'inside', withoutEnlargement: true })
        .png({ quality: 90 })
        .toBuffer();
      
      processed.light = await uploadFile(optimized, 'logo-light.png');
    }

    // Process dark logo
    if (logos.dark) {
      const darkBuffer = await this.downloadImage(logos.dark);
      const optimized = await sharp(darkBuffer)
        .resize(200, 60, { fit: 'inside', withoutEnlargement: true })
        .png({ quality: 90 })
        .toBuffer();
      
      processed.dark = await uploadFile(optimized, 'logo-dark.png');
    }

    // Process favicon
    if (logos.favicon) {
      const faviconBuffer = await this.downloadImage(logos.favicon);
      
      // Generate multiple favicon sizes
      const sizes = [16, 32, 48, 64, 128, 256];
      const favicons = await Promise.all(
        sizes.map(async (size) => {
          const resized = await sharp(faviconBuffer)
            .resize(size, size)
            .png()
            .toBuffer();
          return uploadFile(resized, `favicon-${size}x${size}.png`);
        })
      );

      processed.favicon = favicons[2]; // Use 48x48 as default
      processed.faviconSet = favicons;
    }

    return processed;
  }

  private async generateCustomCSS(config: WhiteLabelConfig): Promise<string> {
    const { colors, fonts } = config.branding;
    
    let css = `
/* White Label Custom Styles */
:root {
  /* Colors */
  --color-primary: ${colors.primary};
  --color-secondary: ${colors.secondary};
  --color-accent: ${colors.accent};
  --color-success: ${colors.success};
  --color-warning: ${colors.warning};
  --color-error: ${colors.error};
  
  /* Text Colors */
  --color-text-primary: ${colors.text.primary};
  --color-text-secondary: ${colors.text.secondary};
  --color-text-inverse: ${colors.text.inverse};
  
  /* Background Colors */
  --color-bg-primary: ${colors.background.primary};
  --color-bg-secondary: ${colors.background.secondary};
  --color-bg-elevated: ${colors.background.elevated};
  
  /* Fonts */
  --font-heading: ${fonts.heading}, sans-serif;
  --font-body: ${fonts.body}, sans-serif;
  --font-mono: ${fonts.mono}, monospace;
}

/* Apply fonts */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
}

body {
  font-family: var(--font-body);
  color: var(--color-text-primary);
  background-color: var(--color-bg-primary);
}

/* Primary buttons */
.btn-primary {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
}

.btn-primary:hover {
  background-color: color-mix(in srgb, var(--color-primary) 85%, black);
}

/* Links */
a {
  color: var(--color-primary);
}

a:hover {
  color: var(--color-secondary);
}

/* Navigation */
nav {
  background-color: var(--color-bg-elevated);
}

/* Cards */
.card {
  background-color: var(--color-bg-elevated);
  border-color: color-mix(in srgb, var(--color-bg-secondary) 50%, transparent);
}
`;

    // Add custom CSS if provided
    if (config.branding.customCSS) {
      css += '\n\n/* User Custom CSS */\n' + config.branding.customCSS;
    }

    // Save CSS file
    const cssBuffer = Buffer.from(css, 'utf-8');
    const cssUrl = await uploadFile(cssBuffer, `custom-${config.id}.css`);
    
    return cssUrl;
  }

  private async setupCustomDomain(domain: string, configId: string): Promise<void> {
    // In production, this would:
    // 1. Add DNS records
    // 2. Configure reverse proxy
    // 3. Set up SSL certificate
    // 4. Update routing rules

    logger.info('Setting up custom domain', { domain, configId });

    // Simulate DNS verification
    const dnsRecords = {
      CNAME: {
        type: 'CNAME',
        name: domain,
        value: 'whitelabel.reviewinsights.ai',
      },
      TXT: {
        type: 'TXT',
        name: `_reviewinsights.${domain}`,
        value: `verify=${configId}`,
      },
    };

    // Store DNS configuration
    await this.saveDNSConfig(domain, dnsRecords);
  }

  private async validateCustomDomain(domain: string): Promise<void> {
    // Validate domain format
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
    if (!domainRegex.test(domain)) {
      throw new Error('Invalid domain format');
    }

    // Check if domain is already in use
    const existingConfig = await this.getConfigByDomain(domain);
    if (existingConfig) {
      throw new Error('Domain is already in use');
    }

    // In production, would also:
    // - Check DNS ownership
    // - Verify SSL certificate availability
    // - Test domain connectivity
  }

  private async deploySSL(domain: string): Promise<void> {
    // In production, would use Let's Encrypt or similar
    logger.info('Deploying SSL certificate', { domain });
  }

  private validateConfiguration(config: WhiteLabelConfig): void {
    // Validate required fields
    if (!config.branding.companyName) {
      throw new Error('Company name is required');
    }

    if (!config.branding.logo.light) {
      throw new Error('Logo is required');
    }

    // Validate colors are valid hex
    const hexRegex = /^#[0-9A-F]{6}$/i;
    Object.values(config.branding.colors).forEach(color => {
      if (typeof color === 'string' && !hexRegex.test(color)) {
        throw new Error(`Invalid color format: ${color}`);
      }
    });
  }

  private getDefaultBranding(): BrandingConfig {
    return {
      companyName: '',
      logo: {
        light: '',
        dark: '',
        favicon: '',
      },
      colors: {
        primary: '#4F46E5',
        secondary: '#7C3AED',
        accent: '#F59E0B',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        text: {
          primary: '#1F2937',
          secondary: '#6B7280',
          inverse: '#FFFFFF',
        },
        background: {
          primary: '#FFFFFF',
          secondary: '#F9FAFB',
          elevated: '#FFFFFF',
        },
      },
      fonts: {
        heading: 'Inter',
        body: 'Inter',
        mono: 'JetBrains Mono',
      },
    };
  }

  private getDefaultFeatures(): FeatureConfig {
    return {
      hideReviewInsightsBranding: true,
      customDashboard: true,
      customReports: true,
      apiWhiteLabeling: true,
      customDomain: true,
      ssoIntegration: true,
      customAnalytics: true,
      removeWatermarks: true,
    };
  }

  private getDefaultCustomization(): CustomizationConfig {
    return {
      loginPage: {},
      dashboard: {},
      navigation: {},
    };
  }

  // Helper methods for data persistence
  private async saveConfig(config: WhiteLabelConfig): Promise<void> {
    // In production, save to database
    await prisma.usageRecord.create({
      data: {
        userId: config.userId,
        action: 'white_label_config',
        credits: 0,
        metadata: config as any,
      },
    });
  }

  private async getConfig(configId: string): Promise<WhiteLabelConfig | null> {
    // In production, fetch from database
    return null;
  }

  private async getConfigByDomain(domain: string): Promise<WhiteLabelConfig | null> {
    // In production, fetch from database
    return null;
  }

  private async saveDNSConfig(domain: string, records: any): Promise<void> {
    // In production, save to database
    logger.info('DNS configuration saved', { domain, records });
  }

  private async updateCustomDomain(
    oldDomain: string | undefined,
    newDomain: string,
    configId: string
  ): Promise<void> {
    if (oldDomain) {
      // Remove old domain configuration
      await this.removeDomain(oldDomain);
    }

    await this.setupCustomDomain(newDomain, configId);
  }

  private async removeDomain(domain: string): Promise<void> {
    // In production, remove DNS records and SSL
    logger.info('Removing domain configuration', { domain });
  }

  private async clearCaches(userId: string): Promise<void> {
    // Clear CDN caches, Redis caches, etc.
    logger.info('Clearing caches for white label activation', { userId });
  }

  private async downloadImage(url: string): Promise<Buffer> {
    // Download image from URL
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // Public API methods
  async getActiveWhiteLabelForDomain(domain: string): Promise<WhiteLabelConfig | null> {
    const config = await this.getConfigByDomain(domain);
    return config?.isActive ? config : null;
  }

  async getWhiteLabelAssets(configId: string): Promise<any> {
    const config = await this.getConfig(configId);
    if (!config) return null;

    return {
      css: `/assets/whitelabel/${configId}/custom.css`,
      logos: config.branding.logo,
      favicon: config.branding.logo.favicon,
      colors: config.branding.colors,
      fonts: config.branding.fonts,
    };
  }
}