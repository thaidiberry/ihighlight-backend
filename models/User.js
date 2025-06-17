const mongoose = require("mongoose");
mongoose.set('strictQuery', true);
const { ObjectId } = mongoose.Schema;

const userSchema = mongoose.Schema(
  {
    // ✅ Add Google ID field
    googleId: {
      type: String,
      unique: true,
      sparse: true, // allows null values without breaking uniqueness
    },

    first_name: {
      type: String,
      required: [true, "first name is required"],
      trim: true,
      text: true,
    },
    last_name: {
      type: String,
      required: [true, "last name is required"],
      trim: true,
      text: true,
    },
    username: {
      type: String,
      required: [true, "username is required"],
      trim: true,
      text: true,
      unique: true,
    },
    email: {
      type: String,
      required: [true, "email is required"],
      trim: true,
      unique: true,
    },

    // ✅ Optional password when using Google
    password: {
      type: String,
      required: function () {
        return !this.googleId; // only required if no Google ID
      },
    },

    picture: {
      type: String,
      trim: true,
      default:
        "https://res.cloudinary.com/dx8ht3lz4/image/upload/v1726091507/default_profile_photo.jpg",
    },
    cover: {
      type: String,
      trim: true,
    },

    bYear: { type: Number, required: true, trim: true },
    bMonth: { type: Number, required: true, trim: true },
    bDay: { type: Number, required: true, trim: true },

    verified: { type: Boolean, default: false },

    friends: [{ type: ObjectId, ref: "User" }],
    following: [{ type: ObjectId, ref: "User" }],
    followers: [{ type: ObjectId, ref: "User" }],
    requests: [{ type: ObjectId, ref: "User" }],

    search: [
      {
        user: { type: ObjectId, ref: "User", required: true },
        createdAt: { type: Date, required: true },
      },
    ],

    details: {
      bio: String,
      otherName: String,
      job: String,
      workplace: String,
      highSchool: String,
      college: String,
      currentCity: String,
      hometown: String,
      relationship: {
        type: String,
        enum: ["Single", "In a relationship", "Married", "Divorced"],
      },
      instagram: String,
    },

    savedPosts: [
      {
        post: { type: ObjectId, ref: "Post" },
        savedAt: { type: Date, required: true },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);

