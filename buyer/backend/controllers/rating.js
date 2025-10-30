// import Rating from '../models/Rating.js';
// import Booking from '../models/Booking.js';
// import User from '../models/User.js';

// /**
//  * POST /api/ratings
//  * Body: { bookingId, score, comment }
//  */
// // export const createRating = async (req, res) => {
// //   try {
// //     // Authentication: protect middleware should set req.user
// //     if (!req.user || !req.user._id) {
// //       return res.status(401).json({ message: 'Not authenticated' });
// //     }
// //     const fromUser = req.user._id;
// //     const { bookingId, score, comment = '' } = req.body;

// //     // Input validation
// //     if (!bookingId) return res.status(400).json({ message: 'bookingId is required' });
// //     if (score === undefined || score === null) return res.status(400).json({ message: 'score is required' });
// //     const numericScore = Number(score);
// //     if (Number.isNaN(numericScore) || numericScore < 1 || numericScore > 5) {
// //       return res.status(400).json({ message: 'score must be a number between 1 and 5' });
// //     }

// //     // Ensure booking exists
// //     const booking = await Booking.findById(bookingId)
// //       .populate('parkingSpace')
// //       .lean();
// //     if (!booking) return res.status(404).json({ message: 'Booking not found' });

// //     // Determine buyerId and sellerId from common possible fields.
// //     const buyerId =
// //       booking.user?._id ||
// //       booking.buyer?._id ||
// //       booking.buyer ||
// //       booking.customer?._id ||
// //       booking.customer ||
// //       null;

// //     const sellerId =
// //       booking.provider?._id ||
// //       booking.seller?._id ||
// //       booking.owner?._id ||
// //       booking.provider ||
// //       booking.owner ||
// //       null;

// //     if (!buyerId || !sellerId) {
// //       console.error('createRating: booking missing buyer/seller', { bookingId, booking });
// //       return res.status(400).json({ message: 'Booking missing buyer/seller information' });
// //     }

// //     // Determine direction and flag field
// //     let toUser = null;
// //     let flagField = null;
// //     if (String(fromUser) === String(buyerId)) {
// //       toUser = sellerId;
// //       flagField = 'buyerRatedSeller';
// //     } else if (String(fromUser) === String(sellerId)) {
// //       toUser = buyerId;
// //       flagField = 'sellerRatedBuyer';
// //     } else {
// //       return res.status(403).json({ message: 'You are not part of this booking, cannot rate.' });
// //     }

// //     // Prevent duplicate rating for same booking/fromUser
// //     const existing = await Rating.findOne({ booking: bookingId, fromUser });
// //     if (existing) return res.status(400).json({ message: 'You have already rated this booking.' });

// //     // Create rating
// //     const rating = await Rating.create({
// //       booking: bookingId,
// //       fromUser,
// //       toUser,
// //       score: numericScore,
// //       comment: String(comment).trim(),
// //     });

// //     // Update booking flag safely (non-fatal if fails)
// //     if (flagField && typeof flagField === 'string') {
// //       try {
// //         await Booking.findByIdAndUpdate(bookingId, { [flagField]: true });
// //       } catch (e) {
// //         console.error('createRating: failed to update booking flag (non-fatal)', e);
// //       }
// //     } else {
// //       console.warn('createRating: invalid flagField, skipping booking update', { flagField });
// //     }

// //     // Optionally update recipient user's avgRating and ratingsCount (best-effort)
// //     try {
// //       const userDoc = await User.findById(toUser);
// //       if (userDoc) {
// //         const agg = await Rating.aggregate([
// //           { $match: { toUser: userDoc._id } },
// //           { $group: { _id: '$toUser', avg: { $avg: '$score' }, cnt: { $sum: 1 } } },
// //         ]);
// //         if (agg && agg.length) {
// //           userDoc.avgRating = agg[0].avg;
// //           userDoc.ratingsCount = agg[0].cnt;
// //           await userDoc.save().catch((e) => {
// //             console.error('createRating: failed to save user avgRating (non-fatal)', e);
// //           });
// //         }
// //       }
// //     } catch (e) {
// //       console.error('createRating: error updating user avgRating (non-fatal)', e);
// //     }

// //     return res.status(201).json({ message: 'Rating saved successfully', rating });
// //   } catch (err) {
// //     console.error('createRating error:', err && err.stack ? err.stack : err);
// //     return res.status(500).json({ message: 'Internal Server Error', error: err?.message || String(err) });
// //   }
// // };
//  // ---OLD 

//  // backend/controllers/rating.js  (replace createRating with this)
// export const createRating = async (req, res) => {
//   try {
//     // auth check (protect middleware should provide req.user)
//     if (!req.user || !req.user._id) return res.status(401).json({ message: 'Not authenticated' });

