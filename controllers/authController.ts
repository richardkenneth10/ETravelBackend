import { Request, RequestHandler, Response } from "express";
import connectDB from "../db/connect";
import {
  CustomAPIError,
  BadRequestError,
  UnauthenticatedError,
  NotFoundError,
} from "../errors";
const Client = require("twilio");
import axios from "axios";
import { createAccessJWT, createRefreshJWT } from "../utils/jwt";
import crypto from "crypto";
import bcrypt from "bcrypt";
import createTokenUser from "../utils/createTokenUser";
import { StatusCodes } from "http-status-codes";
import sendVerificationEmail from "../utils/sendVerificationEmail";
import { origin } from "../utils/appConstants";
import {
  sendDriverTokenWithResponse,
  sendTokenWithResponse,
} from "../utils/sendTokenWithResponse";

const accountSid = "AC7d60c28d42446c12bb412c9a1f10d19f";
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = Client(accountSid, authToken);

const generateOTP = (): number => {
  return Math.floor(100000 + Math.random() * 900000);
};

const sendMessage = async (number: string, otp: number) => {
  return await client.messages.create({
    body: `Hello from ETravel. Your verification code is ${otp}. It expires in 10 minutes. Do not disclose to anyone`,
    from: "+19726406827",
    to: number,
  });
};

const sendOTP = async (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone) {
    throw new BadRequestError("Phone number is required");
  }

  const con = await connectDB();

  const tenMinutes = 1000 * 60 * 10;
  const oneMinute = 1000 * 60 * 1;

  con.query(
    "SELECT * FROM otps WHERE phone = ?",
    [phone],
    async (err, resp) => {
      if (err) {
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ msg: "Database error" });
      }

      if (resp.length !== 0) {
        const isUpToOneMinFromPreviousSentTime =
          new Date().getTime() >
          new Date(resp[0].otp_resend_min_time).getTime();

        if (!isUpToOneMinFromPreviousSentTime) {
          return res
            .status(StatusCodes.BAD_REQUEST)
            .json({ msg: `Multiple requests in less than 1 minute` });
        }

        const otp = generateOTP();
        try {
          const message = await sendMessage("+2349039367642", otp);
        } catch (error) {
          console.log(error);
          return res
            .status(StatusCodes.INTERNAL_SERVER_ERROR)
            .json({ msg: "Internal server error" });
        }

        const oneMinuteFromNow = new Date().getTime() + oneMinute;
        const tenMinutesFromNow = new Date().getTime() + tenMinutes;
        const tenMinutesDateTimeFromNow = new Date(tenMinutesFromNow);
        const oneMinuteDateTimeFromNow = new Date(oneMinuteFromNow);

        con.query(
          "UPDATE otps SET otp = ?, otp_expiration_datetime = ?, otp_resend_min_time = ? WHERE phone = ?",
          [otp, tenMinutesDateTimeFromNow, oneMinuteDateTimeFromNow, phone],
          async (err, resp2) => {
            if (err) {
              return res
                .status(StatusCodes.INTERNAL_SERVER_ERROR)
                .json({ msg: "Database error" });
            }

            return res.send("OTP sent");
          }
        );
        return;
      }

      const otp = generateOTP();
      try {
        const message = await sendMessage("+2349039367642", otp);
      } catch (error) {
        console.log(error);
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ msg: "Internal server error" });
      }

      const oneMinuteFromNow = new Date().getTime() + oneMinute;
      const tenMinutesFromNow = new Date().getTime() + tenMinutes;
      const tenMinutesDateTimeFromNow = new Date(tenMinutesFromNow);
      const oneMinuteDateTimeFromNow = new Date(oneMinuteFromNow);

      con.query(
        "INSERT INTO otps (otp, otp_expiration_datetime, otp_resend_min_time, phone) VALUES (?, ?, ?, ?)",
        [otp, tenMinutesDateTimeFromNow, oneMinuteDateTimeFromNow, phone],
        async (err, resp3) => {
          if (err) {
            return res
              .status(StatusCodes.INTERNAL_SERVER_ERROR)
              .json({ msg: "Database error" });
          }

          return res.send("OTP sent");
        }
      );
    }
  );
};

