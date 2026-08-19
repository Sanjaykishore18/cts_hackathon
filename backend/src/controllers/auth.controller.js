const authService = require('../services/auth.service');

class AuthController {
  async register(req, res, next) {
    try {
      const { username, email, password } = req.body;

      // Validation
      if (!username || typeof username !== 'string' || username.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Username is required and cannot be empty'
        });
      }

      if (!email || typeof email !== 'string' || email.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Email is required'
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid email format'
        });
      }

      if (!password || typeof password !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Password is required'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 6 characters long'
        });
      }

      const user = await authService.register(username.trim(), email.trim(), password);
      
      return res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
          }
        }
      });
    } catch (error) {
      if (error.status === 409) {
        return res.status(409).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { username, email, password } = req.body;
      const identifier = username || email;

      if (!identifier || typeof identifier !== 'string' || identifier.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Username or Email is required'
        });
      }

      if (!password || typeof password !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Password is required'
        });
      }

      const result = await authService.login(identifier.trim(), password);

      return res.status(200).json({
        success: true,
        data: {
          token: result.token,
          user: result.user
        }
      });
    } catch (error) {
      if (error.status === 401) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }
      next(error);
    }
  }

  async me(req, res, next) {
    try {
      // User is already attached to req.user by authenticateJWT middleware
      return res.status(200).json({
        success: true,
        data: {
          id: req.user.id,
          username: req.user.username,
          email: req.user.email
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      return res.status(200).json({
        success: true,
        message: 'Logout successful. Please discard the authentication token on the client side.'
      });
    } catch (error) {
      next(error);
    }
  }

  async config(req, res, next) {
    try {
      return res.status(200).json({
        success: true,
        data: {
          turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '1x00000000000000000000AA'
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
