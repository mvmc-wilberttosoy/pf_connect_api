const AppError = require('../utilities/application.error.js');

function notFoundHandler(request, response, next) {
    const error = new AppError(`Cannot find ${request.originalUrl} on this server!`, 404);
    next(error);
}

function globalErrorHandler(err, req, res, next) {
    const statusCode = err.statusCode || 500;

    if (process.env.NODE_ENV !== "production") {
        console.error(err.stack);
    }

    let clientMessage = err.message || "Internal Server Error";
    if (statusCode === 500 && process.env.NODE_ENV === "production") {
        clientMessage = "Something went wrong on our end.";
    }

    const response = {
        success: false,
        error: clientMessage
    };

    if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "uat") {
        response.stack = err.stack;
    }

    res.status(statusCode).json(response);
}

module.exports = {
    notFoundHandler,
    globalErrorHandler
};