// // backend/models/Rating.js
// import mongoose from 'mongoose';

// const ratingSchema = new mongoose.Schema({
//   booking: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'parkfindersecondBooking',
//     required: true,
//   },
//   fromUser: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'ParkFinderSecondUser',
//     required: true,
//   },
//   toUser: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'ParkFinderSecondUser',
//     required: true,
//   },
//   score: {
//     type: Number,
//     required: true,
//     min: 1,
//     max: 5,
//   },
//   comment: {
//     type: String,
//     default: '',
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now,
//   },
// });

// export default mongoose.models.Rating || mongoose.model('Rating', ratingSchema);
// backend/models/Rating.js
import mongoose from 'mongoose';

const ratingSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'parkfindersecondBooking',
    required: true,
  },
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParkFinderSecondUser',
    required: true,
  },
  toUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParkFinderSecondUser',
    required: true,
  },
  // NEW: reference to the parking space (optional)
  parkingSpace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParkingSpace', // <- change this to your actual parking space model name if different
    required: false,
  },
  score: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// create an index to speed up queries by parking space and createdAt
ratingSchema.index({ parkingSpace: 1, createdAt: -1 });

export default mongoose.models.Rating || mongoose.model('Rating', ratingSchema);
