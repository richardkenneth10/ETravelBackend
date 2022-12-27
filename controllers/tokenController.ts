import { Request, Response } from "express";
import connectDB from "../db/connect";
import { BadRequestError, UnauthenticatedError } from "../errors";
import { createAccessJWT, isTokenValid } from "../utils/jwt";

const refreshToken = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    throw new BadRequestError("Refresh token is required");
  }

  let payload: any;
  try {
    payload = isTokenValid(refreshToken);
  } catch (error) {
    throw new UnauthenticatedError("Token Invalid");
  }

  const con = await connectDB();
  console.log(payload);

  con.query(
    "SELECT * FROM refresh_tokens WHERE user_id = ? AND token = ?",
    [payload.user.userId, payload.refreshToken],
    async (err, resp3) => {
      if (err) {
        return res.status(500).json({ msg: "Database error" });
      }

      const existingToken = resp3[0];

      if (!existingToken || !existingToken.is_valid) {
        return res.status(401).json({ msg: "Token Invalid" });
      }

      const accessTokenJWT = createAccessJWT({
        payload: { user: payload.user },
      });

      res.json({
        accessToken: accessTokenJWT,
      });
    }
  );
};

export { refreshToken };
