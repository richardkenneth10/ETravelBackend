import { Request, RequestHandler, Response } from "express";
import connectDB from "../db/connect";
import {
  CustomAPIError,
  BadRequestError,
  UnauthenticatedError,
} from "../errors";
const Client = require("twilio");
import axios from "axios";
import { createAccessJWT, createRefreshJWT } from "../utils/jwt";
import crypto from "crypto";
import createTokenUser from "../utils/createTokenUser";
import { StatusCodes } from "http-status-codes";

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
        return res.status(StatusCodes.BAD_REQUEST).json({
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
                return await sendTokenWithResponse(user, res);
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
                  await sendTokenWithResponse(user, res);
                }
              );
            }
          );
        }
      );
    }
  );
};

const sendTokenWithResponse = async (
  user: {
    id: number;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    email: string | null;
    image_url: string | null;
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
    async (err, resp) => {
      if (err) {
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ msg: "Database error" });
      }

      const existingToken = resp[0];

      console.log(existingToken);

      if (existingToken) {
        console.log("hi78657890");

        const { is_valid: isValid } = existingToken;
        if (!isValid) {
          return res.status(401).json({ msg: "Invalid Credentials" });
        }

        refreshToken = existingToken.token;

        const refreshJWT = createRefreshJWT({
          payload: { user: tokenUser, refreshToken },
        });
        const accessJWT = createAccessJWT({ payload: { user: tokenUser } });

        return res.status(successStatusCode ?? 200).json({
          user: tokenUser,
          refreshToken: refreshJWT,
          accessToken: accessJWT,
        });
      }

      refreshToken = crypto.randomBytes(40).toString("hex");
      console.log(refreshToken);

      con.query(
        "INSERT INTO refresh_tokens (token, user_id) VALUES (?, ?)",
        [refreshToken, user.id],
        async (err, resp4) => {
          if (err) {
            return res
              .status(StatusCodes.INTERNAL_SERVER_ERROR)
              .json({ msg: "Database error" });
          }

          const refreshJWT = createRefreshJWT({
            payload: { user: tokenUser, refreshToken },
          });
          const accessJWT = createAccessJWT({ payload: { user: tokenUser } });

          res.status(successStatusCode ?? 200).json({
            user: tokenUser,
            refreshToken: refreshJWT,
            accessToken: accessJWT,
          });
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

      res.json({ msg: "user logged out!" });
    }
  );
};

export {
  sendOTP,
  verifyPhoneAndLogin,
  loginWithGoogle,
  loginWithFacebook,
  sendTokenWithResponse,
  logout,
};
