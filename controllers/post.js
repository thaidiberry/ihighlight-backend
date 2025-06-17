const Post = require("../models/Post");
const User = require("../models/User");

exports.createPost = async (req, res) => {
  try {
    const post = await new Post(req.body).save();
    await post.populate("user", "first_name last_name cover picture username");
    res.json(post);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};


exports.getAllPosts = async (req, res) => {
  try {
    console.log("🛡️ Token received in getAllPosts:", req.headers.authorization);
    console.log("🧑‍💻 Authenticated user:", req.user); // populated by auth middleware
    console.log("🔥 Inside getAllPosts handler");

    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized. User not found in token." });
    }

    // 🔍 Try finding user by _id or googleId fallback
    const userDoc =
      (await User.findById(req.user.id).select("following")) ||
      (await User.findOne({ googleId: req.user.id }).select("following"));

    if (!userDoc) {
      console.warn("⚠️ User not found with _id or googleId:", req.user.id);
      return res.status(404).json({ message: "User not found." });
    }

    const following = userDoc.following;

    // 🧵 Fetch posts from followed users
    const promises = following.map((userId) =>
      Post.find({ user: userId })
        .populate("user", "first_name last_name picture username cover")
        .populate("comments.commentBy", "first_name last_name picture username")
        .sort({ createdAt: -1 })
        .limit(10)
    );

    const followingPosts = (await Promise.all(promises)).flat();

    // 👤 Also include the current user's posts
    const userPosts = await Post.find({ user: req.user.id })
      .populate("user", "first_name last_name picture username cover")
      .populate("comments.commentBy", "first_name last_name picture username")
      .sort({ createdAt: -1 })
      .limit(10);

    const combinedPosts = [...followingPosts, ...userPosts].sort(
      (a, b) => b.createdAt - a.createdAt
    );

    res.json(combinedPosts);
  } catch (error) {
    console.error("❌ getAllPosts error:", error.message);
    return res.status(400).json({ message: "Something went wrong" });
  }
};

exports.getPublicPosts = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const userPosts = await Post.find({
      createdAt: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000), // End of day
      }
    })
      .populate("user", "first_name last_name picture username cover")
      .populate("comments.commentBy", "first_name last_name picture username")
      .sort({ createdAt: -1 })
      .limit(10);
    res.json(userPosts);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.comment = async (req, res) => {
  try {
    const { comment, image, postId } = req.body;
    let newComments = await Post.findByIdAndUpdate(
      postId,
      {
        $push: {
          comments: {
            comment: comment,
            image: image,
            commentBy: req.user.id,
            commentAt: new Date(),
          },
        },
      },
      {
        new: true,
      }
    ).populate("comments.commentBy", "picture first_name last_name username");
    res.json(newComments.comments);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.savePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const user = await User.findById(req.user.id);
    const check = user?.savedPosts.find(
      (post) => post.post.toString() == postId
    );
    if (check) {
      await User.findByIdAndUpdate(req.user.id, {
        $pull: {
          savedPosts: {
            _id: check._id,
          },
        },
      });
    } else {
      await User.findByIdAndUpdate(req.user.id, {
        $push: {
          savedPosts: {
            post: postId,
            savedAt: new Date(),
          },
        },
      });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.deletePost = async (req, res) => {
  try {
    await Post.findByIdAndRemove(req.params.id);
    res.json({ status: "ok" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getTodayPosts = async (req, res) => {
  try {
    const posts = await Post.find({
      createdAt: { $gte: today },
    })
      .populate("user", "username first_name last_name picture gender cover")
      .populate("comments.commentBy", "username picture") // ✅ GOOD
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch today's posts" });
  }
};


