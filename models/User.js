const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true
        },
        password: {
            type: String,
            required: true
        },
        role: {
            type: String,
            enum: ['Admin', 'Doctor'],
            default: 'Doctor'
        },
        doctorsId: {
            type: Number,
            default: null
        },
        isActive: {
            type: Boolean,
            default: true
        },
        oppPoints: {
            type: Number,
            default: 0,
            min: 0
        },
        resetPasswordToken: {
            type: String,
            default: null
        },
        resetPasswordExpires: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('User', userSchema);