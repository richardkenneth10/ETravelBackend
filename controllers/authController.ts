import { Request, RequestHandler, Response } from "express";
import connectDB from "../db/connect";
import {
  CustomAPIError,
  BadRequestError,
  UnauthenticatedError,
} from "../errors";
const Client = require("twilio");
import axios from "axios";
import { attachCookiesToResponse } from "../utils/jwt";
import crypto from "crypto";
import createTokenUser from "../utils/createTokenUser";

const accountSid = "ACe67c06e0c404876aece36ed1c22c85ab";
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = Client(accountSid, authToken);

const generateOTP = (): number => {
  return Math.floor(100000 + Math.random() * 900000);
};

const sendMessage = async (number: string, otp: number) => {
  return await client.messages.create({
    body: `Hello from ETravel. Your verification code is ${otp}. It expires in 10 minutes. Do not disclose to anyone`,
    from: "+18125155378",
    to: number,
  });
};

const loginWithPhone = async (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone) {
    throw new BadRequestError("Phone number is required");
  }

  const con = await connectDB();

  const tenMinutes = 1000 * 60 * 10;
  const oneMinutes = 1000 * 60 * 1;

  con.query(
    "SELECT * FROM users WHERE phone = ?",
    [phone],
    async (err, resp) => {
      if (err) {
        return res.status(500).json({ msg: "Database error" });
      }

      if (resp.length === 0) {
        con.query(
          "INSERT INTO users (phone) VALUES (?)",
          [phone],
          async (err, resp2) => {
            if (err) {
              return res.status(500).json({ msg: "Database error" });
            }

            const otp = generateOTP();
            const message = await sendMessage("+2349039367642", otp);
            console.log(message.sid);

            const oneMinuteFromNow = new Date().getTime() + oneMinutes;
            const tenMinutesFromNow = new Date().getTime() + tenMinutes;
            const tenMinutesDateTimeFromNow = new Date(tenMinutesFromNow);
            const oneMinuteDateTimeFromNow = new Date(oneMinuteFromNow);

            con.query(
              "INSERT INTO otps (otp, otp_expiration_datetime, otp_resend_min_time, user_id) VALUES (?, ?, ?, ?)",
              [
                otp,
                tenMinutesDateTimeFromNow,
                oneMinuteDateTimeFromNow,
                //as long as the id field of the users table is the users id, this insertId wouls always be the user's id
                resp2.insertId,
              ],
              async (err, resp3) => {
                if (err) {
                  return res.status(500).json({ msg: "Database error" });
                }

                return res.status(201).send("OTP sent");
              }
            );
          }
        );
        return;
      }

      const user = resp[0];
      console.log(user);

      con.query(
        "SELECT * FROM otps WHERE user_id = ?",
        [user.id],
        async (err, resp4) => {
          if (err) {
            return res.status(500).json({ msg: "Database error" });
          }

          if (resp4.length !== 0) {
            const isUpToOneMinFromPreviousSentTime =
              new Date().getTime() >
              new Date(resp4[0].otp_resend_min_time).getTime();

            if (!isUpToOneMinFromPreviousSentTime) {
              return res
                .status(400)
                .json({ msg: `Multiple requests in less than 1 minute` });
            }

            const otp = generateOTP();
            const message = await sendMessage("+2349039367642", otp);
            console.log(message.sid);

            const oneMinuteFromNow = new Date().getTime() + oneMinutes;
            const tenMinutesFromNow = new Date().getTime() + tenMinutes;
            const tenMinutesDateTimeFromNow = new Date(tenMinutesFromNow);
            const oneMinuteDateTimeFromNow = new Date(oneMinuteFromNow);

            con.query(
              "UPDATE otps SET otp = ?, otp_expiration_datetime = ?, otp_resend_min_time = ? WHERE user_id = ?",
              [
                otp,
                tenMinutesDateTimeFromNow,
                oneMinuteDateTimeFromNow,
                user.id,
              ],
              async (err, resp5) => {
                if (err) {
                  return res.status(500).json({ msg: "Database error" });
                }

                return res.send("OTP sent");
              }
            );
            return;
          }

          const otp = generateOTP();
          const message = await sendMessage("+2349039367642", otp);
          console.log(message.sid);

          const oneMinuteFromNow = new Date().getTime() + oneMinutes;
          const tenMinutesFromNow = new Date().getTime() + tenMinutes;
          const tenMinutesDateTimeFromNow = new Date(tenMinutesFromNow);
          const oneMinuteDateTimeFromNow = new Date(oneMinuteFromNow);

          con.query(
            "INSERT INTO otps (otp, otp_expiration_datetime, otp_resend_min_time, user_id) VALUES (?, ?, ?, ?)",
            [otp, tenMinutesDateTimeFromNow, oneMinuteDateTimeFromNow, user.id],
            async (err, resp6) => {
              if (err) {
                return res.status(500).json({ msg: "Database error" });
              }

              return res.send("OTP sent");
            }
          );
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
    "SELECT users.id, users.first_name, users.last_name, users.phone, users.email, otps.otp, otps.otp_expiration_datetime, otps.otp_resend_min_time FROM etravel.users LEFT JOIN etravel.otps ON users.id = otps.user_id WHERE users.phone = ?",
    [phone],
    async (err, resp) => {
      if (err) {
        return res.status(500).json({ msg: "Database error" });
      }

      const noUser = resp.length === 0;

      if (noUser) {
        return res.status(400).json({ msg: `No user with phone ${phone}` });
      }

      const user = resp[0];

      if (!user.otp || !user.otp_expiration_datetime) {
        return res.status(400).json({
          msg: `There is currently no OTP verification process going on for phone: ${phone}`,
        });
      }

      const isValidOTP =
        user.otp === otp &&
        new Date(user.otp_expiration_datetime).getTime() > new Date().getTime();

      if (!isValidOTP) {
        return res.status(400).json({ msg: `Invalid credentials` });
      }

      con.query(
        "DELETE FROM otps WHERE user_id = ?",
        [user.id],
        async (err, resp2) => {
          if (err) {
            return res.status(500).json({ msg: "Database error" });
          }

          console.log(user);
          await sendTokenWithResponse(user, res);
        }
      );
    }
  );
};

const sendTokenWithResponse = async (
  user: {
    id: number;
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
  },
  res: Response,
  successStatusCode?: number
) => {
  const tokenUser = createTokenUser(user);

  const con = await connectDB();
  // create refresh token
  let refreshToken = "";
  // check for existing token
  con.query(
    "SELECT * FROM refresh_tokens WHERE user_id = ?",
    [user.id],
    async (err, resp3) => {
      if (err) {
        return res.status(500).json({ msg: "Database error1" });
      }

      const existingToken = resp3[0];

      if (existingToken) {
        const { is_valid: isValid } = existingToken;
        if (!isValid) {
          return res.status(401).json({ msg: "Invalid Credentials" });
        }

        refreshToken = existingToken.token;
        attachCookiesToResponse({ res, user: tokenUser, refreshToken });
        res.status(successStatusCode ?? 200).json({ user: tokenUser });
        return;
      }

      refreshToken = crypto.randomBytes(40).toString("hex");
      console.log(refreshToken);

      con.query(
        "INSERT INTO refresh_tokens (token, user_id) VALUES (?, ?)",
        [refreshToken, user.id],
        async (err, resp4) => {
          if (err) {
            return res.status(500).json({ msg: "Database error2" });
          }

          attachCookiesToResponse({
            res,
            user: tokenUser,
            refreshToken,
          });
          res.status(successStatusCode ?? 200).json({ user: tokenUser });
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
  } = data;
  console.log(googleUserData);

  const con = await connectDB();

  con.query(
    "SELECT * FROM users WHERE google_id = ?",
    [googleUserData.id],
    async (err, resp) => {
      if (err) {
        return res.status(500).json({ msg: "Database error" });
      }

      if (resp.length !== 0) {
        const user = resp[0];

        await sendTokenWithResponse(user, res);
      }

      //TODO: Check if you can combine this query with the one above
      // i.e. into a single query

      con.query(
        "SELECT * FROM users WHERE email = ?",
        [googleUserData.email],
        async (err, resp2) => {
          if (err) {
            return res.status(500).json({ msg: "Database error" });
          }

          if (resp2.length !== 0) {
            return res.status(400).json({
              msg: `A user already exists with email ${resp2[0].email}`,
            });
          }

          con.query(
            "INSERT INTO users (email, google_id) VALUES (?, ?)",
            [googleUserData.email, googleUserData.id],
            async (err, resp3) => {
              if (err) {
                return res.status(500).json({ msg: "Database error" });
              }

              const temp: any = {};
              await sendTokenWithResponse(temp, res, 201);
            }
          );
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
      fields: ["id", "email", "first_name", "last_name"].join(","),
      access_token: accessToken,
    },
  });
  const fbUserData: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  } = data;
  console.log(fbUserData);

  const con = await connectDB();

  con.query(
    "SELECT * FROM users WHERE facebook_id = ?",
    [fbUserData.id],
    async (err, resp) => {
      if (err) {
        return res.status(500).json({ msg: "Database error" });
      }

      if (resp.length !== 0) {
        const user = resp[0];

        await sendTokenWithResponse(user, res);

        return res.send("User logged in");
      }

      //TODO: Check if you can combine this query with the one above
      // i.e. into a single query

      con.query(
        "SELECT * FROM users WHERE email = ?",
        [fbUserData.email],
        async (err, resp2) => {
          if (err) {
            return res.status(500).json({ msg: "Database error" });
          }

          if (resp2.length !== 0) {
            return res.status(400).json({
              msg: `A user already exists with email ${resp2[0].email}`,
            });
          }

          con.query(
            "INSERT INTO users (email, first_name, last_name, facebook_id) VALUES (?, ?, ?, ?)",
            [
              fbUserData.email,
              fbUserData.first_name,
              fbUserData.last_name,
              fbUserData.id,
            ],
            async (err, resp2) => {
              if (err) {
                return res.status(500).json({ msg: "Database error" });
              }

              const temp: any = {};
              await sendTokenWithResponse(temp, res, 201);
            }
          );
        }
      );
    }
  );
};

const updateUserProfile = async (req: Request, res: Response) => {
  const con = await connectDB();
  const { phone, email, first_name: firstName, last_name: lastName } = req.body;
  const userId = (req as any).user.userId;

  const updateFields = (): Map<string, string> => {
    const fields = new Map<string, string>();
    if (phone) {
      fields.set("phone", phone);
    }
    if (email) {
      fields.set("email", email);
    }
    if (firstName) {
      fields.set("first_name", firstName);
    }
    if (lastName) {
      fields.set("last_name", lastName);
    }
    return fields;
  };

  if (updateFields().size === 0) {
    throw new BadRequestError("Provide at least one field to be updated");
  }

  let innerSQLString = "";
  let count = 0;
  updateFields().forEach((value, key) => {
    count++;
    innerSQLString += `${key} = ?${count < updateFields().size ? "," : ""}`;
  });

  con.query(
    `UPDATE users SET ${innerSQLString} WHERE id = ?`,
    [...updateFields().values(), userId],
    async (err, resp3) => {
      if (err) {
        return res.status(500).json({ msg: "Database error" });
      }

      res.send("Profile updated");
    }
  );
};
const logout = async (req: Request, res: Response) => {
  const con = await connectDB();
  con.query(
    "DELETE FROM refresh_tokens WHERE user_id = ?",
    [(req as any).user.userId],
    async (err, resp2) => {
      if (err) {
        return res.status(500).json({ msg: "Database error" });
      }

      res.cookie("accessToken", "logout", {
        httpOnly: true,
        expires: new Date(Date.now()),
      });
      res.cookie("refreshToken", "logout", {
        httpOnly: true,
        expires: new Date(Date.now()),
      });
      res.json({ msg: "user logged out!" });
    }
  );
};

export {
  loginWithPhone,
  verifyPhone,
  loginWithGoogle,
  loginWithFacebook,
  updateUserProfile,
  logout,
};
