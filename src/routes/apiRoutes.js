const express = require('express');
const router = express.Router();
const userModel = require('../models/userModel');
const rideModel = require('../models/rideModel');
const nodemailer = require('nodemailer');
const { auth } = require('../config/firebase');

// Simple in-memory store for OTPs
const emailOtps = new Map();

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Send Email OTP
router.post('/auth/send-email-otp', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    emailOtps.set(email, {
        code: otp,
        expires: Date.now() + 10 * 60 * 1000
    });

    try {
        await transporter.sendMail({
            from: `"Lily Golfcart Services" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Your Lily Golfcart Verification Code',
            text: `Your login verification code is: ${otp}. It will expire in 10 minutes.`,
            html: `<h3>Welcome to Lily Golfcart Services</h3><p>Your login verification code is: <strong>${otp}</strong></p><p>It will expire in 10 minutes.</p>`
        });
        res.json({ success: true, message: 'OTP sent to email' });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ error: 'Failed to send email. Check SMTP configuration.' });
    }
});

// Verify Email OTP
router.post('/auth/verify-email-otp', async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });

    const record = emailOtps.get(email);
    if (!record) return res.status(400).json({ error: 'No pending OTP found for this email' });
    
    if (Date.now() > record.expires) {
        emailOtps.delete(email);
        return res.status(400).json({ error: 'OTP has expired' });
    }

    if (record.code !== code) {
        return res.status(400).json({ error: 'Invalid OTP' });
    }

    emailOtps.delete(email);

    try {
        let userRecord;
        try {
            userRecord = await auth.getUserByEmail(email);
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                userRecord = await auth.createUser({ email });
            } else {
                throw error;
            }
        }

        const customToken = await auth.createCustomToken(userRecord.uid);
        res.json({ success: true, customToken });
    } catch (error) {
        console.error('Error creating custom token:', error);
        res.status(500).json({ error: 'Internal server error during authentication' });
    }
});

// Login or Signup (sync user to Firestore)
router.post('/users/sync', async (req, res) => {
    const { phone, name, role, cartId } = req.body;
    
    if (!phone) {
        return res.status(400).json({ error: 'Phone number is required' });
    }

    let user = await userModel.getUser(phone);
    
    if (!user) {
        // If user doesn't exist, create them
        user = await userModel.createUser({ phone, name, role, cartId });
    } else if (name && user.name !== name) {
        // If they provided a new name, we might want to update it
        // Or just return the existing user
    }

    res.json(user);
});

router.post('/users/wallet/add', async (req, res) => {
    const { phone, amount } = req.body;
    
    if (!phone || !amount) {
        return res.status(400).json({ error: 'Phone and amount are required' });
    }
    
    const result = await userModel.addFunds(phone, amount);
    if (result) {
        res.json(result);
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

router.post('/users/profile/update', async (req, res) => {
    const { phone, name } = req.body;
    
    if (!phone || !name) {
        return res.status(400).json({ error: 'Phone and name are required' });
    }
    
    const success = await userModel.updateProfileName(phone, name);
    if (success) {
        res.json({ success: true });
    } else {
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Fetch ride history
router.get('/rides/history/:phone', async (req, res) => {
    const { phone } = req.params;
    const { role } = req.query; // 'student' or 'driver'
    
    if (!phone || !role) {
        return res.status(400).json({ error: 'Phone and role are required' });
    }

    try {
        const history = await rideModel.getHistoryByPhone(phone, role);
        res.json(history);
    } catch (error) {
        console.error('Error fetching ride history API:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Remove early export

// --- Admin Reset Route (For debugging stuck state) ---
const { db } = require('../config/firebase');
const CARTS_COLLECTION = 'carts';

router.get('/admin/reset-carts', async (req, res) => {
    try {
        const snapshot = await db.collection(CARTS_COLLECTION).get();
        const batch = db.batch();
        snapshot.forEach(doc => {
            const data = doc.data();
            const seats = { ...data.seats };
            for (const seatNum in seats) {
                seats[seatNum].status = 'available';
                seats[seatNum].studentPhone = null;
                seats[seatNum].studentName = null;
                seats[seatNum].route = null;
                seats[seatNum].requestId = null;
                seats[seatNum].rideOtp = null;
                seats[seatNum].rideId = null;
            }
            batch.update(doc.ref, {
                isOnline: false,
                driverSocketId: null,
                seats: seats
            });
        });
        await batch.commit();
        res.json({ success: true, message: 'All carts have been reset to offline and available.' });
    } catch (err) {
        console.error('Reset error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
