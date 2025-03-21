
const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const Tweet = require('../models/Tweet');
const User = require('../models/User');
const Comment = require('../models/Comment');
const { protect } = require('../middleware/auth');
const { uploadTweetImage } = require('../config/cloudinary');

// @route   POST api/tweets
// @desc    Create a tweet
// @access  Private
router.post(
  '/',
  protect,
  uploadTweetImage.single('image'),
  [
    check('content', 'Content is required').not().isEmpty().unless((value, { req }) => req.file),
    check('content', 'Content cannot exceed 280 characters').isLength({ max: 280 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const newTweet = new Tweet({
        user: req.user._id,
        content: req.body.content || '',
        image: req.file ? req.file.path : null
      });

      const tweet = await newTweet.save();
      
      // Populate user info for response
      await tweet.populate('user', 'name username profilePicture');
      
      res.status(201).json(tweet);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// @route   GET api/tweets
// @desc    Get all tweets
// @access  Public
router.get('/', async (req, res) => {
  try {
    const tweets = await Tweet.find()
      .sort({ createdAt: -1 })
      .populate('user', 'name username profilePicture isVerified')
      .limit(20);
    
    res.json(tweets);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/tweets/timeline
// @desc    Get tweets for user timeline (tweets from users they follow)
// @access  Private
router.get('/timeline', protect, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    
    // Get tweets from current user and users they follow
    const tweets = await Tweet.find({
      $or: [
        { user: req.user._id },
        { user: { $in: currentUser.following } }
      ]
    })
    .sort({ createdAt: -1 })
    .populate('user', 'name username profilePicture isVerified')
    .limit(50);
    
    res.json(tweets);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/tweets/:id
// @desc    Get tweet by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const tweet = await Tweet.findById(req.params.id)
      .populate('user', 'name username profilePicture isVerified');
    
    if (!tweet) {
      return res.status(404).json({ message: 'Tweet not found' });
    }
    
    res.json(tweet);
  } catch (error) {
    console.error(error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Tweet not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE api/tweets/:id
// @desc    Delete a tweet
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const tweet = await Tweet.findById(req.params.id);
    
    if (!tweet) {
      return res.status(404).json({ message: 'Tweet not found' });
    }
    
    // Check if user owns the tweet
    if (tweet.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'User not authorized' });
    }
    
    // Delete comments associated with the tweet
    await Comment.deleteMany({ tweet: req.params.id });
    
    await tweet.deleteOne();
    
    res.json({ message: 'Tweet removed' });
  } catch (error) {
    console.error(error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Tweet not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/tweets/:id/like
// @desc    Like/unlike a tweet
// @access  Private
router.post('/:id/like', protect, async (req, res) => {
  try {
    const tweet = await Tweet.findById(req.params.id);
    
    if (!tweet) {
      return res.status(404).json({ message: 'Tweet not found' });
    }
    
    // Check if the tweet has already been liked by the user
    if (tweet.likes.includes(req.user._id)) {
      // Unlike
      tweet.likes = tweet.likes.filter(
        like => like.toString() !== req.user._id.toString()
      );
    } else {
      // Like
      tweet.likes.unshift(req.user._id);
    }
    
    await tweet.save();
    
    res.json(tweet.likes);
  } catch (error) {
    console.error(error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Tweet not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/tweets/:id/comments
// @desc    Comment on a tweet
// @access  Private
router.post(
  '/:id/comments',
  [
    protect,
    check('content', 'Content is required').not().isEmpty(),
    check('content', 'Content cannot exceed 280 characters').isLength({ max: 280 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const tweet = await Tweet.findById(req.params.id);
      
      if (!tweet) {
        return res.status(404).json({ message: 'Tweet not found' });
      }
      
      const newComment = new Comment({
        content: req.body.content,
        user: req.user._id,
        tweet: req.params.id
      });
      
      const comment = await newComment.save();
      
      // Add comment to tweet's comments array
      tweet.comments.push(comment._id);
      await tweet.save();
      
      // Populate user info for response
      await comment.populate('user', 'name username profilePicture');
      
      res.json(comment);
    } catch (error) {
      console.error(error);
      if (error.kind === 'ObjectId') {
        return res.status(404).json({ message: 'Tweet not found' });
      }
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// @route   GET api/tweets/:id/comments
// @desc    Get comments for a tweet
// @access  Public
router.get('/:id/comments', async (req, res) => {
  try {
    const comments = await Comment.find({ tweet: req.params.id })
      .sort({ createdAt: -1 })
      .populate('user', 'name username profilePicture isVerified');
    
    res.json(comments);
  } catch (error) {
    console.error(error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Tweet not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/tweets/user/:userId
// @desc    Get tweets by user ID
// @access  Public
router.get('/user/:userId', async (req, res) => {
  try {
    const tweets = await Tweet.find({ user: req.params.userId })
      .sort({ createdAt: -1 })
      .populate('user', 'name username profilePicture isVerified');
    
    res.json(tweets);
  } catch (error) {
    console.error(error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
