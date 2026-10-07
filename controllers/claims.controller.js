const User = require('../models/User.js');

const { getMSSQLPool, sql } = require('../configurations/database.configurations.js');

const getClaims = async (request, response, next) => {
    try {
        const { id } = request.params;

        const doctor = await User.findById(id);

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
                        a.FK_psPatRegisters,
                        b.fullname,
                        c.finaldiagcode,
                        c.finaldiagnosis,
                        c.dischdate,
                        a.pfamount,
                        a.otheramount,
                        a.netamount,
                        a.discount,
                        a.oramount,
                        a.instrumentfee,
                        a.phicamount,
                        a.gntramount,
                        a.phicservices,
                        ISNULL(
                            (SELECT SUM(cashamount) FROM faCRMstr WHERE FK_psPatRegisters = a.FK_psPatRegisters and cancelflag = 0), 0
                        ) AS cash_paid,
                        CAST(
                            CASE
                                WHEN EXISTS
                                (
                                    SELECT 1
                                    FROM faCRMstr f
                                    WHERE f.FK_psPatRegisters = a.FK_psPatRegisters
                                    AND f.cancelflag = 0
                                    AND f.cashamount > 0
                                    AND f.glpostflag = 1
                                )
                                THEN 1
                                ELSE 0
                            END
                        AS BIT) AS is_paid

                    FROM psDctrLedgers a
                    LEFT JOIN psDatacenter b ON b.PK_psDatacenter = a.FK_emdPatients
                    LEFT JOIN psPatRegisters c ON c.PK_psPatRegisters = a.FK_psPatRegisters
                    WHERE a.FK_emdDoctors = @doctorId
                    ORDER BY c.dischdate DESC
                `
            );

        const data = result.recordset;

        return response.status(200).json(data);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getClaims
};