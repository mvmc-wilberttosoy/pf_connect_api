const router = require('express').Router();
const {
    login,
    logout,
    refresh,
    forgotPassword,
    verifyToken,
    resetPassword
} = require('../controllers/auth.controller.js');

router.post('/v1/login', login);
router.post('/v1/logout', logout);
router.post('/v1/refresh', refresh);
router.post('/v1/forgot-password', forgotPassword);
router.get('/v1/verify-reset-token/:token', verifyToken);
router.patch('/v1/reset-password/:token', resetPassword);

module.exports = router;