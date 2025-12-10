const express = require('express');
const {
    registerUser,
    loginUser,
    forgetPassword,
    verifyOtp,
    changePassword,
    getAllUsers,
    currentUser
} = require('../../Controller/user.controller');
const authMiddleware = require('../../middleware/auth.middleware');

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgetPassword', forgetPassword);
router.post('/verifyOtp', verifyOtp);
router.post('/change-password', changePassword);
router.get('/getAllUsers', getAllUsers);
router.get('/currentUser',authMiddleware,currentUser);

module.exports = router;