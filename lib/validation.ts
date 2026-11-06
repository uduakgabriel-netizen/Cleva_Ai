import { z } from "zod";

export const createPaymentIntentSchema = z
  .object({
    inputText: z.string().trim().max(500).optional(),
    url: z.string().trim().max(500).url("Must be a valid URL").optional(),
  })
  .refine(
    (data) => {
      const hasText = typeof data.inputText === "string" && data.inputText.length > 0;
      const hasUrl = typeof data.url === "string" && data.url.length > 0;
      return hasText || hasUrl;
    },
    {
      message: "At least one of inputText or url must be present",
    }
  );

export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentSchema>;
