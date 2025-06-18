const {
  validateEmail,
  validateLength,
  validateUsername,
} = require("../helpers/validation");
const User = require("../models/User");
const Post = require("../models/Post");
const Code = require("../models/Code");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cloudinary = require("cloudinary");
const { generateToken } = require("../helpers/tokens");
const { sendVerificationEmail, sendResetCode } = require("../helpers/mailer");
const generateCode = require("../helpers/generateCode");
const mongoose = require("mongoose");
mongoose.set('strictQuery', true);

module.exports.googleAuth = async (req, res) => {
  try {
    const { tokenId } = req.body;
    const { OAuth2Client } = require("google-auth-library");
    const client = new OAuth2Client(process.env.MAILING_ID);
    // 🔹 Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: tokenId,
      audience: process.env.MAILING_ID, // Must match CLIENT_ID
    });

    // 🔹 Extract user info from Google payload
    const { email, email_verified, given_name, family_name, picture, sub } = ticket.getPayload();

    if (!email_verified) {
      return res.status(400).json({ message: "Your Google account is not verified." });
    }

    // 🔹 Check if user already exists
    let user = await User.findOne({ email });

    if (!user) {
      // ✅ If user doesn't exist, create a new Google-only account
      user = new User({
        first_name: given_name,
        last_name: family_name,
        email,
        password: null, // Google users don't have passwords initially
        username: `${given_name}${family_name}`,
        picture,
        googleId: sub,
        verified: true, // Mark as verified
      });

      await user.save();
    } else if (!user.googleId) {
      // ✅ If user exists but didn't use Google before, link Google account
      user.googleId = sub;
      await user.save();
    }

    // ✅ Generate JWT Token
    const token = generateToken({ id: user._id.toString() }, "7d");

    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      token,
      verified: user.verified,
    });

  } catch (error) {
    console.error("Google Auth Error:", error);
    res.status(500).json({ message: "Google authentication failed." });
  }
};


