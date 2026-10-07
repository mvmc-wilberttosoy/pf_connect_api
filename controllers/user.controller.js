const userService = require('../services/user.service.js');

const createUser = async (req, res, next) => {
    try {
        await userService.createUser(req.body);
        return res.status(201).json({
            success: true,
            message: 'New User Created'
        });
    } catch (error) {
        next(error);
    }
};

const registerDoctor = async (req, res, next) => {
    try {
        await userService.registerDoctor(req.body);
        return res.status(201).json({
            success: true,
            message: 'New Doctor added and credentials sent via email.'
        });
    } catch (error) {
        next(error);
    }
};

const getDoctorProfile = async (req, res, next) => {
    try {
        const profile = await userService.getDoctorProfile(req.params.id);
        return res.status(200).json(profile);
    } catch (error) {
        next(error);
    }
};

const getDoctors = async (req, res, next) => {
    try {
        const doctors = await userService.getDoctors();
        return res.status(200).json(doctors);
    } catch (error) {
        next(error);
    }
};

const updateOppPoints = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { oppPoints } = req.body;
        await userService.updateOppPoints(id, oppPoints);
        return res.status(200).json({
            success: true,
            message: 'Update Successful'
        });
    } catch (error) {
        next(error);
    }
};

const bulkUpdatePoints = async (req, res, next) => {
    try {
        const { users } = req.body;
        const modifiedCount = await userService.bulkUpdatePoints(users);
        return res.status(200).json({
            success: true,
            message: 'Successfully updated user records.',
            modifiedCount
        });
    } catch (error) {
        next(error);
    }
};

const requestChange = async (req, res, next) => {
    try {
        const {
            doctor_name: doctorName,
            email: doctorEmail,
            specialization: doctorSpecialization
        } = req.body;

        await userService.requestChange({ doctorName, doctorEmail, doctorSpecialization });

        return res.status(200).json({
            success: true,
            message: 'Profile update request submitted successfully to Admin.'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createUser,
    registerDoctor,
    getDoctorProfile,
    getDoctors,
    updateOppPoints,
    bulkUpdatePoints,
    requestChange
};