const verifyPhoneAndLogin = async (req: Request, res: Response) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    throw new BadRequestError("Phone number and OTP are required");
  }

  const con = await connectDB();
  con.query(
    "SELECT * FROM otps WHERE phone = ?",
    [phone],
    async (err, resp) => {
      if (err) {
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ msg: "Database error" });
      }

      if (resp.length === 0) {
        return res.status(StatusCodes.NOT_FOUND).json({
          msg: `There is currently no OTP verification process going on for phone: ${phone}`,
        });
      }

      const isValidOTP =
        resp[0].otp === otp &&
        new Date(resp[0].otp_expiration_datetime).getTime() >
          new Date().getTime();

      if (!isValidOTP) {
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ msg: `Invalid credentials` });
      }

      con.query(
        "DELETE FROM otps WHERE phone = ?",
        [phone],
        async (err, resp2) => {
          if (err) {
            return res
              .status(StatusCodes.INTERNAL_SERVER_ERROR)
              .json({ msg: "Database error" });
          }

          con.query(
            "SELECT * FROM users WHERE phone = ?",
            [phone],
            async (err, resp3) => {
              if (err) {
                return res
                  .status(StatusCodes.INTERNAL_SERVER_ERROR)
                  .json({ msg: "Database error" });
              }

              const user = resp3[0];
              if (user) {
                return sendTokenWithResponse(user, res);
              }
              con.query(
                "INSERT INTO users (phone) VALUES (?)",
                [phone],
                async (err, resp4) => {
                  if (err) {
                    return res
                      .status(StatusCodes.INTERNAL_SERVER_ERROR)
                      .json({ msg: "Database error" });
                  }
                  const user = {
                    id: resp4.insertId,
                    first_name: null,
                    last_name: null,
                    phone: phone,
                    email: null,
                    image_url: null,
                  };
                  sendTokenWithResponse(user, res);
                }
              );
            }
          );
        }
      );
    }
  );
};

const loginWithGoogle = async (req: Request, res: Response) => {
  const { accessToken } = req.body;

  if (!accessToken) {
    throw new BadRequestError("Access token is required");
  }
  const { data } = await axios({
    url: "https://www.googleapis.com/oauth2/v2/userinfo",
    method: "get",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const googleUserData: {
    id: string;
    email: string;
    given_name: string;
    family_name: string;
    picture: string;
    name: string;
  } = data;
  console.log(googleUserData);

  const con = await connectDB();

  con.query(
    "SELECT * FROM users WHERE google_id = ?",
    [googleUserData.id],
    async (err, resp) => {
      if (err) {
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ msg: "Database error" });
      }

      if (resp.length !== 0) {
        const user = resp[0];

        return await sendTokenWithResponse(user, res);
      }

      con.query(
        "INSERT INTO users (email, first_name, last_name, image_url, google_id) VALUES (?, ?, ?, ?, ?)",
        [
          googleUserData.email,
          googleUserData.given_name,
          googleUserData.family_name,
          googleUserData.picture,
          googleUserData.id,
        ],
        async (err, resp2) => {
          if (err) {
            return res
              .status(StatusCodes.INTERNAL_SERVER_ERROR)
              .json({ msg: "Database error" });
          }

          const user: {
            id: number;
            first_name: string | null;
            last_name: string | null;
            phone: string | null;
            email: string | null;
            image_url: string | null;
          } = {
            id: resp2.insertId,
            first_name: googleUserData.given_name,
            last_name: googleUserData.family_name,
            phone: null,
            email: googleUserData.email,
            image_url: googleUserData.picture,
          };

          await sendTokenWithResponse(user, res, 201);
        }
      );
    }
  );
};

const loginWithFacebook = async (req: Request, res: Response) => {
  const { accessToken } = req.body;

  if (!accessToken) {
    throw new BadRequestError("Access token is required");
  }

  const { data } = await axios({
    url: "https://graph.facebook.com/me",
    method: "get",
    params: {
      fields: ["id", "email", "first_name", "last_name", "picture"].join(","),
      access_token: accessToken,
    },
  });
  const fbUserData: {
    id: number;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    email: string | null;
    picture: {} | null;
  } = data;

  const con = await connectDB();

  con.query(
    "SELECT * FROM users WHERE facebook_id = ?",
    [fbUserData.id],
    async (err, resp) => {
      if (err) {
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ msg: "Database error" });
      }

      if (resp.length !== 0) {
        const user: any = resp[0];

        return await sendTokenWithResponse(user, res);
      }

      con.query(
        "INSERT INTO users (email, first_name, last_name, image_url, facebook_id) VALUES (?, ?, ?, ?, ?)",
        [
          fbUserData.email,
          fbUserData.first_name,
          fbUserData.last_name,
          (fbUserData.picture as any)["data"]["url"],
          fbUserData.id,
        ],
        async (err, resp2) => {
          if (err) {
            return res
              .status(StatusCodes.INTERNAL_SERVER_ERROR)
              .json({ msg: "Database error" });
          }

          const user: {
            id: number;
            first_name: string | null;
            last_name: string | null;
            phone: string | null;
            email: string | null;
            image_url: string | null;
          } = {
            id: resp2.insertId,
            first_name: fbUserData.first_name,
            last_name: fbUserData.last_name,
            phone: null,
            email: fbUserData.email,
            image_url: (fbUserData.picture as any)["data"]["url"],
          };
          await sendTokenWithResponse(user, res, 201);
        }
      );
    }
  );
};