//     const fromUser = String(req.user._id);
//     const { bookingId, score, comment = '' } = req.body;

//     // basic validation
//     if (!bookingId) return res.status(400).json({ message: 'bookingId is required' });
//     const numericScore = Number(score);
//     if (!Number.isFinite(numericScore) || numericScore < 1 || numericScore > 5) {
//       return res.status(400).json({ message: 'score must be a number between 1 and 5' });
//     }

//     // load booking (no heavy population required)
//     const booking = await Booking.findById(bookingId).lean();
//     if (!booking) return res.status(404).json({ message: 'Booking not found' });

//     // helper: normalize different shapes to string id
//     const toId = (v) => {
//       if (!v && v !== 0) return null;
//       // mongoose ObjectId or plain object with _id
//       if (typeof v === 'object') {
//         if (v._id) return String(v._id);
//         if (v.id) return String(v.id);
//         // maybe it's already plain object with nested user
//         return null;
//       }
//       return String(v);
//     };

//     // Try common fields for buyer & seller
//     let buyerId =
//       toId(booking.user) ||
//       toId(booking.userId) ||
//       toId(booking.buyer) ||
//       toId(booking.buyerId) ||
//       toId(booking.customer) ||
//       toId(booking.customerId) ||
//       null;

//     let sellerId =
//       toId(booking.provider) ||
//       toId(booking.providerId) ||
//       toId(booking.seller) ||
//       toId(booking.sellerId) ||
//       toId(booking.owner) ||
//       toId(booking.ownerId) ||
//       null;

//     // fallback: parkingSpace.owner (common pattern)
//     if (!sellerId && booking.parkingSpace) {
//       sellerId =
//         toId(booking.parkingSpace.owner) ||
//         toId(booking.parkingSpace.ownerId) ||
//         toId(booking.parkingSpace.createdBy) ||
//         null;
//     }

//     // if still missing, return helpful error (also logs)
//     if (!buyerId || !sellerId) {
//       console.error('createRating: missing buyer/seller', {
//         bookingId,
//         buyerId,
//         sellerId,
//         bookingSample: {
//           user: booking.user,
//           buyer: booking.buyer,
//           provider: booking.provider,
//           owner: booking.owner,
//           parkingSpaceOwner: booking.parkingSpace?.owner,
//         },
//       });
//       return res.status(400).json({ message: 'Booking missing buyer/seller information' });
//     }

//     // determine direction
//     let toUser = null;
//     let flagField = null;
//     if (String(fromUser) === String(buyerId)) {
//       toUser = sellerId;
//       flagField = 'buyerRatedSeller';
//     } else if (String(fromUser) === String(sellerId)) {
//       toUser = buyerId;
//       flagField = 'sellerRatedBuyer';
//     } else {
//       return res.status(403).json({ message: 'You are not part of this booking, cannot rate.' });
//     }

//     // prevent duplicate rating for same booking by same fromUser
//     const existing = await Rating.findOne({ booking: bookingId, fromUser });
//     if (existing) return res.status(400).json({ message: 'You have already rated this booking.' });

//     // create rating
//     const rating = await Rating.create({
//       booking: bookingId,
//       fromUser,
//       toUser,
//       score: numericScore,
//       comment: String(comment || '').trim(),
//     });

//     // update booking flag (best-effort)
//     if (flagField) {
//       try {
//         await Booking.findByIdAndUpdate(bookingId, { [flagField]: true });
//       } catch (e) {
//         console.error('createRating: failed to update booking flag (non-fatal)', e);
//       }
//     }

//     // optional: update recipient's aggregated rating (best-effort)
//     try {
//       const agg = await Rating.aggregate([
//         { $match: { toUser: mongoose.Types.ObjectId(String(toUser)) } },
//         { $group: { _id: '$toUser', avg: { $avg: '$score' }, cnt: { $sum: 1 } } },
//       ]);
//       if (agg && agg.length) {
//         await User.findByIdAndUpdate(String(toUser), { avgRating: agg[0].avg, ratingsCount: agg[0].cnt }).catch((e) => {
//           console.error('createRating: failed to update user avg (non-fatal)', e);
//         });
//       }
//     } catch (e) {
//       console.error('createRating: agg update error (non-fatal)', e);
//     }

//     return res.status(201).json({ message: 'Rating saved successfully', rating });
//   } catch (err) {
//     console.error('createRating error:', err && err.stack ? err.stack : err);
//     return res.status(500).json({ message: 'Internal Server Error', error: String(err?.message || err) });
//   }
// };


// /**
//  * GET /api/ratings/user/:userId
//  */
// export const getRatingsForUser = async (req, res) => {
//   try {
//     const { userId } = req.params;
//     if (!userId) return res.status(400).json({ message: 'userId required' });

