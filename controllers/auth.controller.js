const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const crypto = require('node:crypto');
const { getMSSQLPool, sql } = require('../configurations/database.configurations.js');

const User = require('../models/User.js');
const sendEmail = require('../services/mailgun.services.js');

const login = async (request, response, next) => {
    try {
        const { email, password } = request.body;

        const user = await User.findOne({ email });
        if (!user) {
            return response.status(404).json({
                success: false,
                message: 'Invalid Credentials'
            });
        }

        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            return response.status(404).json({
                success: false,
                message: 'Invalid Credentials'
            });
        }

        if (user.role === 'Doctor') {
            const pool = getMSSQLPool();
            const result = await pool.request()
                .input('doctorId', sql.Int, user.doctorsId)
                .query(
                    `
                    SELECT 
                        * 
                    FROM emdDoctors
                    WHERE emdDoctors.PK_emdDoctors = @doctorId
                `
                );

            const doctor = result.recordset[0];

            if (doctor.active === false) {
                user.isActive = false;
                await user.save();

                return response.status(400).json({
                    success: false,
                    message: 'Inactive Account, Please contact Medical Records'
                });
            }
        }

        const accessToken = jwt.sign(
            { user_id: user._id, role: user.role, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        const refreshToken = jwt.sign(
            { user_id: user._id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '1d' }
        );

        response.cookie('refresh', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });

        return response.status(200).json({
            success: true,
            message: 'Login Successful',
            accessToken
        });
    } catch (error) {
        next(error);
    }
};

const refresh = async (request, response, next) => {
    try {
        const cookies = request.cookies.refresh;

        if (!cookies) {
            return response.status(401).json({
                success: false,
                message: 'No Refresh Token Provided'
            });
        }

        const decoded = jwt.verify(cookies, process.env.JWT_REFRESH_SECRET);
        if (!decoded) {
            return response.status(401).json({
                success: false,
                message: 'Invalid Refresh Token'
            });
        }

        const user = await User.findById(decoded.user_id);
        if (!user) {
            return response.status(404).json({
                success: false,
                message: 'Resource Not Found'
            });
        }

        const accessToken = jwt.sign(
            { user_id: user._id, role: user.role, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        return response.status(200).json({ accessToken });
    } catch (error) {
        next(error);
    }
};

const logout = async (request, response, next) => {
    try {
        response.clearCookie(
            'refresh',
            {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax'
            }
        );
        return response.status(200).json({
            success: true,
            message: 'Logged Out Successful'
        });
    } catch (error) {
        next(error);
    }
};

const forgotPassword = async (request, response, next) => {
    try {
        const { email } = request.body;

        if (!email) {
            return response.status(400).json({
                success: false,
                message: 'Please provide an email'
            });
        }

        const user = await User.findOne({ email, isActive: true });

        // Security response: Return success even if user isn't found
        if (!user) {
            return response.status(200).json({
                success: true,
                message: 'If an account with that email exists, a reset link has been sent'
            });
        }

        // 1. Generate unhashed token for URL
        const resetToken = crypto.randomBytes(32).toString('hex');

        // 2. Set hashed token and expiration on user instance
        user.resetPasswordToken = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');

        user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes expiration

        // 3. Save user token and expiry to MongoDB
        await user.save({ validateBeforeSave: false });

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

        const htmlMessage = `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2>PFConnect Password Reset</h2>
                <p>You requested a password reset. Please click the button below to reset your password:</p>
                <p style="margin: 20px 0;">
                    <a href="${resetUrl}" style="background-color: #01a987; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        Reset Password
                    </a>
                </p>
                <p>Or copy and paste this link into your browser:</p>
                <p><a href="${resetUrl}">${resetUrl}</a></p>
                <p><em>This link will expire in 15 minutes.</em></p>
                <p>If you did not request this, please ignore this email.</p>
            </div>
        `;

        try {
            const send = await sendEmail({
                from: 'pfconnect@marikinavalley.net',
                // to: user.email,
                to: 'ictdev@mvmc.com.ph',
                subject: 'PFConnect - Password Reset Request',
                html: htmlMessage
            });

            console.log('Mailgun Response:', send);

            return response.status(200).json({
                success: true,
                message: 'If an account with that email exists, a reset link has been sent'
            });
        } catch (emailError) {
            // Rollback token fields in DB if email sending fails
            user.resetPasswordToken = null;
            user.resetPasswordExpires = null;
            await user.save({ validateBeforeSave: false });

            console.error('Email sending failed:', emailError);
            return response.status(500).json({
                success: false,
                message: 'Email could not be sent'
            });
        }
    } catch (error) {
        next(error);
    }
};

const verifyToken = async (request, response, next) => {
    try {
        const { token } = request.params;

        if (!token) {
            return response.status(400).json({ success: false, message: 'Token is missing' });
        }

        // Hash incoming URL token to compare with hashed value in DB
        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return response.status(400).json({
                success: false,
                message: 'This password reset link has expired or is invalid.'
            });
        }

        return response.status(200).json({
            success: true,
            message: 'Token is valid'
        });
    } catch (error) {
        next(error);
    }
};

const resetPassword = async (request, response, next) => {
    try {
        const { token } = request.params;
        const { password } = request.body;

        if (!password) {
            return response.status(400).json({
                success: false,
                message: 'Please provide a new password'
            });
        }

        // Hash incoming URL token
        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        // Find user by hashed token and check expiry
        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return response.status(400).json({
                success: false,
                message: 'Password reset link is invalid or has expired.'
            });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        // Clear token fields so link cannot be re-used
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        return response.status(200).json({
            success: true,
            message: 'Password reset successful'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    login,
    refresh,
    logout,
    forgotPassword,
    verifyToken,
    resetPassword
};