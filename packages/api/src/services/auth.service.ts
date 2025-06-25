import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { prisma } from '../database';
import { User } from '@prisma/client';
import { logger } from '../utils/logger';
import { sendEmail } from '../utils/email';
import crypto from 'crypto';

interface TokenPayload {
  userId: string;
  email: string;
}

interface RegisterInput {
  email: string;
  password: string;
  name?: string;
  company?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

export class AuthService {
  private readonly jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
  private readonly jwtExpiresIn = '7d';
  private readonly saltRounds = 10;

  async register(input: RegisterInput): Promise<{ user: User; token: string }> {
    const { email, password, name, company } = input;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, this.saltRounds);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        company,
        verificationToken,
      },
    });

    // Send verification email
    await this.sendVerificationEmail(user.email, verificationToken);

    // Generate JWT
    const token = this.generateToken({ userId: user.id, email: user.email });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return { user: userWithoutPassword as User, token };
  }

  async login(input: LoginInput): Promise<{ user: User; token: string }> {
    const { email, password } = input;

    // Find user
    const user = await prisma.user.findUnique({ 
      where: { email },
      include: { subscription: true }
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Generate JWT
    const token = this.generateToken({ userId: user.id, email: user.email });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return { user: userWithoutPassword as User, token };
  }

  async verifyEmail(token: string): Promise<void> {
    const user = await prisma.user.findFirst({
      where: { verificationToken: token },
    });

    if (!user) {
      throw new Error('Invalid verification token');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
      },
    });
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal if user exists
      return;
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    await this.sendPasswordResetEmail(email, resetToken);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, this.saltRounds);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid current password');
    }

    const hashedPassword = await bcrypt.hash(newPassword, this.saltRounds);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }

  verifyToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.jwtSecret) as TokenPayload;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  private generateToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
    });
  }

  private async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    
    await sendEmail({
      to: email,
      subject: 'Verify your email - Review Insights AI',
      html: `
        <h1>Welcome to Review Insights AI!</h1>
        <p>Please click the link below to verify your email address:</p>
        <a href="${verificationUrl}" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a>
        <p>Or copy and paste this link: ${verificationUrl}</p>
        <p>This link will expire in 24 hours.</p>
      `,
    });
  }

  private async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    
    await sendEmail({
      to: email,
      subject: 'Reset your password - Review Insights AI',
      html: `
        <h1>Password Reset Request</h1>
        <p>You requested to reset your password. Click the link below to proceed:</p>
        <a href="${resetUrl}" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
        <p>Or copy and paste this link: ${resetUrl}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });
  }

  async createApiKey(userId: string, name: string): Promise<string> {
    const key = `rai_${crypto.randomBytes(32).toString('hex')}`;
    
    await prisma.apiKey.create({
      data: {
        userId,
        key,
        name,
      },
    });

    return key;
  }

  async validateApiKey(key: string): Promise<User | null> {
    const apiKey = await prisma.apiKey.findUnique({
      where: { key },
      include: { user: true },
    });

    if (!apiKey || (apiKey.expiresAt && apiKey.expiresAt < new Date())) {
      return null;
    }

    // Update last used
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsed: new Date() },
    });

    return apiKey.user;
  }
}