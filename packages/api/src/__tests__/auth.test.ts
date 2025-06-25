import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { AuthService } from '../services/auth.service';
import { prisma } from '../database';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../database');
jest.mock('../utils/email');

const app = express();
app.use(express.json());

// Mock auth routes (simplified version)
const authService = new AuthService();

app.post('/api/auth/register', async (req, res) => {
  try {
    const result = await authService.register(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

describe('Auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
        company: 'Test Corp',
        emailVerified: false,
        verificationToken: 'token_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        ...mockUser,
        password: 'hashed_password',
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecurePassword123!',
          name: 'Test User',
          company: 'Test Corp',
        });

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({
        email: 'test@example.com',
        name: 'Test User',
        company: 'Test Corp',
      });
      expect(response.body.user.password).toBeUndefined();
      expect(response.body.token).toBeDefined();
    });

    it('should reject registration with existing email', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing_user',
        email: 'existing@example.com',
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('User already exists');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          // Missing password
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      const hashedPassword = await bcrypt.hash('Password123!', 10);
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        password: hashedPassword,
        emailVerified: true,
        subscription: {
          plan: 'PROFESSIONAL',
          stripeStatus: 'active',
        },
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user.password).toBeUndefined();
      expect(response.body.token).toBeDefined();

      // Verify token
      const decoded = jwt.verify(
        response.body.token,
        process.env.JWT_SECRET || 'your-secret-key'
      ) as any;
      expect(decoded.userId).toBe('user_123');
      expect(decoded.email).toBe('test@example.com');
    });

    it('should reject login with incorrect password', async () => {
      const hashedPassword = await bcrypt.hash('CorrectPassword', 10);
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        password: hashedPassword,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should reject login with non-existent user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });
  });

  describe('Email Verification', () => {
    it('should verify email with valid token', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        verificationToken: 'valid_token',
        emailVerified: false,
      };

      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        emailVerified: true,
        verificationToken: null,
      });

      await authService.verifyEmail('valid_token');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user_123' },
        data: {
          emailVerified: true,
          verificationToken: null,
        },
      });
    });

    it('should reject invalid verification token', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(authService.verifyEmail('invalid_token'))
        .rejects.toThrow('Invalid verification token');
    });
  });

  describe('Password Reset', () => {
    it('should initiate password reset', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        resetToken: 'reset_token',
        resetTokenExpiry: new Date(Date.now() + 3600000),
      });

      await authService.forgotPassword('test@example.com');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user_123' },
        data: expect.objectContaining({
          resetToken: expect.any(String),
          resetTokenExpiry: expect.any(Date),
        }),
      });
    });

    it('should not reveal if user exists on password reset', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Should not throw error
      await expect(authService.forgotPassword('nonexistent@example.com'))
        .resolves.not.toThrow();
    });

    it('should reset password with valid token', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        resetToken: 'valid_reset_token',
        resetTokenExpiry: new Date(Date.now() + 3600000), // 1 hour from now
      };

      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        resetToken: null,
        resetTokenExpiry: null,
      });

      await authService.resetPassword('valid_reset_token', 'NewPassword123!');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user_123' },
        data: expect.objectContaining({
          password: expect.any(String), // Should be hashed
          resetToken: null,
          resetTokenExpiry: null,
        }),
      });
    });

    it('should reject expired reset token', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        resetToken: 'expired_token',
        resetTokenExpiry: new Date(Date.now() - 3600000), // 1 hour ago
      };

      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null); // Won't match due to date filter

      await expect(authService.resetPassword('expired_token', 'NewPassword123!'))
        .rejects.toThrow('Invalid or expired reset token');
    });
  });

  describe('API Key Management', () => {
    it('should create API key', async () => {
      (prisma.apiKey.create as jest.Mock).mockResolvedValue({
        id: 'key_123',
        userId: 'user_123',
        key: 'rai_generated_key',
        name: 'Production API',
      });

      const key = await authService.createApiKey('user_123', 'Production API');

      expect(key).toMatch(/^rai_/);
      expect(prisma.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user_123',
          name: 'Production API',
          key: expect.stringMatching(/^rai_/),
        }),
      });
    });

    it('should validate API key', async () => {
      const mockApiKey = {
        id: 'key_123',
        key: 'rai_valid_key',
        userId: 'user_123',
        lastUsed: null,
        expiresAt: null,
        user: {
          id: 'user_123',
          email: 'test@example.com',
        },
      };

      (prisma.apiKey.findUnique as jest.Mock).mockResolvedValue(mockApiKey);
      (prisma.apiKey.update as jest.Mock).mockResolvedValue(mockApiKey);

      const user = await authService.validateApiKey('rai_valid_key');

      expect(user).toMatchObject({
        id: 'user_123',
        email: 'test@example.com',
      });
      expect(prisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key_123' },
        data: { lastUsed: expect.any(Date) },
      });
    });

    it('should reject expired API key', async () => {
      const mockApiKey = {
        id: 'key_123',
        key: 'rai_expired_key',
        expiresAt: new Date(Date.now() - 3600000), // Expired
        user: { id: 'user_123' },
      };

      (prisma.apiKey.findUnique as jest.Mock).mockResolvedValue(mockApiKey);

      const user = await authService.validateApiKey('rai_expired_key');

      expect(user).toBeNull();
    });
  });

  describe('JWT Token Management', () => {
    it('should generate and verify JWT tokens', () => {
      const payload = { userId: 'user_123', email: 'test@example.com' };
      const token = jwt.sign(
        payload,
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );

      const verified = authService.verifyToken(token);

      expect(verified.userId).toBe('user_123');
      expect(verified.email).toBe('test@example.com');
    });

    it('should reject invalid JWT tokens', () => {
      const invalidToken = 'invalid.jwt.token';

      expect(() => authService.verifyToken(invalidToken))
        .toThrow('Invalid token');
    });

    it('should reject expired JWT tokens', () => {
      const expiredToken = jwt.sign(
        { userId: 'user_123', email: 'test@example.com' },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '-1h' } // Already expired
      );

      expect(() => authService.verifyToken(expiredToken))
        .toThrow();
    });
  });
});