const express = require('express');
const router = express.Router();
const userModel = require('../models/userModel');

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

module.exports = router;
