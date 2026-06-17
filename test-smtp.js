require('dotenv').config();
const nodemailer = require('nodemailer');

console.log("Email User:", process.env.EMAIL_USER);
console.log("Email Pass Length:", process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0);

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

transporter.verify(function(error, success) {
    if (error) {
        console.error("SMTP Error:", error);
    } else {
        console.log("SMTP Server is ready to take our messages");
    }
});
