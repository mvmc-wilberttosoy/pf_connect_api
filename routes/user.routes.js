const router = require('express').Router();
const {
    createUser,
    registerDoctor,
    getDoctorProfile,
    getDoctors,
    updateOppPoints,
    bulkUpdatePoints,
    requestChange
} = require('../controllers/user.controller.js');

router.post('/v1/create/user', createUser);
router.post('/v1/create/doctor', registerDoctor);
router.get('/v1/fetch/doctor/profile/:id', getDoctorProfile);
router.get('/v1/get/users', getDoctors);
router.patch('/v1/update/user/:id', updateOppPoints);
router.patch('/v1/bulk-update-points', bulkUpdatePoints);
router.patch('/v1/update/profile', requestChange);

module.exports = router;