import { NextFunction, Request, Response } from "express";
import connectDB from "../db/connect";
import { UnauthenticatedError } from "../errors";
import { isTokenValid } from "../utils/jwt";

const authenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthenticatedError("No token provided");
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = isTokenValid(token);
    (req as any).user = payload;
    next();
  } catch (error) {
    throw new UnauthenticatedError("Authentication Invalid");
  }
};

export { authenticateUser };

// const con = await connectDB();

//     con.query(
//       "SELECT * FROM refresh_tokens WHERE user_id = ? AND token = ?",
//       [payload.user.id, refreshToken],
//       async (err, resp3) => {
//         if (err) {
//           return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ msg: "Database error" });
//         }

//         const existingToken = resp3[0];

//         console.log(existingToken.is_valid);

//         if (!existingToken || !existingToken.is_valid) {
//           return res.status(401).json({ msg: "Authentication Invalid" });
//         }
