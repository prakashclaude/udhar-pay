const jwt = require('jsonwebtoken');

const verifyAdmin = (req, res, next) => {
    // Auth middleware should have already populated req.user
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized: User not logged in' });
    }

    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
    }

    next();
};

module.exports = verifyAdmin;
