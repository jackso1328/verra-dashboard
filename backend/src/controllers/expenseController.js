const Expense = require('../models/Expense');

// @desc    Get all expenses
// @route   GET /api/admin/expenses
// @access  Admin
const getExpenses = async (req, res, next) => {
  try {
    const expenses = await Expense.find().sort({ date: -1 }).limit(50);
    res.json({
      success: true,
      count: expenses.length,
      data: expenses
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new expense entry
// @route   POST /api/admin/expenses
// @access  Admin
const createExpense = async (req, res, next) => {
  try {
    const { category, amount, description, date, campaignOrVendor } = req.body;

    if (!category || !amount || !description) {
      return res.status(400).json({
        success: false,
        message: 'Category, amount, and description are required.'
      });
    }

    const expense = await Expense.create({
      category,
      amount: parseFloat(amount),
      description,
      date: date ? new Date(date) : new Date(),
      campaignOrVendor: campaignOrVendor || '',
      recordedBy: req.user ? req.user.name : 'Admin'
    });

    res.status(201).json({
      success: true,
      message: 'Expense recorded successfully.',
      data: expense
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getExpenses, createExpense };
