import * as nodemailer from "nodemailer";
import nodemailerConfig from "./nodemailerConfig";

const sendEmail = async (email: string, subject: string, html: string) => {
  let testAccount = await nodemailer.createTestAccount();

  // create reusable transporter object using the default SMTP transport
  let transporter = nodemailer.createTransport(nodemailerConfig);

  // send mail with defined transport object
  return transporter.sendMail({
    from: '"ETravel 👻" <etravel@gmail.com>', // sender address
    to: email, // list of receivers
    subject: subject, // Subject line
    html: html, // html body
  });
};

export default sendEmail;
