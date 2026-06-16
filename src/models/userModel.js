const { db } = require('../config/firebase');

const USERS_COLLECTION = 'users';

const getUser = async (phone) => {
    try {
        const doc = await db.collection(USERS_COLLECTION).doc(phone).get();
        if (doc.exists) {
            return doc.data();
        }
        return null;
    } catch (err) {
        console.error(`Error fetching user ${phone}:`, err.message);
        return null;
    }
};

const createUser = async (userData) => {
    try {
        // Use phone number as document ID for easy fetching
        const { phone } = userData;
        await db.collection(USERS_COLLECTION).doc(phone).set({
            ...userData,
            walletBalance: 0.00,
            walletTransactions: [],
            rideHistory: [],
            createdAt: new Date().toISOString()
        });
        return await getUser(phone);
    } catch (err) {
        console.error('Error creating user:', err.message);
        return null;
    }
};

const addFunds = async (phone, amount) => {
    try {
        const userRef = db.collection(USERS_COLLECTION).doc(phone);
        const doc = await userRef.get();
        if (doc.exists) {
            const data = doc.data();
            const newBalance = (data.walletBalance || 0) + parseFloat(amount);
            
            const transaction = {
                title: "Added Funds",
                date: new Date().toLocaleString(),
                amount: parseFloat(amount)
            };
            
            const newTransactions = [transaction, ...(data.walletTransactions || [])];
            
            await userRef.update({
                walletBalance: newBalance,
                walletTransactions: newTransactions
            });
            
            return { walletBalance: newBalance, walletTransactions: newTransactions };
        }
        return null;
    } catch (err) {
        console.error(`Error adding funds for ${phone}:`, err.message);
        return null;
    }
};

const updateProfileName = async (phone, newName) => {
    try {
        const userRef = db.collection(USERS_COLLECTION).doc(phone);
        await userRef.update({ name: newName });
        return true;
    } catch (err) {
        console.error(`Error updating name for ${phone}:`, err.message);
        return false;
    }
}

module.exports = {
    getUser,
    createUser,
    addFunds,
    updateProfileName
};
