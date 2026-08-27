import { z } from "zod";

export const loginCredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function parseLoginCredentials(form: FormData) {
  return loginCredentialsSchema.safeParse({ email: form.get("email"), password: form.get("password") });
}
