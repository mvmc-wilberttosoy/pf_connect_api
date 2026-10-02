const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

const { getMSSQLPool, sql } = require('../configurations/database.configurations.js');
const User = require('../models/User.js');
const sendEmail = require('../services/mailgun.services.js');

const createUser = async (request, response, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { email, role } = request.body;

        if (!email) {
            return response.status(400).json({
                success: false,
                message: 'Provide all required fields'
            });
        };

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return response.status(409).json({
                success: false,
                message: 'Provide all required fields'
            });
        };

        const hashed = await bcrypt.hash('123', 10);

        const newUser = new User({
            email: email.toLowerCase(),
            password: hashed,
            role: role || 'Doctor'
        });
        await newUser.save({ session });

        await session.commitTransaction();
        return response.status(201).json({
            success: true,
            message: 'New User Created'
        })
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

const registerDoctor = async (request, response, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { email } = request.body;

        const pool = getMSSQLPool();
        const result = await pool.request()
            .input('email', sql.VarChar(255), `${email}`)
            .query(
                `
                    SELECT 
                        psDatacenter.PK_psDatacenter,
                        psDatacenter.email,
                        emdDoctors.active
                    FROM psDatacenter
                    INNER JOIN emdDoctors ON emdDoctors.PK_emdDoctors = psDatacenter.PK_psDatacenter
                    WHERE psDatacenter.email = @email
                `
            );

        const doctors = result.recordset;

        if (doctors.length === 0) {
            return response.status(404).json({
                success: false,
                message: 'No record found matching the provided email'
            });
        }

        if (doctors.length > 1) {
            return response.status(400).json({
                success: false,
                message: 'Duplicate Resource Found'
            });
        }

        const doctor = doctors[0];

        console.log(doctor);

        if (doctor.active === false) {
            return response.status(400).json({
                success: false,
                message: 'Inactive Account, Please contact Medical Records'
            });
        }

        const existingDoctor = await User.findOne({ doctorsId: doctor.PK_psDatacenter });
        if (existingDoctor) {
            return response.status(400).json({
                success: false,
                message: 'Resource Already Exists'
            });
        }

        // Generate random password
        length = 8;
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const numbers = '0123456789';
        const specialChars = '!@#$?';

        const allCharacters = lowercase + uppercase + numbers + specialChars;

        let randomPassword = '';
        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * allCharacters.length);
            randomPassword = randomPassword + allCharacters[randomIndex];
        }

        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        const newDoctor = new User({
            email: doctor.email,
            password: hashedPassword,
            role: 'Doctor',
            doctorsId: doctor.PK_psDatacenter
        });

        // Save inside MongoDB Transaction
        await newDoctor.save({ session });

        // Build HTML Email Template
        const portalUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const htmlMessage = `
            <div style="font-family: Arial, sans-serif; max-width: 500px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
                <h2 style="color: #0f172a; margin-top: 0;">Welcome to PFConnect</h2>
                <p style="color: #475569; font-size: 14px; line-height: 1.5;">
                    Your account has been successfully created. You can log in using your registered email and the temporary password provided below:
                </p>
                <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #cbd5e1; margin: 20px 0; text-align: center;">
                    <span style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 4px;">Temporary Password</span>
                    <strong style="font-size: 18px; color: #01a987; font-family: monospace;">${randomPassword}</strong>
                </div>
                <p style="color: #475569; font-size: 13px; line-height: 1.5;">
                    For security purposes, please log in and change your password immediately.
                </p>
                <div style="margin-top: 24px; text-align: center;">
                    <a href="${portalUrl}" style="background-color: #01a987; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
                        Log In to Portal
                    </a>
                </div>
            </div>
        `;

        // Send Email via Mailgun service
        await sendEmail({
            from: 'pfconnect@marikinavalley.net',
            // to: doctor.email,
            to: 'ictdev@mvmc.com.ph',
            subject: 'PFConnect - Your Account Registration Credentials',
            html: htmlMessage
        });

        // Commit transaction ONLY after email is successfully sent
        await session.commitTransaction();

        return response.status(201).json({
            success: true,
            message: 'New Doctor added and credentials sent via email.'
        });

    } catch (error) {
        // Abort MongoDB session if DB save OR email dispatch fails
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};


