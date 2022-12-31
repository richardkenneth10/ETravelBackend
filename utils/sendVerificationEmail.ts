import sendEmail from "./sendEmail";

export default async ({
  name,
  email,
  verificationToken,
  origin,
}: {
  name: string;
  email: string;
  verificationToken: string;
  origin: string;
}) => {
  const message = `<h1>Kindly click on the link to verify your email: <a href="${origin}/driver/verify-email?token=${verificationToken}&email=${email}">Verify Email</a></h1>`;

  await sendEmail(email, `Hello, ${name}`, message);
};
