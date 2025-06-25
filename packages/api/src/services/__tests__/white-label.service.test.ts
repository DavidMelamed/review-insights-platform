import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { WhiteLabelService } from '../white-label.service';
import { prisma } from '../../database';
import { uploadFile } from '../../utils/storage';

// Mock dependencies
jest.mock('../../database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    usageRecord: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../../utils/storage', () => ({
  uploadFile: jest.fn(),
}));

jest.mock('sharp', () => {
  return jest.fn(() => ({
    resize: jest.fn().mockReturnThis(),
    png: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-image')),
  }));
});

jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock fetch for downloadImage
global.fetch = jest.fn();

describe('WhiteLabelService', () => {
  let service: WhiteLabelService;
  
  beforeEach(() => {
    service = new WhiteLabelService();
    jest.clearAllMocks();
  });

  describe('createWhiteLabelConfig', () => {
    it('should create white label config for enterprise user', async () => {
      const mockUser = {
        id: 'user_123',
        subscription: {
          plan: 'ENTERPRISE',
        },
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (uploadFile as jest.Mock).mockResolvedValue('https://storage.example.com/file');
      (global.fetch as jest.Mock).mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
      });

      const config = await service.createWhiteLabelConfig('user_123', {
        domain: 'custom.example.com',
        branding: {
          companyName: 'Acme Corp',
          logo: {
            light: 'https://example.com/logo-light.png',
            dark: 'https://example.com/logo-dark.png',
            favicon: 'https://example.com/favicon.png',
          },
          colors: {
            primary: '#007bff',
            secondary: '#6c757d',
            accent: '#28a745',
            success: '#28a745',
            warning: '#ffc107',
            error: '#dc3545',
            text: {
              primary: '#212529',
              secondary: '#6c757d',
              inverse: '#ffffff',
            },
            background: {
              primary: '#ffffff',
              secondary: '#f8f9fa',
              elevated: '#ffffff',
            },
          },
          fonts: {
            heading: 'Montserrat',
            body: 'Open Sans',
            mono: 'Fira Code',
          },
        },
        features: {
          hideReviewInsightsBranding: true,
          customDashboard: true,
          customReports: true,
          apiWhiteLabeling: true,
          customDomain: true,
          ssoIntegration: true,
          customAnalytics: true,
          removeWatermarks: true,
        },
      });

      expect(config).toMatchObject({
        userId: 'user_123',
        domain: 'custom.example.com',
        branding: expect.objectContaining({
          companyName: 'Acme Corp',
        }),
        features: expect.objectContaining({
          hideReviewInsightsBranding: true,
        }),
        isActive: false,
      });

      // Verify logos were processed
      expect(uploadFile).toHaveBeenCalledTimes(4); // light, dark, favicon, css
    });

    it('should reject non-enterprise users', async () => {
      const mockUser = {
        id: 'user_123',
        subscription: {
          plan: 'PROFESSIONAL',
        },
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        service.createWhiteLabelConfig('user_123', {})
      ).rejects.toThrow('White label features require Enterprise plan');
    });

    it('should validate domain format', async () => {
      const mockUser = {
        id: 'user_123',
        subscription: {
          plan: 'ENTERPRISE',
        },
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        service.createWhiteLabelConfig('user_123', {
          domain: 'invalid domain!',
        })
      ).rejects.toThrow('Invalid domain format');
    });
  });

  describe('updateWhiteLabelConfig', () => {
    it('should update existing config', async () => {
      const existingConfig = {
        id: 'wl_123',
        userId: 'user_123',
        domain: 'old.example.com',
        branding: {
          companyName: 'Old Corp',
          colors: {
            primary: '#000000',
          },
        },
        features: {
          customDomain: true,
        },
        customization: {},
      };

      // Mock getConfig
      jest.spyOn(service as any, 'getConfig').mockResolvedValue(existingConfig);
      jest.spyOn(service as any, 'saveConfig').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'generateCustomCSS').mockResolvedValue('https://css.url');
      jest.spyOn(service as any, 'updateCustomDomain').mockResolvedValue(undefined);

      const updated = await service.updateWhiteLabelConfig('wl_123', {
        domain: 'new.example.com',
        branding: {
          companyName: 'New Corp',
        },
      });

      expect(updated.branding.companyName).toBe('New Corp');
      expect(updated.domain).toBe('new.example.com');
    });
  });

  describe('activateWhiteLabel', () => {
    it('should activate valid configuration', async () => {
      const config = {
        id: 'wl_123',
        userId: 'user_123',
        domain: 'custom.example.com',
        branding: {
          companyName: 'Test Corp',
          logo: {
            light: 'https://logo.url',
          },
        },
        isActive: false,
      };

      jest.spyOn(service as any, 'getConfig').mockResolvedValue(config);
      jest.spyOn(service as any, 'validateConfiguration').mockReturnValue(undefined);
      jest.spyOn(service as any, 'deploySSL').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'saveConfig').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'clearCaches').mockResolvedValue(undefined);

      await service.activateWhiteLabel('wl_123');

      expect(service['deploySSL']).toHaveBeenCalledWith('custom.example.com');
      expect(service['clearCaches']).toHaveBeenCalledWith('user_123');
    });

    it('should throw error for invalid configuration', async () => {
      const config = {
        id: 'wl_123',
        branding: {
          companyName: '', // Invalid - empty
          logo: {},
        },
      };

      jest.spyOn(service as any, 'getConfig').mockResolvedValue(config);

      await expect(service.activateWhiteLabel('wl_123')).rejects.toThrow();
    });
  });

  describe('getActiveWhiteLabelForDomain', () => {
    it('should return active config for domain', async () => {
      const config = {
        id: 'wl_123',
        isActive: true,
        domain: 'custom.example.com',
      };

      jest.spyOn(service as any, 'getConfigByDomain').mockResolvedValue(config);

      const result = await service.getActiveWhiteLabelForDomain('custom.example.com');

      expect(result).toEqual(config);
    });

    it('should return null for inactive config', async () => {
      const config = {
        id: 'wl_123',
        isActive: false,
        domain: 'custom.example.com',
      };

      jest.spyOn(service as any, 'getConfigByDomain').mockResolvedValue(config);

      const result = await service.getActiveWhiteLabelForDomain('custom.example.com');

      expect(result).toBeNull();
    });
  });

  describe('getWhiteLabelAssets', () => {
    it('should return formatted assets', async () => {
      const config = {
        id: 'wl_123',
        branding: {
          logo: {
            light: 'https://logo-light.url',
            dark: 'https://logo-dark.url',
            favicon: 'https://favicon.url',
          },
          colors: {
            primary: '#007bff',
          },
          fonts: {
            heading: 'Montserrat',
          },
        },
      };

      jest.spyOn(service as any, 'getConfig').mockResolvedValue(config);

      const assets = await service.getWhiteLabelAssets('wl_123');

      expect(assets).toEqual({
        css: '/assets/whitelabel/wl_123/custom.css',
        logos: config.branding.logo,
        favicon: 'https://favicon.url',
        colors: config.branding.colors,
        fonts: config.branding.fonts,
      });
    });
  });

  describe('CSS generation', () => {
    it('should generate valid CSS from config', async () => {
      const config = {
        id: 'wl_123',
        branding: {
          colors: {
            primary: '#007bff',
            secondary: '#6c757d',
            accent: '#28a745',
            success: '#28a745',
            warning: '#ffc107',
            error: '#dc3545',
            text: {
              primary: '#212529',
              secondary: '#6c757d',
              inverse: '#ffffff',
            },
            background: {
              primary: '#ffffff',
              secondary: '#f8f9fa',
              elevated: '#ffffff',
            },
          },
          fonts: {
            heading: 'Montserrat',
            body: 'Open Sans',
            mono: 'Fira Code',
          },
          customCSS: '/* Custom styles */',
        },
      };

      (uploadFile as jest.Mock).mockResolvedValue('https://css.url');

      const cssUrl = await service['generateCustomCSS'](config as any);

      expect(uploadFile).toHaveBeenCalled();
      const cssBuffer = (uploadFile as jest.Mock).mock.calls[0][0];
      const css = cssBuffer.toString();

      expect(css).toContain('--color-primary: #007bff');
      expect(css).toContain('--font-heading: Montserrat');
      expect(css).toContain('/* Custom styles */');
      expect(cssUrl).toBe('https://css.url');
    });
  });
});