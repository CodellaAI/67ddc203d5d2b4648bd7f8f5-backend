
const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const Comment = require('../models/Comment');
const Tweet = require('../models/Tweet');
const { protect } = require('../middleware/auth');

// @route   POST api/comments/:id/like
// @desc    Like/unlike a comment
// @access  Private
router.post('/:id/like', protect, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    // Check if the comment has already been liked by the user
    if (comment.likes.includes(req.user._id)) {
      // Unlike
      comment.likes = comment.likes.filter(
        like => like.toString() !== req.user._id.toString()
      );
    } else {
      // Like
      comment.likes.unshift(req.user._id);
    }
    
    await comment.save();
    
    res.json(comment.likes);
  } catch (error) {
    console.error(error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Comment not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE api/comments/:id
// @desc    Delete a comment
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    // Check if user owns the comment
    if (comment.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'User not authorized' });
    }
    
    // Remove comment from tweet's comments array
    await Tweet.findByIdAndUpdate(comment.tweet, {
      $pull: { comments: comment._id }
    });
    
    await comment.deleteOne();
    
    res.json({ message: 'Comment removed' });
  } catch (error) {
    console.error(error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Comment not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
