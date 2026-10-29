const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  sku: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    default: 'Hair Oils'
  },
  sizeMl: {
    type: Number,
    required: true
  },
  price: {
    type: Number, // In Indian Rupees (₹)
    required: true,
    min: 0
  },
  unitCost: {
    type: Number, // COGS unit cost in ₹
    required: true,
    min: 0
  },
  description: {
    type: String,
    required: true
  },
  keyIngredients: [{
    type: String
  }],
  ritualDirections: {
    type: String,
    default: 'Warm 3-4 drops between palms. Inhale botanical aroma. Massage gently into scalp or smooth through hair lengths.'
  },
  image: {
    type: String,
    required: true
  },
  stockQuantity: {
    type: Number,
    required: true,
    default: 100,
    min: 0
  },
  reorderThreshold: {
    type: Number,
    required: true,
    default: 20
  },
  isActive: {
    type: Boolean,
    default: true
  },
  featured: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

productSchema.index({ isActive: 1 });

module.exports = mongoose.model('Product', productSchema);
