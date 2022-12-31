import { NextFunction, Request, Response } from "express";
import connectDB from "../db/connect";
import { UnauthenticatedError } from "../errors";
import { isDriverTokenValid, isTokenValid } from "../utils/jwt";

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
const authenticateDriver = async (
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
    const payload = isDriverTokenValid(token);
    (req as any).user = payload;
    next();
  } catch (error) {
    throw new UnauthenticatedError("Authentication Invalid");
  }
};
export { authenticateUser, authenticateDriver };
