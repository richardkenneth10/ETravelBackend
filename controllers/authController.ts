import { Request, Response } from "express";
import connectDB from "../db/connect";
import { CustomAPIError, BadRequestError } from "../errors";
import Client from "twilio";
import otpGenerator from "otp-generator";
import GoogleAPIs from "googleapis";

const accountSid = "ACe67c06e0c404876aece36ed1c22c85ab";
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = Client(accountSid, authToken);

const loginWithPhone = async (req: Request, res: Response) => {
  const { name, email, password, phone } = req.body;
  if (!phone) {
    throw new BadRequestError("Phone number is required");
  }
  const con = await connectDB();

  const otp = otpGenerator.generate(6, {
    digits: false,
    specialChars: false,
  });

  const tenMinutes = 1000 * 60 * 10;
  const tenMinutesFromNow = new Date().getTime() + tenMinutes;
  const tenMinutesDateTimeFromNow = new Date(tenMinutesFromNow);

  const message = await client.messages.create({
    body: `Hello from ETravel. Your verification code is ${otp}. It expires in 10 minutes. Do not disclose to anyone`,
    from: "ETravel",
    to: "+2349039367642",
  });
  console.log(message.sid);

  con.query(
    "SELECT * FROM users WHERE phone = ?",
    [phone],
    async (err, resp) => {
      if (err) {
        return res.status(500).send("Database error");
      }

      const user = resp[0];

      if (user) {
        con.query(
          "UPDATE users SET otp = ?, otp_expiration_datetime = ? WHERE id = ?",
          [otp, tenMinutesDateTimeFromNow, user.id],
          async (err, resp2) => {
            if (err) {
              return res.status(500).send("Database error");
            }

            return res.send("OTP sent");
          }
        );
        return;
      }

      con.query(
        "INSERT INTO users (phone, otp, otp_expiration_datetime) VALUES (?, ?, ?)",
        [phone, otp, tenMinutesDateTimeFromNow],
        async (err, resp2) => {
          if (err) {
            return res.status(500).send("Database error");
          }

          return res.status(201).send("OTP sent");
        }
      );
    }
  );
};
const verifyPhone = async (req: Request, res: Response) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    throw new BadRequestError("Phone number and OTP are required");
  }

  const con = await connectDB();
  con.query(
    "SELECT * FROM users WHERE phone = ?",
    [phone],
    async (err, resp) => {
      if (err) {
        return res.status(500).send("Database error");
      }

      const noUser = resp.length === 0;

      if (noUser) {
        return res.status(400).send(`No user with phone ${phone}`);
      }

      const isValidOTP =
        resp[0].otp === otp &&
        new Date(resp[0].otp_expiration_datetime).getTime() >
          new Date().getTime();

      if (!isValidOTP) {
        return res.status(400).send(`Invalid credentials`);
      }

      con.query(
        "UPDATE users SET otp = NULL, otp_expiration_datetime = NULL WHERE id = ?",
        [resp[0].id],
        async (err, resp) => {
          if (err) {
            return res.status(500).send("Database error");
          }

          res.send("Phone number verified");
        }
      );
    }
  );
};

const loginWithGoogle = async (req: Request, res: Response) => {
  const { accessToken } = req.body;

  if (accessToken) {
    throw new BadRequestError("Access token is required");
  }
  const google = GoogleAPIs.google;

  var OAuth2 = google.auth.OAuth2;
  var oauth2Client = new OAuth2();
  oauth2Client.setCredentials({ access_token: "ACCESS TOKEN HERE" });
  var oauth2 = google.oauth2({
    auth: oauth2Client,
    version: "v2",
  });
  oauth2.userinfo.get(function (err, res) {
    if (err) {
      console.log(err);
    } else {
      console.log(res);
    }
  });
  res.send("get token from google sign in");
};

export { loginWithPhone, verifyPhone, loginWithGoogle };
