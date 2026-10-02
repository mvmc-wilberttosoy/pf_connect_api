const FormData = require('form-data');
const Mailgun = require('mailgun.js');

const mailgun = new Mailgun(FormData);
const mg = mailgun.client({
    username: 'api',
    key: process.env.MAILGUN_API_KEY
});

const DOMAIN = process.env.MAILGUN_DOMAIN;

if (!process.env.MAILGUN_API_KEY || !DOMAIN) {
    throw new Error('Mailgun Environments Must Be Set');
};

const sendEmail = async ({ from, to, cc, bcc, subject, html }) => {
    try {
        const response = await mg.messages.create(DOMAIN, {
            from,
            to,
            cc,
            bcc,
            subject,
            html,
        });
        console.log(response);
    } catch (error) {
        throw new Error('Mailgun Error: ', error);
    }
};

module.exports = sendEmail;