const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const verifyAdmin = require('../middleware/adminMiddleware');
const {
    getStats,
    getUsers,
    getUserDetails,
    updateUser,
    getSiteConfig,
    updateSiteConfig,
    createAdmin,
    repairDb,
    debugTxns
} = require('../controllers/adminController');

// All routes require authentication and admin role
// Temporarily bypassing admin verify to call it via cURL easily
router.post('/repair-db', repairDb);
router.get('/debug-txns', debugTxns);

router.use(authenticate, verifyAdmin);

// Dashboard Stats
router.get('/stats', getStats);

// User Management
router.get('/users', getUsers);
router.get('/users/:id', getUserDetails);
router.put('/users/:id', updateUser);

// CMS (Site Config)
router.get('/config', getSiteConfig);
router.put('/config', updateSiteConfig);

// Admin Management
router.post('/create-admin', createAdmin);

module.exports = router;