const getDoctorProfile = async (request, response, next) => {
    try {
        const { id } = request.params;

        const doctor = await User.findById(id).select('-password');

        if (!doctor) {
            return response.status(404).json({
                success: false,
                message: 'Resource Not Found'
            });
        };

        const pool = getMSSQLPool();
        const result = await pool.request()
            .input('doctorId', sql.Int, doctor.doctorsId)
            .query(
                `
                    SELECT 
                        a.PK_emdDoctors AS doctor_id,
                        b.customname AS doctor_name,
                        g.birthdate,
                        g.gender,
                        g.firstname AS first_name,
                        g.lastname AS last_name,
                        b.email,
                        a.smsplusmobileno,
                        c.description AS specialization,
                        d.description AS service_type,
                        a.tin AS tin,
                        a.pmccno AS pmcc,
                        a.phicno AS phic,
                        a.phicexpdate AS phic_expiry_date,
                        a.phicissuancedate AS phic_issuance_date,
                        e.description AS phic_pf_group,
                        a.prcno AS prc,
                        a.PRCtype AS prc_type,
                        a.prcexpdate AS prc_expiry_date,
                        a.dctrcategory AS ptrc_category,
                        f.description AS ptrc_category_description,
                        a.smsplusmobileno AS mobile_number,
                        a.ptrno AS ptr,
                        a.s2no AS s2,
                        a.s2expirydate AS s2_expiry_date,
                        a.pfvatrate AS pf_vat_rate,
                        a.rfvatrate AS rf_vat_rate,
                        a.ewtrate AS ewt_rate,
                        a.vatcondition AS vat_condition,
                        a.bankacctname,
                        a.bankacctno,
                        a.active AS is_active
                    FROM emdDoctors a
                    LEFT JOIN psDatacenter b ON b.PK_psDatacenter = a.PK_emdDoctors
                    LEFT JOIN emdTempSpecializations c ON c.PK_emdTempSpecializations = a.FK_emdTempSpecializations
                    LEFT JOIN mscServiceType d ON d.PK_mscServiceType = a.FK_mscServiceType
                    LEFT JOIN psPHICPFGroup e ON e.PK_psPHICPFGroup = a.FK_psPHICPFGroup
                    LEFT JOIN emdTempDoctorCategory f ON f.PK_emdTempDoctorCategory = a.dctrcategory
                    LEFT JOIN psPersonaldata g ON a.PK_emdDoctors = g.PK_psPersonaldata
                    LEFT JOIN mscServiceType2 h ON h.FK_mscServiceType = d.PK_mscServiceType
                    WHERE a.PK_emdDoctors = @doctorId
                `
            );

        const sqlData = result.recordset[0] || {};
        const doctorObj = doctor.toObject ? doctor.toObject() : doctor; // Convert Mongoose document to plain JS object

        // Combine both objects into a single object
        const combinedDoctorProfile = {
            ...doctorObj,
            ...sqlData
        };

        return response.status(200).json(combinedDoctorProfile);
    } catch (error) {
        next(error);
    }
}



const getDoctors = async (request, response, next) => {
    try {
        const doctors = await User.find({ role: 'Doctor' }).select('-password');

        if (!doctors || doctors.length === 0) {
            return response.status(404).json({ message: 'No Doctor Yet' });
        }

        // 1. Collect all valid MSSQL doctor IDs from the Mongo users
        const doctorIds = doctors
            .map((doc) => doc.doctorsId)
            .filter((id) => id !== undefined && id !== null);

        let mssqlDataMap = new Map();

        if (doctorIds.length > 0) {
            const pool = getMSSQLPool();
            const req = pool.request();

            // Create parameter names dynamically (@id0, @id1, ...)
            const paramNames = doctorIds.map((id, index) => {
                const param = `id${index}`;
                req.input(param, sql.Int, id);
                return `@${param}`;
            });

            const query = `
                SELECT 
                    a.PK_emdDoctors AS doctor_id,
                    b.customname AS doctor_name,
                    g.birthdate,
                    g.gender,
                    g.firstname AS first_name,
                    g.lastname AS last_name,
                    b.email,
                    a.smsplusmobileno,
                    c.description AS specialization,
                    d.description AS service_type,
                    a.tin AS tin,
                    a.pmccno AS pmcc,
                    a.phicno AS phic,
                    a.phicexpdate AS phic_expiry_date,
                    a.phicissuancedate AS phic_issuance_date,
                    e.description AS phic_pf_group,
                    a.prcno AS prc,
                    a.PRCtype AS prc_type,
                    a.prcexpdate AS prc_expiry_date,
                    a.dctrcategory AS ptrc_category,
                    f.description AS ptrc_category_description,
                    a.smsplusmobileno AS mobile_number,
                    a.ptrno AS ptr,
                    a.s2no AS s2,
                    a.s2expirydate AS s2_expiry_date,
                    a.pfvatrate AS pf_vat_rate,
                    a.rfvatrate AS rf_vat_rate,
                    a.ewtrate AS ewt_rate,
                    a.vatcondition AS vat_condition,
                    a.bankacctname,
                    a.bankacctno,
                    a.active AS is_active
                FROM emdDoctors a
                LEFT JOIN psDatacenter b ON b.PK_psDatacenter = a.PK_emdDoctors
                LEFT JOIN emdTempSpecializations c ON c.PK_emdTempSpecializations = a.FK_emdTempSpecializations
                LEFT JOIN mscServiceType d ON d.PK_mscServiceType = a.FK_mscServiceType
                LEFT JOIN psPHICPFGroup e ON e.PK_psPHICPFGroup = a.FK_psPHICPFGroup
                LEFT JOIN emdTempDoctorCategory f ON f.PK_emdTempDoctorCategory = a.dctrcategory
                LEFT JOIN psPersonaldata g ON a.PK_emdDoctors = g.PK_psPersonaldata
                LEFT JOIN mscServiceType2 h ON h.FK_mscServiceType = d.PK_mscServiceType
                WHERE a.PK_emdDoctors IN (${paramNames.join(',')})
            `;

            const result = await req.query(query);

            // 2. Map results by doctor_id for fast O(1) lookup
            result.recordset.forEach((row) => {
                mssqlDataMap.set(row.doctor_id, row);
            });
        }

        // 3. Merge Mongo user object with matching MSSQL data
        const combinedDoctors = doctors.map((doc) => {
            const doctorObj = doc.toObject ? doc.toObject() : doc;
            const sqlData = mssqlDataMap.get(doctorObj.doctorsId) || {};

            return {
                ...doctorObj,
                ...sqlData
            };
        });

        return response.status(200).json(combinedDoctors);
    } catch (error) {
        next(error);
    }
};


