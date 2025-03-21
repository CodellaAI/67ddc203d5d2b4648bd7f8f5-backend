
const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { uploadProfilePicture } = require('../config/cloudinary');
const multer = require('multer');

// @route   GET api/users/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('followers', '_id name username profilePicture')
      .populate('following', '_id name username profilePicture');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/users/:username
// @desc    Get user by username
// @access  Public
router.get('/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('-password')
      .populate('followers', '_id name username profilePicture')
      .populate('following', '_id name username profilePicture');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT api/users
// @desc    Update user profile
// @access  Private
router.put(
  '/',
  protect,
  uploadProfilePicture.fields([
    { name: 'profilePicture', maxCount: 1 },
    { name: 'coverPhoto', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const { name, bio, location, website } = req.body;
      
      // Build user object
      const userFields = {};
      if (name) userFields.name = name;
      if (bio) userFields.bio = bio;
      if (location) userFields.location = location;
      if (website) userFields.website = website;
      
      // Add profile picture if uploaded
      if (req.files && req.files.profilePicture) {
        userFields.profilePicture = req.files.profilePicture[0].path;
      }
      
      // Add cover photo if uploaded
      if (req.files && req.files.coverPhoto) {
        userFields.coverPhoto = req.files.coverPhoto[0].path;
      }
      
      // Update user
      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: userFields },
        { new: true }
      ).select('-password');
      
      res.json(user);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// @route   POST api/users/:id/follow
// @desc    Follow/unfollow a user
// @access  Private
router.post('/:id/follow', protect, async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }
    
    const userToFollow = await User.findById(req.params.id);
    if (!userToFollow) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const currentUser = await User.findById(req.user._id);
    
    // Check if already following
    if (currentUser.following.includes(req.params.id)) {
      // Unfollow
      await User.findByIdAndUpdate(req.user._id, {
        $pull: { following: req.params.id }
      });
      
      await User.findByIdAndUpdate(req.params.id, {
        $pull: { followers: req.user._id }
      });
      
      res.json({ message: 'User unfollowed' });
    } else {
      // Follow
      await User.findByIdAndUpdate(req.user._id, {
        $push: { following: req.params.id }
      });
      
      await User.findByIdAndUpdate(req.params.id, {
        $push: { followers: req.user._id }
      });
      
      res.json({ message: 'User followed' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/users/suggestions
// @desc    Get user suggestions to follow
// @access  Private
router.get('/suggestions', protect, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    
    // Find users that the current user is not following
    const users = await User.find({
      _id: { $ne: req.user._id, $nin: currentUser.following },
    })
    .select('_id name username profilePicture')
    .limit(5);
    
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
