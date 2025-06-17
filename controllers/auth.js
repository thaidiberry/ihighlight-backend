// backend/controllers/auth.js
const User = require("../models/User");

const googleLogin = async (req, res) => {
  try {
    const { email, name, picture, googleId } = req.body;

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        email,
        first_name: name,
        picture,
        googleId,
      });
    } else {
      if (!user.googleId) user.googleId = googleId;
      if (!user.picture) user.picture = picture;
      await user.save();
    }

    // TODO: Replace this with real JWT if you’re using auth
    res.status(200).json({
      _id: user._id,
      email: user.email,
      first_name: user.first_name,
      picture: user.picture,
      token: "yourJWTtokenHere",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Google login failed" });
  }
};

module.exports = { googleLogin };