const logout = async (req: Request, res: Response) => {
  const con = await connectDB();
  con.query(
    "DELETE FROM refresh_tokens WHERE user_id = ?",
    [(req as any).user.user.userId],
    async (err, resp2) => {
      if (err) {
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ msg: "Database error" });
      }

      res.json({ msg: "User logged out!" });
    }
  );
};

const registerDriver = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new BadRequestError("Email and password are required");
  }
  if (password.length < 6) {
    throw new BadRequestError("Password must not be less than 6 characters");
  }
  const con = await connectDB();
  con.query(
    "SELECT * FROM drivers WHERE email = ?",
    [email],
    async (err, resp) => {
      if (err) {
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ msg: "Database error" });
      }

      if (resp.length !== 0) {
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ msg: "Email already exists" });
      }

      const verificationToken = crypto.randomBytes(40).toString("hex");

      try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        con.query(
          "SELECT * FROM drivers_tokens WHERE email = ?",
          [email],
          async (err, resp2) => {
            if (err) {
              return res
                .status(StatusCodes.INTERNAL_SERVER_ERROR)
                .json({ msg: "Database error" });
            }

            const driverTokenData = resp2[0];

            if (driverTokenData) {
              con.query(
                "UPDATE drivers_tokens SET password = ?, verification_token = ? WHERE email = ?",
                [hashedPassword, verificationToken, email],
                async (err, resp3) => {
                  if (err) {
                    return res
                      .status(StatusCodes.INTERNAL_SERVER_ERROR)
                      .json({ msg: "Database error" });
                  }

                  await sendVerificationEmail({
                    name: email,
                    verificationToken: verificationToken,
                    email: email,
                    origin: origin,
                  });

                  res.status(StatusCodes.CREATED).json({
                    msg: "Success! Please check your mail to verify your account",
                  });
                }
              );
              return;
            }

            con.query(
              "INSERT INTO drivers_tokens (email, password, verification_token) VALUES (?, ?, ?)",
              [email, hashedPassword, verificationToken],
              async (err, resp2) => {
                if (err) {
                  return res
                    .status(StatusCodes.INTERNAL_SERVER_ERROR)
                    .json({ msg: "Database error" });
                }

                await sendVerificationEmail({
                  name: email,
                  verificationToken: verificationToken,
                  email: email,
                  origin: origin,
                });

                res.json({
                  msg: "Success! Please check your mail to verify your account",
                });
              }
            );
          }
        );
      } catch (e) {
        res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ msg: "Internal server error" });
      }
    }
  );
};

const verifyDriverEmail = async (req: Request, res: Response) => {
  const { email, token } = req.body;

  if (!email || !token) {
    throw new BadRequestError("Email and Token are required");
  }

  const con = await connectDB();
  con.query(
    "SELECT * FROM drivers_tokens WHERE email = ?",
    [email],
    async (err, resp) => {
      if (err) {
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ msg: "Database error" });
      }

      const driverTokenData = resp[0];
      if (!driverTokenData) {
        return res.status(StatusCodes.NOT_FOUND).json({
          msg: `No verification process ongoing for user with email: ${email}`,
        });
      }

      if (driverTokenData.verification_token !== token) {
        return res
          .status(StatusCodes.UNAUTHORIZED)
          .json({ msg: "Invalid credentials" });
      }

      con.query(
        "INSERT INTO drivers (email, password) VALUES (?, ?)",
        [driverTokenData.email, driverTokenData.password],
        async (err, resp2) => {
          if (err) {
            return res
              .status(StatusCodes.INTERNAL_SERVER_ERROR)
              .json({ msg: "Database error" });
          }
          con.query(
            "DELETE FROM drivers_tokens WHERE id = ?",
            [driverTokenData.id],
            async (err, resp3) => {
              if (err) {
                return res
                  .status(StatusCodes.INTERNAL_SERVER_ERROR)
                  .json({ msg: "Database error" });
              }

              res.status(StatusCodes.CREATED).json({
                msg: "Email verified and new user created.",
                user: { email: email },
              });
            }
          );
        }
      );
    }
  );
};

