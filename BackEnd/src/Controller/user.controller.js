const User = require('../model/user.model');
const bcrypt = require('bcrypt');
const jwt = require("jsonwebtoken");

const { sendOtpEmail } = require('../middleware/email.message');

// Register user
exports.registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Name, email and password are required'
            });
        }
        // Check if user exists
        const existUser = await User.findOne({ email });
        if (existUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            });
        }   

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await newUser.save();

        const userPayload = {
            id: newUser._id,
            name: newUser.name,
            email: newUser.email,
        };

        const token = jwt.sign(
            userPayload,
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '24h' }
        );

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            result: {
                token,
                user: userPayload
            }
        });

    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({
            success: false,
            message: 'Error registering user',
            error: error.message
        });
    }
};

// Login user
exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
                // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({
                error: true,
                msg: 'User not found'
            });
        }

        // Check password
        const matchPassword = await bcrypt.compare(password, user.password);
        if (!matchPassword) {
            return res.status(400).json({
                error: true,
                msg: 'Invalid password'
            });
        }

        // Create token
        const token = jwt.sign(
            {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role
            },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '24h' }
        );
        // Remove password from response
        user.password = undefined;

        // Send consistent response format
        res.status(200).json({
            error: false,
            msg: 'Login successful',
            result: {
                token: token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            }
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
            error: true,
            msg: 'Server error during login'
        });
    }
};

// Forget Password (with better debugging)
exports.forgetPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            console.log('❌ User not found');
            return res.status(404).json({
                success: false,
                message: 'Email not found in our database'
            });
        }

        console.log('✅ User found:', user.email);

        // Generate OTP
        const OTP = Math.floor(100000 + Math.random() * 900000);
        const otpExpiry = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

        console.log('🔢 Generated OTP:', OTP);
        console.log('⏰ OTP Expiry:', otpExpiry);

        // Method 1: Direct update with console logging
        const result = await User.updateOne(
            { email: email },
            {
                $set: {
                    resetOtp: OTP,
                    otpExpiry: otpExpiry,
                    updatedAt: new Date()
                }
            }
        );

        console.log('📝 Update Result:', {
            matched: result.matchedCount,
            modified: result.modifiedCount,
            upserted: result.upsertedCount
        });

        // Verify the update
        const updatedUser = await User.findOne({ email });
        console.log('🔍 After Update - resetOtp:', updatedUser.resetOtp);
        console.log('🔍 After Update - otpExpiry:', updatedUser.otpExpiry);

        if (!updatedUser.resetOtp) {
            console.log('⚠️ OTP not saved! Trying alternative method...');

            // Alternative method
            await User.findOneAndUpdate(
                { email: email },
                {
                    resetOtp: OTP,
                    otpExpiry: otpExpiry
                },
                {
                    new: true,
                    runValidators: false,
                    setDefaultsOnInsert: true
                }
            );

            // Verify again
            const recheckUser = await User.findOne({ email });
            console.log('🔍 Recheck - resetOtp:', recheckUser.resetOtp);
        }

        // Try to send email
        let emailSent = false;
        try {
            emailSent = await sendOtpEmail(email, OTP, user.name);
        } catch (emailError) {
            console.log('📧 Email error:', emailError.message);
        }

        if (emailSent) {
            console.log('✅ Email sent successfully');
            res.status(200).json({
                success: true,
                message: 'OTP sent to your email'
            });
        } else {
            console.log('⚠️ Email not sent, but OTP generated');
            res.status(200).json({
                success: true,
                message: 'OTP generated',
                otp: OTP // For testing
            });
        }

    } catch (error) {
        console.error('❌ Error in forgot password:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

exports.verifyOtp = async (req, res) => {
    try {
        const { email, OTP } = req.body;

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if OTP exists
        if (!user.resetOtp) {
            return res.status(400).json({
                success: false,
                message: 'No OTP requested'
            });
        }

        // Check OTP expiry
        if (user.otpExpiry < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'OTP expired'
            });
        }

        // Verify OTP (direct comparison)
        if (user.resetOtp != OTP) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP'
            });
        }

        // Clear OTP after verification
        user.resetOtp = null;
        user.otpExpiry = null;
        await user.save();

        return res.status(200).json({
            success: true,
            message: 'OTP verified successfully'
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// Change password
exports.changePassword = async (req, res) => {
    try {
        const { email, newPassword } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'User not found'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.updatedAt = new Date();
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({
            success: false,
            message: 'Error changing password'
        });
    }
};

// Get all users
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find()
            .select('-password -resetOtp -otpExpiry')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: 'Users fetched successfully',
            count: users.length,
            data: users
        });

    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching users'
        });
    }
};

exports.currentUser = async (req, res) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (token) {
            const decoded = jwt.decode(token);
        }
        const userId = req.user.id; 
        if (!userId) {
            return res.status(400).json({
                error: true,
                msg: "User ID not found in request"
            });
        }
        const user = await User.findById(userId).select('-password -__v');

        if (!user) {
            return res.status(404).json({
                error: true,
                msg: "User not found in database"
            });
        }

        // Safe check for name
        const userName = user.name || 'User';
        const userAvatar = user.avatar || (userName ? userName.charAt(0) : 'U');

        return res.status(200).json({
            error: false,
            msg: "Current user fetched successfully",
            result: {
                id: user._id,
                _id: user._id,
                name: userName,
                email: user.email || '',
                role: user.role || 'user',
                avatar: userAvatar,
                phone: user.phone || '',
                department: user.department || '',
                location: user.location || '',
                joinDate: user.createdAt || '',
                bio: user.about || user.bio || '',
                skills: user.skills || [],
                isActive: user.isActive !== false,
                assignedTasks: user.assignedTasks || 0,
                completedTasks: user.completedTasks || 0,
                pendingTasks: user.pendingTasks || 0,
                overdueTasks: user.overdueTasks || 0
            }
        });

    } catch (error) {
        console.error("❌ Current User Error:", error);
        return res.status(500).json({
            error: true,
            msg: "Internal server error",
            details: error.message
        });
    }
};

exports.approve = async (req, res) => {
    try {
        const { id } = req.params;
        const { completedApproval } = req.body;

        const task = await Task.findByIdAndUpdate(
            id,
            {
                completedApproval,
                ...(completedApproval && { status: 'completed' })
            },
            { new: true }
        );

        // History add karo
        if (completedApproval) {
            await TaskHistory.create({
                taskId: id,
                action: 'assigner_permanent_approved',
                description: 'Task PERMANENTLY approved by Assigner',
                userId: req.user.id,
                userName: req.user.name,
                userEmail: req.user.email,
                userRole: req.user.role
            });
        }

        res.json(task);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

