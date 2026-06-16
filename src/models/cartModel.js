const { db } = require('../config/firebase');

const CARTS_COLLECTION = 'activeCarts';

// In case the DB is empty or we need default state
const initialSeatState = () => ({
    2: { status: 'available', student: null },
    3: { status: 'available', student: null },
    4: { status: 'available', student: null },
    5: { status: 'available', student: null },
    6: { status: 'available', student: null },
});

// Since we are migrating from in-memory, we might need to initialize Firestore
const initializeFirestoreData = async () => {
    try {
        const snapshot = await db.collection(CARTS_COLLECTION).limit(1).get();
        if (snapshot.empty) {
            console.log('Initializing Firestore with default cart data...');
            const defaultCarts = ['Golf_Cart_1', 'Golf_Cart_2', 'Golf_Cart_3'];
            const batch = db.batch();
            
            for (const cartId of defaultCarts) {
                const ref = db.collection(CARTS_COLLECTION).doc(cartId);
                batch.set(ref, {
                    cartId,
                    location: { lat: 18.4871, lng: 74.0205 },
                    seats: initialSeatState(),
                    driverSocketId: null,
                    isOnline: false
                });
            }
            await batch.commit();
            console.log('Firestore initialized.');
        }
    } catch (err) {
         console.error('Error initializing firestore data. Is Firebase configured properly?', err.message);
    }
};

// Start initialization (non-blocking)
initializeFirestoreData();

const getAllCarts = async () => {
    try {
        const snapshot = await db.collection(CARTS_COLLECTION).get();
        const carts = {};
        snapshot.forEach(doc => {
            carts[doc.id] = doc.data();
        });
        return carts;
    } catch (err) {
        console.error('Error fetching all carts', err.message);
        return {};
    }
};

const getCart = async (cartId) => {
    try {
        const doc = await db.collection(CARTS_COLLECTION).doc(cartId).get();
        if (doc.exists) {
            return doc.data();
        }
        return null;
    } catch (err) {
        console.error(`Error fetching cart ${cartId}`, err.message);
        return null;
    }
};

const updateCart = async (cartId, updates) => {
    try {
        await db.collection(CARTS_COLLECTION).doc(cartId).update(updates);
    } catch (err) {
        console.error(`Error updating cart ${cartId}`, err.message);
    }
};

module.exports = {
    getAllCarts,
    getCart,
    updateCart
};
