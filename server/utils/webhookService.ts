
import crypto from 'crypto';

/**
 * Secure webhook service utility for sending authenticated webhook requests
 */
export async function sendWebhook(webhookUrl: string, payload: object): Promise<boolean> {
  try {
    // Retrieve the shared secret from environment variables
    const sharedSecret = process.env.WEBHOOK_SHARED_SECRET;
    if (!sharedSecret) {
      throw new Error('WEBHOOK_SHARED_SECRET environment variable is not set');
    }

    // Convert payload to JSON string
    const payloadString = JSON.stringify(payload);

    // Generate HMAC-SHA256 signature
    const signature = crypto
      .createHmac('sha256', sharedSecret)
      .update(payloadString)
      .digest('hex');

    // Send POST request with authentication signature
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SIGNATURE': `sha256=${signature}`,
      },
      body: payloadString,
    });

    if (response.ok) {
      console.log(`Webhook sent successfully to ${webhookUrl}`);
      return true;
    } else {
      console.error(`Webhook failed with status ${response.status}: ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.error('Error sending webhook:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

/**
 * Utility function to verify webhook signature (for receiving webhooks)
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const receivedSignature = signature.replace('sha256=', '');
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    );
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}