const updateOppPoints = async (request, response, next) => {

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = request.params;
        const { oppPoints } = request.body;

        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return response.status(400).json({ success: false, message: 'Invalid Resource Id' });
        };

        const user = await User.findByIdAndUpdate(id, { oppPoints: oppPoints }, { session });
        if (!user) {
            await session.abortTransaction();
            await session.endSession();
            return response.status(404).json({ success: false, message: 'Resource Not Found' });
        };

        await session.commitTransaction();
        return response.status(200).json({ success: true, message: 'Update Successful' });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        await session.endSession();
    }
}

const bulkUpdatePoints = async (request, response, next) => {
    try {
        const { users } = request.body;

        if (!Array.isArray(users) || users.length === 0) {
            return response.status(400).json({
                success: false,
                message: 'No user updates provided in request body'
            });
        };

        console.log(users);

        // Map payload into MongoDB bulkWrite operations
        const bulkOperations = users.map((user) => {
            const pointsNum = Number(user.newPoints);

            if (isNaN(pointsNum) || pointsNum < 0) {
                throw new Error(`Invalid points value for user ID: ${user.doctorsId}`);
            };

            return {
                updateOne: {
                    filter: { _id: user.id },
                    update: { $set: { oppPoints: pointsNum } }
                }
            };
        });

        const bulkResult = await User.bulkWrite(bulkOperations);

        return response.status(200).json({
            success: true,
            message: `Successfully updated user records.`,
            modifiedCount: bulkResult.modifiedCount
        });
    } catch (error) {
        next(error);
    }
}

const requestChange = async (request, response, next) => {
    try {
        // Extract doctor request details from body
        console.log(request.body);

        const {
            doctor_name: doctorName,
            email: doctorEmail,
            specialization: doctorSpecialization,
        } = request.body;

        const portalUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

        // Build Admin Notification HTML Template
        const htmlMessage = `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 550px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
                <!-- Header Badge -->
                <div style="margin-bottom: 16px;">
                    <span style="background-color: #e0f2fe; color: #0369a1; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 9999px; letter-spacing: 0.05em;">
                        Profile Update Request
                    </span>
                </div>

                <h2 style="color: #0f172a; margin: 0 0 8px 0; font-size: 20px;">Doctor Profile Change Requested</h2>
                <p style="color: #64748b; font-size: 14px; margin: 0 0 20px 0;">
                    A doctor has submitted a request to update their profile information on <strong>PFConnect</strong>. Please review the details below.
                </p>

                <!-- Doctor Details Card -->
                <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 16px;">
                    <div style="margin-bottom: 10px;">
                        <span style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; display: block;">Doctor Name</span>
                        <strong style="font-size: 15px; color: #0f172a;">${doctorName || 'Not Provided'}</strong>
                    </div>
                    <div style="margin-bottom: 10px;">
                        <span style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; display: block;">Email Address</span>
                        <span style="font-size: 14px; color: #01a987; font-weight: 600;">${doctorEmail || 'Not Provided'}</span>
                    </div>
                    <div>
                        <span style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; display: block;">Specialization</span>
                        <span style="font-size: 14px; color: #334155;">${doctorSpecialization || 'N/A'}</span>
                    </div>
                </div>
            </div>
        `;

        // Send Email via Mailgun service
        await sendEmail({
            from: 'PFConnect Portal <pfconnect@marikinavalley.net>',
            to: 'ictdev@mvmc.com.ph',
            subject: `[PFConnect] Profile Update Request - ${doctorName || 'Doctor'}`,
            html: htmlMessage
        });

        return response.status(200).json({
            success: true,
            message: 'Profile update request submitted successfully to Admin.'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createUser,
    registerDoctor,
    getDoctorProfile,
    getDoctors,
    updateOppPoints,
    bulkUpdatePoints,
    requestChange
};