const sendDriverOTP = async (req: Request, res: Response) => {
  const { phone } = req.body;
  const driver = (req as any).user.user;

  if (!phone) {
    throw new BadRequestError("Phone number is required");
  }

  const con = await connectDB();

  const tenMinutes = 1000 * 60 * 10;
  const oneMinute = 1000 * 60 * 1;

  con.query(
    "SELECT * FROM driver_otps WHERE phone = ?",
    [phone],
    async (err, resp) => {
      if (err) {
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ msg: "Database error" });
      }

      if (resp.length !== 0) {
        const isUpToOneMinFromPreviousSentTime =
          new Date().getTime() >
          new Date(resp[0].otp_resend_min_time).getTime();

        if (!isUpToOneMinFromPreviousSentTime) {
          return res
            .status(StatusCodes.BAD_REQUEST)
            .json({ msg: `Multiple requests in less than 1 minute` });
        }

        const otp = generateOTP();
        try {
          const message = await sendMessage("+2349039367642", otp);
        } catch (error) {
          console.log(error);
          return res
            .status(StatusCodes.INTERNAL_SERVER_ERROR)
            .json({ msg: "Internal server error" });
        }

        const oneMinuteFromNow = new Date().getTime() + oneMinute;
        const tenMinutesFromNow = new Date().getTime() + tenMinutes;
        const tenMinutesDateTimeFromNow = new Date(tenMinutesFromNow);
        const oneMinuteDateTimeFromNow = new Date(oneMinuteFromNow);

        con.query(
          "UPDATE driver_otps SET otp = ?, otp_expiration_datetime = ?, otp_resend_min_time = ?, driver_id = ? WHERE phone = ?",
          [
            otp,
            tenMinutesDateTimeFromNow,
            oneMinuteDateTimeFromNow,
            driver.userId,
            phone,
          ],
          async (err, resp2) => {
            if (err) {
              return res
                .status(StatusCodes.INTERNAL_SERVER_ERROR)
                .json({ msg: "Database error" });
            }

            return res.send("OTP sent");
          }
        );
        return;
      }

      const otp = generateOTP();
      try {
        const message = await sendMessage("+2349039367642", otp);
      } catch (error) {
        console.log(error);
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ msg: "Internal server error" });
      }

      const oneMinuteFromNow = new Date().getTime() + oneMinute;
      const tenMinutesFromNow = new Date().getTime() + tenMinutes;
      const tenMinutesDateTimeFromNow = new Date(tenMinutesFromNow);
      const oneMinuteDateTimeFromNow = new Date(oneMinuteFromNow);

      con.query(
        "INSERT INTO driver_otps (otp, otp_expiration_datetime, otp_resend_min_time, phone, driver_id) VALUES (?, ?, ?, ?, ?)",
        [
          otp,
          tenMinutesDateTimeFromNow,
          oneMinuteDateTimeFromNow,
          phone,
          driver.userId,
        ],
        async (err, resp3) => {
          if (err) {
            return res
              .status(StatusCodes.INTERNAL_SERVER_ERROR)
              .json({ msg: "Database error" });
          }

          return res.send("OTP sent");
        }
      );
    }
  );
};

const driverLogin = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new BadRequestError("Email and Password are required");
  }

  const con = await connectDB();
  con.query(
    "SELECT * FROM drivers WHERE email = ?",
    [email],
    async (err, resp) => {
      if (err) {
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ msg: "Database error" });
      }

      const driver = resp[0];
      if (!driver) {
        return res.status(StatusCodes.NOT_FOUND).json({
          msg: `There is no driver with email: ${email}`,
        });
      }

      const isCorrectPassword = await bcrypt.compare(password, driver.password);

      if (!isCorrectPassword) {
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ msg: `Invalid credentials` });
      }

      sendDriverTokenWithResponse(driver, res);
    }
  );
};
const driverLogout = async (req: Request, res: Response) => {
  const con = await connectDB();
  con.query(
    "DELETE FROM driver_refresh_tokens WHERE driver_id = ?",
    [(req as any).user.user.userId],
    async (err, resp2) => {
      if (err) {
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ msg: "Database error" });
      }

      res.json({ msg: "Driver logged out!" });
    }
  );
};

export {
  sendOTP,
  verifyPhoneAndLogin,
  loginWithGoogle,
  loginWithFacebook,
  registerDriver,
  verifyDriverEmail,
  sendDriverOTP,
  driverLogin,
  logout,
  driverLogout,
};
