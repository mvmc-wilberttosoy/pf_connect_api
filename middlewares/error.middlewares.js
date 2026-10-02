// errorHandler.js
function globalErrorHandler(err, req, res, next) {
    const statusCode = err.statusCode || 500;

    // Log full stack trace for server-side debugging
    if (process.env.NODE_ENV !== "production") {
        console.error(err.stack);
    }

    // Prepare response
    const response = {
        success: false,
        error: err.message || "Internal Server Error"
    };

    // Include stack trace in response only in non-production environments
    if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "uat") {
        response.stack = err.stack;
    }

    res.status(statusCode).json(response);
}

module.exports = globalErrorHandler;