const fs = require('fs');
const path = require('path');

try {
    const sa = require('./serviceAccountKey.json');
    let envContent = fs.readFileSync('.env', 'utf8');

    // Add variables if they don't already exist
    if (!envContent.includes('FIREBASE_PROJECT_ID')) {
        envContent += `\nFIREBASE_PROJECT_ID=${sa.project_id}\n`;
        envContent += `FIREBASE_CLIENT_EMAIL=${sa.client_email}\n`;
        // Use JSON.stringify to properly escape the private key with \n
        envContent += `FIREBASE_PRIVATE_KEY=${JSON.stringify(sa.private_key)}\n`;
        
        fs.writeFileSync('.env', envContent);
        console.log("Successfully appended Firebase credentials to .env file.");
    } else {
        console.log("Firebase credentials already exist in .env");
    }
} catch (e) {
    console.error("Failed to append to .env:", e.message);
}
