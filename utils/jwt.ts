import jwt, { Secret } from "jsonwebtoken";

const createRefreshJWT = ({ payload }: { payload: any }) => {
  const token = jwt.sign(payload, process.env.JWT_SECRET as Secret);
  return token;
};
const createAccessJWT = ({ payload }: { payload: any }) => {
  const token = jwt.sign(payload, process.env.JWT_SECRET as Secret, {
    expiresIn: process.env.JWT_LIFETIME,
  });
  return token;
};

const createDriverRefreshJWT = ({ payload }: { payload: any }) => {
  const token = jwt.sign(payload, process.env.JWT_DRIVER_SECRET as Secret);
  return token;
};
const createDriverAccessJWT = ({ payload }: { payload: any }) => {
  const token = jwt.sign(payload, process.env.JWT_DRIVER_SECRET as Secret, {
    expiresIn: process.env.JWT_LIFETIME,
  });
  return token;
};

const isTokenValid = (token: string) =>
  jwt.verify(token, process.env.JWT_SECRET as Secret);

const isDriverTokenValid = (token: string) =>
  jwt.verify(token, process.env.JWT_DRIVER_SECRET as Secret);

export {
  createRefreshJWT,
  createAccessJWT,
  isTokenValid,
  createDriverRefreshJWT,
  createDriverAccessJWT,
  isDriverTokenValid,
};
