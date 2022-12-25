import { NextFunction, Request, Response } from "express";
import { UnauthenticatedError } from "../errors";
import { isTokenValid } from "../utils/jwt";

const getMissingFieldsInProfile = (payload: {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
}) => {
  const missingFields = [];
  if (!payload.email) {
    missingFields.push("email");
  }
  if (!(payload.first_name || payload.last_name)) {
    missingFields.push("name");
  }
  if (!payload.phone) {
    missingFields.push("phone");
  }
  return missingFields;
};

const validateUserProfileAsComplete = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { refreshToken, accessToken } = req.signedCookies;

  try {
    if (accessToken) {
      const payload = isTokenValid(accessToken) as any;
      (req as any).user = payload.user;

      const missingFields = getMissingFieldsInProfile(payload);
      if (missingFields.length !== 0) {
        return res
          .status(403)
          .json({ msg: "Incomplete profile", fields: missingFields });
      }
      return next();
    }
    const payload = isTokenValid(refreshToken) as any;

    const missingFields = getMissingFieldsInProfile(payload);
    if (missingFields.length !== 0) {
      return res
        .status(403)
        .json({ msg: "Incomplete profile", fields: missingFields });
    }
    next();
  } catch (error) {
    throw new UnauthenticatedError("Authentication Invalid");
  }
};

export { validateUserProfileAsComplete };
