const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  authorName: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  headline: {
    type: String,
    required: true
  },
  comment: {
    type: String,
    required: true
  },
  isVerified: {
    type: Boolean,
    default: true
  },
  moderationStatus: {
    type: String,
    enum: ['approved', 'pending', 'rejected'],
    default: 'approved'
  }
}, {
  timestamps: true
});

reviewSchema.index({ product: 1, moderationStatus: 1 });

module.exports = mongoose.model('Review', reviewSchema);
