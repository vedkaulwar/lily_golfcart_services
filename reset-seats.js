require('dotenv').config();
const { db } = require('./src/config/firebase');

const CARTS_COLLECTION = 'activeCarts';
const initialSeatState = () => ({
    2: { status: 'available', student: null },
    3: { status: 'available', student: null },
    4: { status: 'available', student: null },
    5: { status: 'available', student: null },
    6: { status: 'available', student: null },
});

async function reset() {
    try {
        const defaultCarts = ['Golf_Cart_1', 'Golf_Cart_2', 'Golf_Cart_3'];
        const batch = db.batch();
        
        for (const cartId of defaultCarts) {
            const ref = db.collection(CARTS_COLLECTION).doc(cartId);
            batch.update(ref, {
                seats: initialSeatState()
            });
        }
        await batch.commit();
        console.log('Seats reset successfully');
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}

reset();