//     const ratings = await Rating.find({ toUser: userId })
//       .populate('fromUser', 'name email')
//       .populate('booking', 'status')
//       .sort({ createdAt: -1 });

//     return res.json(ratings);
//   } catch (err) {
//     console.error('getRatingsForUser error:', err && err.stack ? err.stack : err);
//     return res.status(500).json({ message: 'Internal Server Error', error: err?.message || String(err) });
//   }
// };
// backend/controllers/rating.js
import mongoose from 'mongoose';
import Rating from '../models/Rating.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';

/**
 * POST /api/ratings
 * Body: { bookingId, score, comment, parkingSpaceId? }
 */
export const createRating = async (req, res) => {
  try {
    // auth check
    if (!req.user || !req.user._id) return res.status(401).json({ message: 'Not authenticated' });

    const fromUser = String(req.user._id);
    const { bookingId, score, comment = '', parkingSpaceId } = req.body;

    // basic validation
    if (!bookingId) return res.status(400).json({ message: 'bookingId is required' });
    const numericScore = Number(score);
    if (!Number.isFinite(numericScore) || numericScore < 1 || numericScore > 5) {
      return res.status(400).json({ message: 'score must be a number between 1 and 5' });
    }

    // optional: validate parkingSpaceId format
    if (parkingSpaceId && !mongoose.Types.ObjectId.isValid(String(parkingSpaceId))) {
      return res.status(400).json({ message: 'parkingSpaceId is invalid' });
    }

    // load booking (lean for performance)
    const booking = await Booking.findById(bookingId).lean();
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // helper: normalize different shapes to string id
    const toId = (v) => {
      if (v === null || v === undefined) return null;
      if (typeof v === 'object') {
        if (v._id) return String(v._id);
        if (v.id) return String(v.id);
        return null;
      }
      return String(v);
    };

    // deduce buyer and seller from common booking shapes
    let buyerId =
      toId(booking.user) ||
      toId(booking.userId) ||
      toId(booking.buyer) ||
      toId(booking.buyerId) ||
      toId(booking.customer) ||
      toId(booking.customerId) ||
      null;

    let sellerId =
      toId(booking.provider) ||
      toId(booking.providerId) ||
      toId(booking.seller) ||
      toId(booking.sellerId) ||
      toId(booking.owner) ||
      toId(booking.ownerId) ||
      null;

    // fallback: booking.parkingSpace.owner or createdBy
    if (!sellerId && booking.parkingSpace) {
      sellerId =
        toId(booking.parkingSpace.owner) ||
        toId(booking.parkingSpace.ownerId) ||
        toId(booking.parkingSpace.createdBy) ||
        null;
    }

    if (!buyerId || !sellerId) {
      console.error('createRating: missing buyer/seller', { bookingId, buyerId, sellerId, bookingSample: booking });
      return res.status(400).json({ message: 'Booking missing buyer/seller information' });
    }

    // determine direction
    let toUser = null;
    let flagField = null;
    if (String(fromUser) === String(buyerId)) {
      toUser = sellerId;
      flagField = 'buyerRatedSeller';
    } else if (String(fromUser) === String(sellerId)) {
      toUser = buyerId;
      flagField = 'sellerRatedBuyer';
    } else {
      return res.status(403).json({ message: 'You are not part of this booking, cannot rate.' });
    }

    // prevent duplicate rating for same booking by same fromUser
    const existing = await Rating.findOne({ booking: bookingId, fromUser });
    if (existing) return res.status(400).json({ message: 'You have already rated this booking.' });

    // resolve parking space id: prefer explicit parkingSpaceId, fallback to booking.parkingSpace
    let resolvedParkingSpace;
    if (parkingSpaceId) {
      resolvedParkingSpace = String(parkingSpaceId);
    } else if (booking.parkingSpace) {
      // booking.parkingSpace might be an ObjectId or object
      resolvedParkingSpace = toId(booking.parkingSpace) || (booking.parkingSpace._id ? String(booking.parkingSpace._id) : null);
    }

    // create rating (include parkingSpace if resolved)
    const ratingPayload = {
      booking: bookingId,
      fromUser,
      toUser,
      score: numericScore,
      comment: String(comment || '').trim(),
    };
    if (resolvedParkingSpace) ratingPayload.parkingSpace = resolvedParkingSpace;

    const rating = await Rating.create(ratingPayload);

    // update booking flag (best-effort)
    if (flagField) {
      try {
        await Booking.findByIdAndUpdate(bookingId, { [flagField]: true }).catch(() => {});
      } catch (e) {
        console.error('createRating: failed to update booking flag (non-fatal)', e);
      }
    }

    // optional: update recipient's aggregated rating (best-effort)
    try {
      const agg = await Rating.aggregate([
        { $match: { toUser: mongoose.Types.ObjectId(String(toUser)) } },
        { $group: { _id: '$toUser', avg: { $avg: '$score' }, cnt: { $sum: 1 } } },
      ]);
      if (agg && agg.length) {
        await User.findByIdAndUpdate(String(toUser), { avgRating: agg[0].avg, ratingsCount: agg[0].cnt }).catch((e) => {
          console.error('createRating: failed to update user avg (non-fatal)', e);
        });
      }
    } catch (e) {
      console.error('createRating: agg update error (non-fatal)', e);
    }

    return res.status(201).json({ message: 'Rating saved successfully', rating });
  } catch (err) {
    console.error('createRating error:', err && err.stack ? err.stack : err);
    return res.status(500).json({ message: 'Internal Server Error', error: String(err?.message || err) });
  }
};

