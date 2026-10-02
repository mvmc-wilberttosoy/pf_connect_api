const router = require('express').Router();
const {
    getClaims
} = require('../controllers/claims.controller.js');

router.get('/v1/fetch/claim/:id', getClaims);

module.exports = router;