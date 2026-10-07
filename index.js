require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { connectMongoDB, connectMSSQL } = require('./configurations/database.configurations.js');
const { notFoundHandler, globalErrorHandler } = require('./middlewares/error.middlewares.js');
const corsOptions = require('./configurations/cors.configurations.js');

const application = express();
const PORT = process.env.PORT || 5000;

application.use(cors(corsOptions));
application.use(express.json());
application.use(express.urlencoded({ extended: true }));
application.use(cookieParser());

application.use('/api/auth', require('./routes/auth.routes.js'));
application.use('/api/users', require('./routes/user.routes.js'));
application.use('/api/claims', require('./routes/claim.routes.js'));
application.use('/api/bir2307', require('./routes/bir2307.routes.js'));

application.use(notFoundHandler);
application.use(globalErrorHandler);
const startServer = async () => {
    try {
        await connectMongoDB();
        await connectMSSQL();

        application.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        })
    } catch (error) {
        console.error('Failed to start server: ', error);
        process.exit(1);
    }
};

startServer();