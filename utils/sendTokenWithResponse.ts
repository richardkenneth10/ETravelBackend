import { Response } from "express";
import { StatusCodes } from "http-status-codes";
import connectDB from "../db/connect";
import createTokenUser from "./createTokenUser";
import {
  createRefreshJWT,
  createAccessJWT,
  createDriverRefreshJWT,
  createDriverAccessJWT,
} from "./jwt";
import crypto from "crypto";

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

      if (existingToken) {
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

const sendDriverTokenWithResponse = async (
  driver: {
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
  const tokenUser = createTokenUser(driver);

  const con = await connectDB();
  // create refresh token
  let refreshToken = "";
  // check for existing token
  con.query(
    "SELECT * FROM driver_refresh_tokens WHERE driver_id = ?",
    [driver.id],
    async (err, resp) => {
      if (err) {
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ msg: "Database error" });
      }

      const existingToken = resp[0];

      if (existingToken) {
        const { is_valid: isValid } = existingToken;
        if (!isValid) {
          return res.status(401).json({ msg: "Invalid Credentials" });
        }

        refreshToken = existingToken.token;

        const refreshJWT = createDriverRefreshJWT({
          payload: { user: tokenUser, refreshToken },
        });
        const accessJWT = createDriverAccessJWT({
          payload: { user: tokenUser },
        });

        return res.status(successStatusCode ?? 200).json({
          user: tokenUser,
          refreshToken: refreshJWT,
          accessToken: accessJWT,
        });
      }

      refreshToken = crypto.randomBytes(40).toString("hex");

      con.query(
        "INSERT INTO driver_refresh_tokens (token, driver_id) VALUES (?, ?)",
        [refreshToken, driver.id],
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

export { sendTokenWithResponse, sendDriverTokenWithResponse };
