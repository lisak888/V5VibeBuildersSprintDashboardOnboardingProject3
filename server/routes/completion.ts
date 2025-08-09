
import express from 'express';
import { sendWebhook } from '../utils/webhookService';

const router = express.Router();

/**
 * POST / - Dashboard completion webhook endpoint
 * Sends a webhook notification when a user completes their dashboard setup
 */
router.post('/', async (req, res) => {
  try {
    const { user_name, dashboard_url } = req.body;

    // Validate required fields
    if (!user_name || !dashboard_url) {
      return res.status(400).json({ 
        message: 'Missing required fields: user_name and dashboard_url are required' 
      });
    }

    // Get webhook URL from environment
    const hookUrl = process.env.DASHBOARD_COMPLETE_HOOK_URL;
    if (!hookUrl) {
      console.error('DASHBOARD_COMPLETE_HOOK_URL environment variable is not set');
      return res.status(500).json({ 
        message: 'Dashboard completion webhook URL is not configured' 
      });
    }

    // Construct the webhook payload
    const payload = {
      user_name,
      dashboard_url,
      completion_timestamp: new Date().toISOString(),
    };

    // Send the webhook
    const success = await sendWebhook(hookUrl, payload);

    if (success) {
      res.status(200).json({ 
        success: true, 
        message: 'Dashboard completion webhook sent successfully' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send dashboard completion webhook' 
      });
    }
  } catch (error) {
    console.error('Error in dashboard completion webhook:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error while sending dashboard completion webhook' 
    });
  }
});

export default router;
