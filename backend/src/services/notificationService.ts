/**
 * Notification Service - ERP-AMBE
 * Handles out-of-band delivery of password reset tokens and security alerts.
 * Fails closed without disclosing tokens in logs or HTTP responses when not configured.
 */

export class NotificationService {
  /**
   * Delivers a password reset notification to the specified recipient.
   * Returns true if successfully dispatched via configured provider, false otherwise.
   */
  static async sendPasswordResetNotification(
    recipientEmail: string,
    resetToken: string,
    expiresAt: Date
  ): Promise<boolean> {
    const rawAppUrl = process.env.APP_URL || process.env.CLIENT_URL?.split(',')[0] || 'http://localhost';
    const appUrl = rawAppUrl.replace(/\/+$/, '');
    const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

    const webhookUrl = process.env.NOTIFICATION_WEBHOOK_URL;
    const apiKey = process.env.NOTIFICATION_API_KEY;

    if (webhookUrl) {
      try {
        const timeoutMs = parseInt(process.env.NOTIFICATION_TIMEOUT_MS || '10000', 10);
        const signal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
          ? AbortSignal.timeout(timeoutMs)
          : undefined;

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
          },
          body: JSON.stringify({
            to: recipientEmail,
            subject: 'ERP-AMBE: Password Reset Request',
            template: 'password-reset',
            data: {
              resetUrl,
              expiresAt: expiresAt.toISOString(),
            },
          }),
          signal,
        });

        if (!response.ok) {
          console.error(`[NotificationService] Webhook delivery failed with status ${response.status}`);
          return false;
        }

        return true;
      } catch (err: any) {
        console.error('[NotificationService] Webhook transport error:', err?.message || err);
        return false;
      }
    }

    // Fail closed: Do NOT log the token, reset URL, or recipient email (PII)
    console.warn(
      '[NotificationService] No delivery provider configured (NOTIFICATION_WEBHOOK_URL). Password reset notification could not be delivered out-of-band.'
    );
    return false;
  }
}
