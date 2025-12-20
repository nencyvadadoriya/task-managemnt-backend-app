const nodemailer = require('nodemailer');
require('dotenv').config(); // Add this line

console.log('🔧 Email Configuration:');
console.log('Email User:', process.env.USER_EMAIL || process.env.EMAIL_USER);
console.log('Email Password:', (process.env.USER_PASS_KEY || process.env.EMAIL_PASSWORD) ? '✅ Set' : '❌ Missing');

// Create transporter with support for both old and new env variable names
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        // Prefer new variable names but fall back to older ones if needed
        user: process.env.USER_EMAIL || process.env.EMAIL_USER,
        pass: process.env.USER_PASS_KEY || process.env.EMAIL_PASSWORD
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Test email configuration
transporter.verify(function(error, success) {
    if (error) {
        console.error('❌ Email configuration error:', error);
    } else {
        console.log('✅ Email server is ready to send messages');
    }
});

// Send OTP Email
exports.sendOtpEmail = async (email, otp, name = 'User') => {
    try {
        console.log(`📤 Attempting to send OTP to: ${email}`);
        console.log(`📧 Using sender: ${process.env.USER_EMAIL}`);

        const mailOptions = {
            from: `"Your App" <${process.env.USER_EMAIL}>`,
            to: email,
            subject: 'Password Reset OTP',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>OTP Verification</title>
                    <style>
                        body { font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px; }
                        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
                        .header { background: #2563eb; color: white; padding: 30px; text-align: center; }
                        .content { padding: 30px; }
                        .otp-box { background: #f8fafc; border: 2px dashed #2563eb; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; font-size: 32px; font-weight: bold; letter-spacing: 10px; color: #2563eb; }
                        .footer { background: #f8fafc; padding: 20px; text-align: center; color: #666; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>OTP Verification</h1>
                        </div>
                        <div class="content">
                            <h2>Hello ${name},</h2>
                            <p>You requested to reset your password. Use the OTP below:</p>
                            <div class="otp-box">${otp}</div>
                            <p><strong>⚠️ Important:</strong> This OTP is valid for 2 minutes only.</p>
                            <p>If you didn't request this, please ignore this email.</p>
                        </div>
                        <div class="footer">
                            <p>© ${new Date().getFullYear()} Your App</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully!');
        console.log('📧 Message ID:', info.messageId);
        console.log('📨 Preview URL:', nodemailer.getTestMessageUrl(info));
        
        return true;
    } catch (error) {
        console.error('❌ Email sending failed:', error.message);
        console.error('Full error:', error);
        return false;
    }
};