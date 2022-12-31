const origin =
  process.env.NODE_ENV === "production"
    ? "http://54.172.164.5:3000"
    : "http://54.172.164.5:3000";

export { origin };
