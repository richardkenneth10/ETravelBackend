const createTokenUser = (user: {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
}) => {
  return {
    first_name: user.first_name,
    last_name: user.last_name,
    phone: user.phone,
    email: user.email,
    userId: user.id,
  };
};

export default createTokenUser;