/**
 * GET /api/ratings/user/:userId
 */
export const getRatingsForUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ message: 'userId required' });

    const ratings = await Rating.find({ toUser: userId })
      .populate('fromUser', 'name email')
      .populate('booking', 'status')
      .populate('parkingSpace') // optionally populate parking space details
      .sort({ createdAt: -1 });

    return res.json(ratings);
  } catch (err) {
    console.error('getRatingsForUser error:', err && err.stack ? err.stack : err);
    return res.status(500).json({ message: 'Internal Server Error', error: String(err?.message || err) });
  }
};

/**
 * GET /api/ratings/parking/:parkingSpaceId
 * Returns ratings for a given parking space
 */

// backend/controllers/rating.js  (replace getRatingsForParking with this)

export const getRatingsForParking = async (req, res) => {
  try {
    const { parkingSpaceId } = req.params;

    if (!parkingSpaceId) {
      return res.status(400).json({ message: 'parkingSpaceId required' });
    }

    if (!mongoose.Types.ObjectId.isValid(parkingSpaceId)) {
      return res.status(400).json({ message: 'Invalid parkingSpaceId format' });
    }

    const objectId = new mongoose.Types.ObjectId(parkingSpaceId);

    // ✅ Fetch all ratings for this parking space
    const ratings = await Rating.find({ parkingSpace: objectId })
      .populate('fromUser', 'name email')
      .populate('toUser', 'name email')
      .populate('booking', 'status')
      .sort({ createdAt: -1 })
      .lean();

    // ✅ If no ratings found
    if (!ratings || ratings.length === 0) {
      return res.json({
        ratings: [],
        stats: { avg: 0, count: 0 },
        message: 'No ratings yet for this parking space',
      });
    }

    // ✅ Calculate average and count
    const total = ratings.reduce((sum, r) => sum + (Number(r.score) || 0), 0);
    const avg = total / ratings.length;
    const stats = {
      avg: Number(avg.toFixed(2)),
      count: ratings.length,
    };

    // ✅ Return clean response
    return res.json({
      ratings,
      stats,
    });
  } catch (err) {
    console.error('getRatingsForParking error:', err);
    return res.status(500).json({
      message: 'Internal Server Error',
      error: String(err?.message || err),
    });
  }
};


// export const getRatingsForParking = async (req, res) => {

//   try {
//     const { parkingSpaceId } = req.params;
//     if (!parkingSpaceId) {
//       return res.status(400).json({ message: 'parkingSpaceId required' });
//     }

//     console.info('getRatingsForParking called for:', parkingSpaceId);

//     // Validate and build query
//     const isValid = mongoose.Types.ObjectId.isValid(parkingSpaceId);
//     const query = isValid
//       ? { $or: [{ parkingSpace: new mongoose.Types.ObjectId(parkingSpaceId) }, { parkingSpace: parkingSpaceId }] }
//       : { parkingSpace: parkingSpaceId };

//     // Fetch ratings list
//     const ratings = await Rating.find(query)
//       .populate('fromUser', 'name email avatar')
//       .populate('booking', 'status')
//       .sort({ createdAt: -1 })
//       .lean();

//     // Aggregate avg + count
//     let stats = { avg: 0, count: 0 };
//     if (ratings.length > 0) {
//       const aggMatch = isValid
//         ? { parkingSpace: new mongoose.Types.ObjectId(parkingSpaceId) }
//         : { parkingSpace: parkingSpaceId };

//       const agg = await Rating.aggregate([
//         { $match: aggMatch },
//         {
//           $group: {
//             _id: '$parkingSpace',
//             avgScore: { $avg: '$score' },
//             count: { $sum: 1 },
//           },
//         },
//       ]);

//       if (agg && agg.length > 0) {
//         stats = { avg: agg[0].avgScore, count: agg[0].count };
//       }
//     }

//     return res.json({ ratings, stats });
//   } catch (err) {
//     console.error('getRatingsForParking error:', err);
//     return res
//       .status(500)
//       .json({ message: 'Internal Server Error', error: String(err?.message || err) });
//   }
// };