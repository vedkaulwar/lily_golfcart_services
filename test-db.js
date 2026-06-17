const { db } = require('./src/config/firebase');
const rideModel = require('./src/models/rideModel');

async function checkRides() {
    try {
        const snapshot = await db.collection('rides').get();
        if (snapshot.empty) {
            console.log("No rides at all in the database.");
        } else {
            console.log(`Found ${snapshot.size} rides in the database.`);
            snapshot.forEach(doc => {
                console.log(doc.id, "=>", doc.data());
            });
        }
    } catch (e) {
        console.error("Error connecting to Firebase:", e);
    }
}

checkRides();
