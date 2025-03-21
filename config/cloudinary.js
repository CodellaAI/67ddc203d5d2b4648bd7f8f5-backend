
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Storage for profile pictures
const profileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'chirp-social/profiles',
    allowed_formats: ['jpg', 'png', 'jpeg', 'gif'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }]
  }
});

// Storage for tweet images
const tweetStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'chirp-social/tweets',
    allowed_formats: ['jpg', 'png', 'jpeg', 'gif'],
    transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
  }
});

// Upload middleware
const uploadProfilePicture = multer({ storage: profileStorage });
const uploadTweetImage = multer({ storage: tweetStorage });

module.exports = {
  cloudinary,
  uploadProfilePicture,
  uploadTweetImage
};
