const createTokenUser = (user: {
  id: number;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  image_url: string | null;
}) => {
  return {
    first_name: user.first_name,
    last_name: user.last_name,
    phone: user.phone,
    email: user.email,
    image_url: user.image_url,
    userId: user.id,
  };
};

export default createTokenUser;
