const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/user.sqlite.repository');

class AuthService {
  async register(username, email, password) {
    // Check duplicate username
    const existingUsername = userRepository.findByUsername(username);
    if (existingUsername) {
      const error = new Error('Username is already taken');
      error.status = 409;
      throw error;
    }

    // Check duplicate email
    const existingEmail = userRepository.findByEmail(email);
    if (existingEmail) {
      const error = new Error('Email is already registered');
      error.status = 409;
      throw error;
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    return userRepository.create(username, email, passwordHash);
  }

  async login(identifier, password) {
    // Find user by username or email
    let user = userRepository.findByEmail(identifier);
    if (!user) {
      user = userRepository.findByUsername(identifier);
    }

    if (!user) {
      const error = new Error('Invalid credentials');
      error.status = 401;
      throw error;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      const error = new Error('Invalid credentials');
      error.status = 401;
      throw error;
    }

    // Generate JWT
    const secret = process.env.JWT_SECRET || 'super_secret_local_development_jwt_key_123!';
    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email
    };

    const token = jwt.sign(payload, secret, { expiresIn });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    };
  }

  getUserById(id) {
    const user = userRepository.findById(id);
    if (!user) {
      return null;
    }
    return {
      id: user.id,
      username: user.username,
      email: user.email
    };
  }
}

module.exports = new AuthService();
