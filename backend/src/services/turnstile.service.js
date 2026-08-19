const dns = require('dns');

class TurnstileService {
  /**
   * Verifies a Cloudflare Turnstile token
   * @param {string} token - The turnstileToken submitted by the client
   * @param {string} [remoteIp] - Optional client IP address
   * @returns {Promise<boolean>} Normalized success or failure
   */
  async verifyToken(token, remoteIp) {
    if (!token) {
      return false;
    }

    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
      // If secret key is missing, fail open in development or fail closed in production?
      // "If Cloudflare is unavailable: return a controlled authentication failure. Do not allow authentication to proceed without successful verification."
      // So if TURNSTILE_SECRET_KEY is missing, we fail closed (return false)
      return false;
    }

    // Set a reasonable request timeout using AbortController (5 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const params = new URLSearchParams();
      params.append('secret', secret);
      params.append('response', token);
      if (remoteIp) {
        params.append('remoteip', remoteIp);
      }

      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString(),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Log generic failure without tokens/secrets
        console.error(`Cloudflare Siteverify request failed with status: ${response.status}`);
        return false;
      }

      const data = await response.json();
      
      // Normalized result: true if success is true, false otherwise
      return !!data.success;
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('Turnstile verification request error:', err.message);
      return false;
    }
  }
}

module.exports = new TurnstileService();
