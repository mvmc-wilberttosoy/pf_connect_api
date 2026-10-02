const mongoose = require('mongoose');
const sql = require('mssql');

const connectMongoDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('MongoDB Connection Failed: ', error);
        process.exit(1);
    }
};

const mssqlConfiguration = {
    user: process.env.MSSQL_USERNAME,
    password: process.env.MSSQL_PASSWORD,
    server: process.env.MSSQL_SERVER,
    database: process.env.MSSQL_DATABASE,
    options: {
        encrypt: true,
        trustServerCertificate: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let mssqlPool;

const connectMSSQL = async () => {
    try {
        mssqlPool = await sql.connect(mssqlConfiguration);
        console.log('MSSQL Connected Successfully');
        return mssqlPool;
    } catch (error) {
        console.error('MSSQL Connection Error: ', error.message);
        process.exit(1);
    }
};

const getMSSQLPool = () => {
    if (!mssqlPool) {
        throw new Error('MSSQL Pool has not been initialized');
    }
    return mssqlPool;
};

module.exports = {
    connectMongoDB,
    connectMSSQL,
    getMSSQLPool,
    sql
};