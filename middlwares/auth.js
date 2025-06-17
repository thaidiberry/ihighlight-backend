const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.authUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token, authorization denied" });
    }

    const token = authHeader.split(" ")[1];
    console.log("🔐 Incoming token string:", token);

    // ✅ Check for malformed token structure (3 parts: header.payload.signature)
    if (!token || token.split(".").length !== 3) {
      throw new Error("Malformed token structure");
    }

    const decoded = jwt.verify(token, process.env.TOKEN_SECRET);

    // ✅ Try to find user by either internal _id (preferred) or googleId (fallback)
    const user = await User.findOne({
      $or: [{ _id: decoded.id }, { googleId: decoded.id }],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ Attach user object to request for downstream use
    req.user = user;

    // ✅ Add for backward compatibility:
    // Auto-inject user ID into req.body.user if missing
    if (!req.body.user) {
      req.body.user = user._id;
    }

    next();
  } catch (error) {
    console.error("❌ Auth Middleware Error:", error.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
