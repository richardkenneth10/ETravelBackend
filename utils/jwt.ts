import { Response } from "express";
import jwt, { Secret } from "jsonwebtoken";

const createRefreshJWT = ({ payload }: { payload: any }) => {
  const token = jwt.sign(payload, process.env.JWT_SECRET as Secret);
  return token;
};
const createAccessJWT = ({ payload }: { payload: any }) => {
  const token = jwt.sign(payload, process.env.JWT_SECRET as Secret, {
    expiresIn: "30m",
  });
  return token;
};

const isTokenValid = (token: string) =>
  jwt.verify(token, process.env.JWT_SECRET as Secret);

export { createRefreshJWT, createAccessJWT, isTokenValid };
