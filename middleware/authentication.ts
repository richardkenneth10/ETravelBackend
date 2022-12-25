import { NextFunction, Request, Response } from "express";
import connectDB from "../db/connect";
import { UnauthenticatedError } from "../errors";
import { attachCookiesToResponse, isTokenValid } from "../utils/jwt";

const authenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { refreshToken, accessToken } = req.signedCookies;

  try {
    if (accessToken) {
      const payload = isTokenValid(accessToken) as any;
      (req as any).user = payload.user;
      return next();
    }
    const payload = isTokenValid(refreshToken) as any;

    const con = await connectDB();

    con.query(
      "SELECT * FROM refresh_tokens WHERE user_id = ? AND token = ?",
      [payload.user.id, refreshToken],
      async (err, resp3) => {
        if (err) {
          return res.status(500).json({ msg: "Database error" });
        }

        const existingToken = resp3[0];

        console.log(existingToken.is_valid);

        if (!existingToken || !existingToken.is_valid) {
          return res.status(401).json({ msg: "Authentication Invalid" });
        }

        attachCookiesToResponse({
          res,
          user: payload.user,
          refreshToken: existingToken.refreshToken,
        });

        (req as any).user = payload.user;
        next();
      }
    );
  } catch (error) {
    throw new UnauthenticatedError("Authentication Invalid");
  }
};

export { authenticateUser };
