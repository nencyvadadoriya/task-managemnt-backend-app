const nodemailer = require('nodemailer');
require('dotenv').config();

console.log('🔧 Email Configuration Check:');
console.log('USER_EMAIL:', process.env.USER_EMAIL || '❌ Missing');
console.log('USER_PASS_KEY:', process.env.USER_PASS_KEY ? '✅ Set (length: ' + process.env.USER_PASS_KEY.length + ')' : '❌ Missing');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');

// Create transporter with detailed error handling
const createTransporter = () => {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            host: 'smtp.gmail.com',
            port: 587,
            secure: false, // Use TLS
            auth: {
                user: process.env.USER_EMAIL,
                pass: process.env.USER_PASS_KEY
            },
            tls: {
                ciphers: 'SSLv3',
                rejectUnauthorized: false
            }
        });

        // Verify connection
        transporter.verify((error, success) => {
            if (error) {
                console.error('❌ Email transporter verification failed:', {
                    message: error.message,
                    code: error.code,
                    command: error.command
                });
                
                // Check specific errors
                if (error.code === 'EAUTH') {
                    console.error('⚠️ Authentication failed. Check:');
                    console.error('1. Is 2-Step Verification enabled on Google Account?');
                    console.error('2. Is the App Password correct?');
                    console.error('3. Try generating a new App Password');
                }
            } else {
                console.log('✅ Email server is ready to send messages');
            }
        });

        return transporter;
    } catch (error) {
        console.error('❌ Failed to create email transporter:', error.message);
        return null;
    }
};

const transporter = createTransporter();

// Send OTP Email with comprehensive error handling
exports.sendOtpEmail = async (email, otp, name = 'User') => {
    try {
        console.log(`📤 [${new Date().toISOString()}] Attempting to send OTP to: ${email}`);
        
        // Validate inputs
        if (!email || !otp) {
            console.error('❌ Missing email or OTP');
            return false;
        }

        // Check if credentials exist
        if (!process.env.USER_EMAIL || !process.env.USER_PASS_KEY) {
            console.error('❌ Email credentials not found in environment');
            console.log('Please check Render.com environment variables:');
            console.log('- USER_EMAIL should be:', process.env.USER_EMAIL);
            console.log('- USER_PASS_KEY should be 16-character App Password');
            return false;
        }

        // Check transporter
        if (!transporter) {
            console.error('❌ Email transporter not initialized');
            return false;
        }

        const mailOptions = {
            from: {
                name: 'Task Management System',
                address: process.env.USER_EMAIL
            },
            to: email,
            subject: 'Password Reset OTP - Task Management System',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>OTP Verification</title>
                </head>
                <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4;">
                    <div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden;">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
                            <h1 style="margin: 0; font-size: 28px;">🔐 Password Reset OTP</h1>
                            <p style="margin: 10px 0 0 0; opacity: 0.9;">Task Management System</p>
                        </div>
                        
                        <div style="padding: 40px 30px;">
                            <h2 style="color: #333; margin-top: 0;">Hello ${name},</h2>
                            
                            <p style="color: #555; line-height: 1.6; font-size: 16px;">
                                You requested to reset your password. Please use the One-Time Password (OTP) below to verify your identity:
                            </p>
                            
                            <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); 
                                        color: white; 
                                        border-radius: 12px; 
                                        padding: 25px; 
                                        text-align: center; 
                                        margin: 30px 0; 
                                        font-size: 42px; 
                                        font-weight: bold; 
                                        letter-spacing: 15px; 
                                        box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                                ${otp}
                            </div>
                            
                            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                                <p style="margin: 0; color: #856404;">
                                    <strong>⚠️ Important:</strong> 
                                    <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                                        <li>This OTP is valid for <strong>2 minutes</strong> only</li>
                                        <li>Do not share this OTP with anyone</li>
                                        <li>If you didn't request this, please ignore this email</li>
                                    </ul>
                                </p>
                            </div>
                            
                            <p style="color: #666; font-size: 14px; border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
                                Need help? Contact our support team or reply to this email.
                            </p>
                        </div>
                        
                        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 12px; border-top: 1px solid #dee2e6;">
                            <p style="margin: 5px 0;">© ${new Date().getFullYear()} Task Management System. All rights reserved.</p>
                            <p style="margin: 5px 0;">This is an automated message, please do not reply directly.</p>
                            <p style="margin: 5px 0;">
                                <a href="#" style="color: #6c757d; text-decoration: none;">Privacy Policy</a> | 
                                <a href="#" style="color: #6c757d; text-decoration: none;">Terms of Service</a>
                            </p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            // Plain text version for email clients that don't support HTML
            text: `
                PASSWORD RESET OTP - TASK MANAGEMENT SYSTEM
                =============================================
                
                Hello ${name},
                
                You requested to reset your password. Use this OTP to verify your identity:
                
                OTP: ${otp}
                
                ⚠️ Important:
                • This OTP is valid for 2 minutes only
                • Do not share this OTP with anyone
                • If you didn't request this, please ignore this email
                
                Need help? Contact our support team.
                
                © ${new Date().getFullYear()} Task Management System
                This is an automated message.
            `
        };

        console.log('📧 Sending email with options:', {
            from: mailOptions.from,
            to: mailOptions.to,
            subject: mailOptions.subject
        });

        // Send email
        const info = await transporter.sendMail(mailOptions);
        
        console.log('✅ Email sent successfully!');
        console.log('📨 Message ID:', info.messageId);
        console.log('📧 Response:', info.response);
        
        return true;
        
    } catch (error) {
        console.error('❌ Email sending failed with details:');
        console.error('Error Message:', error.message);
        console.error('Error Code:', error.code);
        console.error('Error Command:', error.command);
        console.error('Error Response Code:', error.responseCode);
        console.error('Error Response:', error.response);
        
        // Specific error handling
        if (error.code === 'EAUTH') {
            console.error('\n🔐 AUTHENTICATION FAILED - SOLUTIONS:');
            console.error('1. Go to: https://myaccount.google.com/security');
            console.error('2. Enable "2-Step Verification"');
            console.error('3. Generate new "App Password" for Mail');
            console.error('4. Update USER_PASS_KEY in Render.com');
            console.error('5. Current USER_PASS_KEY length:', process.env.USER_PASS_KEY?.length);
        }
        
        return false;
    }
};

// Test function
exports.testEmailService = async (testEmail = 'test@example.com') => {
    console.log('\n🧪 TESTING EMAIL SERVICE...');
    
    const testOtp = Math.floor(100000 + Math.random() * 900000);
    const result = await exports.sendOtpEmail(testEmail, testOtp, 'Test User');
    
    if (result) {
        console.log('✅ Email service test PASSED');
    } else {
        console.log('❌ Email service test FAILED');
    }
    
    return result;
};