import { Router } from 'express';
import { ZeroConfigService } from '../services/zero-config.service';
import { logger } from '../utils/logger';

const router = Router();
const zeroConfigService = new ZeroConfigService();

// Start zero-config setup
router.post('/zero-config', async (req, res) => {
  try {
    const { identifier } = req.body;
    
    if (!identifier) {
      return res.status(400).json({ error: 'Identifier is required' });
    }

    // Generate temporary user ID (in production, this would be from auth)
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const setup = await zeroConfigService.setupBusiness(identifier, userId);
    
    res.json({
      businessId: setup.businessId,
      status: setup.status,
      progress: setup.progress,
    });
  } catch (error) {
    logger.error('Zero-config setup failed', { error });
    res.status(500).json({ error: 'Setup failed' });
  }
});

// Get setup status
router.get('/status/:setupId', async (req, res) => {
  try {
    const { setupId } = req.params;
    
    // In production, this would fetch from database
    // For now, return mock progress
    const mockProgress = {
      businessId: setupId,
      status: 'in_progress',
      progress: {
        currentStep: 'sources',
        completedSteps: ['discovery', 'competitors'],
        totalSteps: 8,
        percentComplete: 25,
      },
    };
    
    res.json(mockProgress);
  } catch (error) {
    logger.error('Failed to get setup status', { error });
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// Update setup configuration
router.put('/config/:setupId', async (req, res) => {
  try {
    const { setupId } = req.params;
    const updates = req.body;
    
    // In production, validate and update configuration
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to update setup config', { error });
    res.status(500).json({ error: 'Update failed' });
  }
});

// Complete setup
router.post('/complete/:setupId', async (req, res) => {
  try {
    const { setupId } = req.params;
    const { email, password } = req.body;
    
    // In production:
    // 1. Create user account
    // 2. Activate configuration
    // 3. Start data collection
    // 4. Send welcome email
    
    res.json({
      success: true,
      redirectUrl: '/dashboard',
    });
  } catch (error) {
    logger.error('Failed to complete setup', { error });
    res.status(500).json({ error: 'Completion failed' });
  }
});

export default router;