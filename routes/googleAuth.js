const express = require("express");
const router = express.Router();

const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ✅ Using REACT_APP_MAILING_ID (same name for frontend & backend)
const client = new OAuth2Client(process.env.REACT_APP_MAILING_ID);

router.post("/google-auth", async (req, res) => {
  try {
    const credential = req.body?.token || req.body?.credential;
    if (typeof credential !== "string") {
      return res.status(400).json({ message: "Invalid credential format" });
    }

    // 1. Verify token with Google
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.REACT_APP_MAILING_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // 2. Find or create user by email
    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        googleId,
        email,
        picture,
        verified: true,
        username: email.split("@")[0] + Math.floor(Math.random() * 10000),
        first_name: name?.split(" ")[0] || "",
        last_name: name?.split(" ")[1] || "",
        bYear: 1990,
        bMonth: 1,
        bDay: 1,
      });
      await user.save();
    } else if (!user.googleId) {
      // If user exists but doesn't have googleId yet, link it
      user.googleId = googleId;
      await user.save();
    }

    // 3. Sign your app’s JWT using internal user._id
    const appToken = jwt.sign({ id: user._id }, process.env.TOKEN_SECRET, {
      expiresIn: "7d",
    });

    // 4. Return token + user info
    return res.status(200).json({
      token: appToken,
      user: {
        _id: user._id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        picture: user.picture,
      },
    });
  } catch (err) {
    console.error("Google auth error:", err.message, err.stack);
    return res.status(500).json({ message: "Google authentication failed" });
  }
});

module.exports = router;
