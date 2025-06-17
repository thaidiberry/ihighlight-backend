const express = require("express");
const {
  createPost,
  getAllPosts,
  getPublicPosts,
  comment,
  savePost,
  deletePost,
} = require("../controllers/post");

const router = express.Router();

// Public route
router.get("/getPublicPosts", getPublicPosts);

const { authUser } = require("../middlwares/auth");


// Protected routes
router.post("/createPost", authUser, createPost);
router.get("/getAllPosts", authUser, getAllPosts);
router.put("/comment", authUser, comment);
router.put("/savePost/:id", authUser, savePost);
router.delete("/deletePost/:id", authUser, deletePost);

module.exports = router;
