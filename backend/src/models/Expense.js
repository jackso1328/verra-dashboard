const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  category: {
    type: String,
    enum: ['marketing', 'packaging', 'shipping_carrier', 'operational', 'salaries', 'utilities', 'other'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    default: Date.now,
    required: true
  },
  campaignOrVendor: {
    type: String,
    default: ''
  },
  recordedBy: {
    type: String,
    default: 'Admin'
  }
}, {
  timestamps: true
});

expenseSchema.index({ category: 1, date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
