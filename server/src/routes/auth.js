import { Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = Router();

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email });
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ message: 'Enter your name.' });
    if (!emailOk(email || '')) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (!password || password.length < 8)
      return res.status(400).json({ message: 'Use a password with at least 8 characters.' });

    const user = await User.create({ name, email, password });
    res.status(201).json({ token: signToken(user._id), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: 'Enter your email and password.' });

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ message: 'Email or password is incorrect.' });

    res.json({ token: signToken(user._id), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get('/me', protect, (req, res) => res.json({ user: publicUser(req.user) }));

export default router;
