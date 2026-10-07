const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');
const BIR2307Document = require('../models/BIR2307Document');

const router = express.Router();

cloudinary.config({
    cloud_name: "dq2taov0j",
    api_key: 842545889251771,
    api_secret: "HPI22Aw2zP8k725EkubJ3x_FjBA"
});

// Configure Multer for In-Memory Storage
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB file limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF documents are allowed!'), false);
        }
    },
});

/**
 * POST /api/bir2307/v1/upload
 * Multer parses the multipart upload, buffers the file, streams it to Cloudinary,
 * and saves metadata to MongoDB.
 */
router.post('/v1/upload', upload.single('pdf'), async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { doctorId } = req.body;

        if (!req.file) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'No PDF file provided.',
            });
        }

        if (!doctorId) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Doctor ID is required.',
            });
        }

        // Upload buffer to Cloudinary using upload_stream (optimally handles streams & buffers)
        const cloudinaryResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'PFConnect/uat',
                    resource_type: 'raw',
                    // use_filename: true,
                    // unique_filename: true,
                },
                (error, result) => {
                    if (error) {
                        console.error('Cloudinary Detailed Error:', error); // <-- Check terminal console output
                        return reject(error);
                    }
                    resolve(result);
                }
            );
            uploadStream.end(req.file.buffer);
        });

        // Calculate formatted file size
        const fileSizeFormatted = `${(req.file.size / (1024 * 1024)).toFixed(2)} MB`;

        // Save record to MongoDB within transaction
        const createdDocs = await BIR2307Document.create(
            [
                {
                    doctorId,
                    fileName: req.file.originalname,
                    fileUrl: cloudinaryResult.secure_url,
                    cloudinaryPublicId: cloudinaryResult.public_id,
                    fileSize: fileSizeFormatted,
                },
            ],
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        return res.status(201).json({
            success: true,
            data: createdDocs[0],
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        return next(error);
    }
});

/**
 * GET /api/bir2307/v1/doctor/:doctorId
 * Retrieves all BIR 2307 documents for a doctor
 */
router.get('/v1/doctor/:doctorId', async (req, res, next) => {
    try {
        const { doctorId } = req.params;

        if (!doctorId) {
            return res.status(400).json({
                success: false,
                message: 'Doctor ID is required',
            });
        }

        const docs = await BIR2307Document.find({ doctorId }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: docs.length,
            data: docs,
        });
    } catch (error) {
        return next(error);
    }
});

/**
 * DELETE /api/bir2307/v1/delete/:id
 * Removes record from MongoDB and raw asset from Cloudinary
 */
router.delete('/v1/delete/:id', async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const doc = await BIR2307Document.findById(req.params.id).session(session);

        if (!doc) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: 'Document not found',
            });
        }

        await BIR2307Document.findByIdAndDelete(req.params.id, { session });

        await session.commitTransaction();
        session.endSession();

        // Cloudinary cleanup after database commit
        await cloudinary.uploader.destroy(doc.cloudinaryPublicId, {
            resource_type: 'raw',
            invalidate: true,
        });

        return res.status(200).json({
            success: true,
            message: 'Document deleted successfully',
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        return next(error);
    }
});

module.exports = router;