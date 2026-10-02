const jwt = require('jsonwebtoken');

const authenticate = (request, response, next) => {
    const token = request.headers['authorization']?.split(' ')[1];

    if (!token) {
        return response.status(401).json({
            success: false,
            message: 'No Token Provided'
        });
    };

    jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
        if (error) {
            if (error.name === 'TokenExpiredError') {
                return response.status(401).json({ success: false, message: 'Token Expired' });
            };
            return response.status(403).json({ success: false, message: 'Invalid Token' });
        };

        request.user = decoded;
        next();
    });
};

const authorize = (roles) => {
    return (request, response, next) => {
        const userRole = request.user && request.user.role;

        if (!userRole) {
            return response.status(403).json({ success: false, message: 'Access Denied: No Role Found' });
        };

        if (!roles.includes(userRole)) {
            return response.status(403).json({ success: false, message: 'Access Denied: Insufficient Permissions' });
        };

        next();
    }
}

module.exports = { authenticate, authorize };