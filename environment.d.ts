declare global {
  interface User {
    id: number;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    email: string | null;
  }
}

export {};
