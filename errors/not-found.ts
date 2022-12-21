import { StatusCodes } from "http-status-codes";
import CustomAPIError from "./custom-api";

class NotFoundError extends CustomAPIError {
  readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.statusCode = StatusCodes.NOT_FOUND;
  }
}

export default NotFoundError;
