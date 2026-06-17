const { db } = require('../config/firebase');

const RIDES_COLLECTION = 'rides';

const createRide = async (rideData) => {
    try {
        const rideRef = db.collection(RIDES_COLLECTION).doc();
        const ride = {
            ...rideData,
            status: 'in_progress', // 'in_progress' or 'completed' or 'cancelled'
            createdAt: new Date().toISOString()
        };
        await rideRef.set(ride);
        return rideRef.id;
    } catch (err) {
        console.error('Error creating ride:', err.message);
        return null;
    }
};

const completeRide = async (rideId) => {
    try {
        await db.collection(RIDES_COLLECTION).doc(rideId).update({
            status: 'completed',
            completedAt: new Date().toISOString()
        });
        return true;
    } catch (err) {
        console.error(`Error completing ride ${rideId}:`, err.message);
        return false;
    }
};

const getHistoryByPhone = async (phone, role) => {
    try {
        const queryField = role === 'driver' ? 'driverPhone' : 'studentPhone';
        const snapshot = await db.collection(RIDES_COLLECTION)
            .where(queryField, '==', phone)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
            
        const rides = [];
        snapshot.forEach(doc => {
            rides.push({ id: doc.id, ...doc.data() });
        });
        return rides;
    } catch (err) {
        console.error(`Error fetching history for ${phone}:`, err.message);
        // Fallback for missing indexes: remove orderBy if it fails
        try {
            const queryField = role === 'driver' ? 'driverPhone' : 'studentPhone';
            const snapshot = await db.collection(RIDES_COLLECTION)
                .where(queryField, '==', phone)
                .get();
                
            const rides = [];
            snapshot.forEach(doc => {
                rides.push({ id: doc.id, ...doc.data() });
            });
            // Sort manually
            rides.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            return rides.slice(0, 50);
        } catch (fallbackErr) {
            console.error(`Fallback fetch failed for ${phone}:`, fallbackErr.message);
            return [];
        }
    }
};

module.exports = {
    createRide,
    completeRide,
    getHistoryByPhone
};
