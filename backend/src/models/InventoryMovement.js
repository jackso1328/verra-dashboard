const mongoose = require('mongoose');

const inventoryMovementSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  movementType: {
    type: String,
    enum: ['sale', 'restock', 'adjustment', 'return'],
    required: true
  },
  quantityChange: {
    type: Number,
    required: true
  },
  previousStock: {
    type: Number,
    required: true
  },
  newStock: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  relatedOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
  performedBy: {
    type: String,
    default: 'System / Admin'
  },
  date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

inventoryMovementSchema.index({ product: 1, date: -1 });

module.exports = mongoose.model('InventoryMovement', inventoryMovementSchema);