module.exports.register = async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      password,
      username,
      bYear,
      bMonth,
      bDay,
      gender,
    } = req.body;

    if (!validateEmail(email)) {
      return res.status(400).json({ message: "This is an invalid email address." });
    }

    let user = await User.findOne({ email });

    // ✅ CASE: User exists but was created via Google and has no password
    if (user && user.googleId && !user.password) {
      user.password   = await bcrypt.hash(password, 12);
      user.first_name = user.first_name || first_name;
      user.last_name  = user.last_name  || last_name;
      user.bYear      = bYear;
      user.bMonth     = bMonth;
      user.bDay       = bDay;
      user.gender     = gender;
      await user.save();

      const token = generateToken({ id: user._id.toString() }, "7d");

      return res.json({
        id:         user._id,
        username:   user.username,
        picture:    user.picture,
        first_name: user.first_name,
        last_name:  user.last_name,
        token:      token,
        verified:   user.verified,
        message:    "Password added! You can now log in with both Google and your password.",
      });
    }

    // ❌ CASE: Email already exists with password
    if (user) {
      return res.status(400).json({
        message: "This email address already exists. Please try again with a different email address.",
      });
    }

    // ✅ CASE: Fully new user
    if (!validateLength(first_name, 2, 30)) {
      return res.status(400).json({ message: "First name must be between 2 and 30 characters." });
    }
    if (!validateLength(last_name, 2, 30)) {
      return res.status(400).json({ message: "Last name must be between 2 and 30 characters." });
    }
    if (!validateLength(password, 6, 40)) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const cryptedPassword = await bcrypt.hash(password, 12);
    let tempUsername = first_name + last_name;
    let newUsername = await validateUsername(tempUsername);

    const newUser = new User({
      first_name,
      last_name,
      email,
      password: cryptedPassword,
      username: newUsername,
      bYear,
      bMonth,
      bDay,
      gender,
      verified: false,
    });

    await newUser.save();

    const emailVerificationToken = generateToken({ id: newUser._id.toString() }, "30m");
    const url = `${process.env.BASE_URL}/activate/${emailVerificationToken}`;
    sendVerificationEmail(newUser.email, newUser.first_name, url);

    const token = generateToken({ id: newUser._id.toString() }, "7d");

    res.json({
      id: newUser._id,
      username: newUser.username,
      picture: newUser.picture,
      first_name: newUser.first_name,
      last_name: newUser.last_name,
      token: token,
      verified: newUser.verified,
      message: "Thank you for registering! We sent you an email to confirm your account.",
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.activateAccount = async (req, res) => {
  try {
    const validUser = req.user.id;
    const { token } = req.body;
    const user = jwt.verify(token, process.env.TOKEN_SECRET);
    const check = await User.findById(user.id);

    if (validUser !== user.id) {
      return res.status(400).json({
        message: "You don't have the authorization to complete this operation.",
      });
    }
    if (check.verified == true) {
      return res
        .status(400)
        .json({ message: "This email is already activated." });
    } else {
      await User.findByIdAndUpdate(user.id, { verified: true });
      return res
        .status(200)
        .json({ message: "Your account has been activated successfully." });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        message:
          "The email address you entered is not connected to an account.",
      });
    }

    // ✅ Prevent bcrypt error for Google-only users
    if (!user.password) {
      return res.status(400).json({
        message: "This account was created using Google Sign-In. Please log in with Google.",
      });
    }

    const check = await bcrypt.compare(password, user.password);
    if (!check) {
      return res.status(400).json({
        message: "These are invalid credentials. Please try again.",
      });
    }
    const token = generateToken({ id: user._id.toString() }, "7d");
    res.send({
      id: user._id,
      username: user.username,
      picture: user.picture,
      first_name: user.first_name,
      last_name: user.last_name,
      token: token,
      verified: user.verified,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.sendVerification = async (req, res) => {
  try {
    const id = req.user.id;
    const user = await User.findById(id);
    if (user.verified === true) {
      return res.status(400).json({
        message: "This account is already activated.",
      });
    }
    const emailVerificationToken = generateToken(
      { id: user._id.toString() },
      "30m"
    );
    const url = `${process.env.BASE_URL}/activate/${emailVerificationToken}`;
    sendVerificationEmail(user.email, user.first_name, url);
    return res.status(200).json({
      message: "We sent an email verification link to your email address.",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.findUser = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email }).select("-password");
    if (!user) {
      return res.status(400).json({
        message: "This account does not exists.",
      });
    }
    return res.status(200).json({
      email: user.email,
      picture: user.picture,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.sendResetPasswordCode = async (req, res) => {
  try {
    const { email } = req.body;
    console.log("📩 We are checking to see if the following email address is a registered iHighlight account:", email); // ✅ Debugging

    const user = await User.findOne({ email }).select("-password");

    if (!user) {
      console.log("❌ No account found for:", email); // ✅ Debugging
      return res.status(400).json({ message: "There is no account found with that email address." });
    }

    await Code.findOneAndRemove({ user: user._id });
    const code = generateCode(5);
    const savedCode = await new Code({ code, user: user._id }).save();

    sendResetCode(user.email, user.first_name, code);
    console.log("✅ A reset code was sent successfully to:", user.email);
    
    return res.status(200).json({ message: "A reset code has been sent to your email address." });
  } catch (error) {
    console.error("❌ Server Error in sendResetPasswordCode:", error);
    res.status(500).json({ message: "There has been a server error while sending reset code." });
  }
};


exports.validateResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    const user = await User.findOne({ email });
    const Dbcode = await Code.findOne({ user: user._id });
    if (Dbcode.code !== code) {
      return res.status(400).json({
        message: "Your verification code is incorrect.",
      });
    }
    return res.status(200).json({ message: "Verification code is correct." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ message: "Email Address and New Password are required." });
    }

    const cryptedPassword = await bcrypt.hash(newPassword, 12);
    const user = await User.findOneAndUpdate(
      { email },
      { password: cryptedPassword }
    );

    if (!user) {
      return res.status(404).json({ message: "This account is not found." });
    }

    return res.status(200).json({ message: "Password has been reset successfully." });
  } catch (error) {
    return res.status(500).json({ message: error.message || "There has been a server error. Please try again." });
  }
};



exports.getProfile = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findById(req.user.id);
    const profile = await User.findOne({ username }).select("-password");
    const friendship = {
      friends: false,
      following: false,
      requestSent: false,
      requestReceived: false,
    };
    if (!profile) {
      return res.json({ ok: false });
    }

    if (
      user.friends.includes(profile._id) &&
      profile.friends.includes(user._id)
    ) {
      friendship.friends = true;
    }
    if (user.following.includes(profile._id)) {
      friendship.following = true;
    }
    if (user.requests.includes(profile._id)) {
      friendship.requestReceived = true;
    }
    if (profile.requests.includes(user._id)) {
      friendship.requestSent = true;
    }

    const posts = await Post.find({ user: profile._id })
      .populate("user")
      .populate(
        "comments.commentBy",
        "first_name last_name picture username commentAt"
      )
      .sort({ createdAt: -1 });
    await profile.populate("friends", "first_name last_name username picture");
    res.json({ ...profile.toObject(), posts, friendship });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateProfilePicture = async (req, res) => {
  try {
    const { url } = req.body;

    await User.findByIdAndUpdate(req.user.id, {
      picture: url,
    });
    res.json(url);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateCover = async (req, res) => {
  try {
    const { url } = req.body;

    await User.findByIdAndUpdate(req.user.id, {
      cover: url,
    });
    res.json(url);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateDetails = async (req, res) => {
  try {
    const { infos } = req.body;

    const updated = await User.findByIdAndUpdate(
      req.user.id,
      {
        details: infos,
      },
      {
        new: true,
      }
    );
    res.json(updated.details);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.addFriend = async (req, res) => {
  try {
    if (req.user.id !== req.params.id) {
      const sender = await User.findById(req.user.id);
      const receiver = await User.findById(req.params.id);
      if (
        !receiver.requests.includes(sender._id) &&
        !receiver.friends.includes(sender._id)
      ) {
        await receiver.updateOne({
          $push: { requests: sender._id },
        });
        await receiver.updateOne({
          $push: { followers: sender._id },
        });
        await sender.updateOne({
          $push: { following: receiver._id },
        });
        res.json({ message: "Friend Request has been sent" });
      } else {
        return res.status(400).json({ message: "Friend Request already sent" });
      }
    } else {
      return res
        .status(400)
        .json({ message: "You can't send a Friend Request to yourself" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.cancelRequest = async (req, res) => {
  try {
    if (req.user.id !== req.params.id) {
      const sender = await User.findById(req.user.id);
      const receiver = await User.findById(req.params.id);
      if (
        receiver.requests.includes(sender._id) &&
        !receiver.friends.includes(sender._id)
      ) {
        await receiver.updateOne({
          $pull: { requests: sender._id },
        });
        await receiver.updateOne({
          $pull: { followers: sender._id },
        });
        await sender.updateOne({
          $pull: { following: sender._id },
        });
        res.json({ message: "You successfully canceled the request" });
      } else {
        return res.status(400).json({ message: "This is already canceled" });
      }
    } else {
      return res
        .status(400)
        .json({ message: "You can't cancel a request to yourself" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.follow = async (req, res) => {
  try {
    if (req.user.id !== req.params.id) {
      const sender = await User.findById(req.user.id);
      const receiver = await User.findById(req.params.id);
      if (
        !receiver.followers.includes(sender._id) &&
        !sender.following.includes(receiver._id)
      ) {
        await receiver.updateOne({
          $push: { followers: sender._id },
        });

        await sender.updateOne({
          $push: { following: receiver._id },
        });
        res.json({ message: "You are already followed successfully." });
      } else {
        return res.status(400).json({ message: "You are already following successfully." });
      }
    } else {
      return res.status(400).json({ message: "You are not allowed to follow yourself." });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.unfollow = async (req, res) => {
  try {
    if (req.user.id !== req.params.id) {
      const sender = await User.findById(req.user.id);
      const receiver = await User.findById(req.params.id);
      if (
        receiver.followers.includes(sender._id) &&
        sender.following.includes(receiver._id)
      ) {
        await receiver.updateOne({
          $pull: { followers: sender._id },
        });

        await sender.updateOne({
          $pull: { following: receiver._id },
        });
        res.json({ message: "You are already unfollowed successfully." });
      } else {
        return res.status(400).json({ message: "You are already followed successfully." });
      }
    } else {
      return res.status(400).json({ message: "You are not allowed to unfollow yourself." });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.acceptRequest = async (req, res) => {
  try {
    if (req.user.id !== req.params.id) {
      const receiver = await User.findById(req.user.id);
      const sender = await User.findById(req.params.id);
      if (receiver.requests.includes(sender._id)) {
        await receiver.update({
          $push: { friends: sender._id, following: sender._id },
        });
        await sender.update({
          $push: { friends: receiver._id, followers: receiver._id },
        });
        await receiver.updateOne({
          $pull: { requests: sender._id },
        });
        res.json({ message: "Friend Request has been accepted." });
      } else {
        return res.status(400).json({ message: "You are already friends on iHighlight" });
      }
    } else {
      return res
        .status(400)
        .json({ message: "You are not able to accept a Friend Request with yourself." });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.unfriend = async (req, res) => {
  try {
    if (req.user.id !== req.params.id) {
      const sender = await User.findById(req.user.id);
      const receiver = await User.findById(req.params.id);
      if (
        receiver.friends.includes(sender._id) &&
        sender.friends.includes(receiver._id)
      ) {
        await receiver.update({
          $pull: {
            friends: sender._id,
            following: sender._id,
            followers: sender._id,
          },
        });
        await sender.update({
          $pull: {
            friends: receiver._id,
            following: receiver._id,
            followers: receiver._id,
          },
        });

        res.json({ message: "Unfriending was successful." });
      } else {
        return res.status(400).json({ message: "Unfriending was successful." });
      }
    } else {
      return res.status(400).json({ message: "You are unable unfriend yourself." });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.deleteRequest = async (req, res) => {
  try {
    if (req.user.id !== req.params.id) {
      const receiver = await User.findById(req.user.id);
      const sender = await User.findById(req.params.id);
      if (receiver.requests.includes(sender._id)) {
        await receiver.update({
          $pull: {
            requests: sender._id,
            followers: sender._id,
          },
        });
        await sender.update({
          $pull: {
            following: receiver._id,
          },
        });

        res.json({ message: "Deleting Friend Request was successful." });
      } else {
        return res.status(400).json({ message: "Deleting Friend Request was successful." });
      }
    } else {
      return res.status(400).json({ message: "You are unable to delete a friend request with yourself." });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.search = async (req, res) => {
  try {
    const searchTerm = req.params.searchTerm;
    const results = await User.find({ $text: { $search: searchTerm } }).select(
      "first_name last_name username picture"
    );
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.addToSearchHistory = async (req, res) => {
  try {
    const { searchUser } = req.body;
    const search = {
      user: searchUser,
      createdAt: new Date(),
    };
    const user = await User.findById(req.user.id);
    const check = user.search.find((x) => x.user.toString() === searchUser);
    if (check) {
      await User.updateOne(
        {
          _id: req.user.id,
          "search._id": check._id,
        },
        {
          $set: { "search.$.createdAt": new Date() },
        }
      );
    } else {
      await User.findByIdAndUpdate(req.user.id, {
        $push: {
          search,
        },
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.getSearchHistory = async (req, res) => {
  try {
    const results = await User.findById(req.user.id)
      .select("search")
      .populate("search.user", "first_name last_name username picture");
    res.json(results.search);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.removeFromSearch = async (req, res) => {
  try {
    const { searchUser } = req.body;
    await User.updateOne(
      {
        _id: req.user.id,
      },
      { $pull: { search: { user: searchUser } } }
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.getFriendsPageInfos = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("friends requests")
      .populate("friends", "first_name last_name picture username")
      .populate("requests", "first_name last_name picture username");
    const sentRequests = await User.find({
      requests: mongoose.Types.ObjectId(req.user.id),
    }).select("first_name last_name picture username");
    res.json({
      friends: user.friends,
      requests: user.requests,
      sentRequests,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
