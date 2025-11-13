import Booking from '../models/Booking.js';
import ParkingSpace from '../models/ParkingSpace.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

/**
 * Get comprehensive statistics for the provider dashboard.
 * @route GET /api/dashboard/provider-stats
 * @access Private (Provider only)
 */
export const getProviderStats = async (req, res) => {
  try {
    const providerId = req.user._id;

    // 1. Total Earnings (Sum of totalPrice for completed bookings)
    const earningsResult = await Booking.aggregate([
      { $match: { providerId: new mongoose.Types.ObjectId(providerId), status: 'completed', paymentStatus: 'paid' } },
      { $group: { _id: null, totalEarnings: { $sum: '$totalPrice' } } }
    ]);
    const totalEarnings = earningsResult.length > 0 ? earningsResult[0].totalEarnings : 0;

    // 2. Total Spaces (Count of parking spaces owned by the provider)
    const totalSpaces = await ParkingSpace.countDocuments({ owner: providerId, isDeleted: false });

    // 3. Booking Status Counts (Pending, Accepted, Completed, Cancelled)
    const bookingStatusCounts = await Booking.aggregate([
      { $match: { providerId: new mongoose.Types.ObjectId(providerId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const stats = bookingStatusCounts.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {
      pending: 0,
      accepted: 0,
      completed: 0,
      cancelled: 0,
      total: 0,
    });
    stats.total = Object.values(stats).reduce((sum, count) => sum + count, 0);

    // 4. Monthly Earnings (Last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyEarnings = await Booking.aggregate([
      { $match: {
        providerId: new mongoose.Types.ObjectId(providerId),
        status: 'completed',
        paymentStatus: 'paid',
        createdAt: { $gte: sixMonthsAgo }
      }},
      { $group: {
        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
        total: { $sum: '$totalPrice' }
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // 5. Space Status Counts (Approved, Pending, Inactive)
    const spaceStatusCounts = await ParkingSpace.aggregate([
      { $match: { owner: new mongoose.Types.ObjectId(providerId), isDeleted: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const spaceStats = spaceStatusCounts.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {
      approved: 0,
      pending: 0,
      inactive: 0,
      total: totalSpaces,
    });

    res.status(200).json({
      totalEarnings,
      totalSpaces,
      bookingStats: stats,
      monthlyEarnings,
      spaceStats,
    });

  } catch (error) {
    console.error('Error fetching provider stats:', error);
    res.status(500).json({ message: 'Server error fetching dashboard statistics', error: error.message });
  }
};
