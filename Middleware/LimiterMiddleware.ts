import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 10 * 1 * 1000, // 10 seconds
  max: 7, // Limit each IP to 5 requests per windowMs
  keyGenerator: function (req, res) {
    // Use the email as the key
    return req.body.email;
  },
  message: "Too many login attempts from this email, please try again after 10 seconds"
});