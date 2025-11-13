import mongoose from "mongoose";

const sellerToBuyerRatingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "parkfindersecondBooking", // your actual booking model name
      required: true
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkFinderSecondUser", // your actual user model name
      required: true
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkFinderSecondUser", // your actual user model name
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

// Prevent duplicate rating on same booking
sellerToBuyerRatingSchema.index({ bookingId: 1, sellerId: 1 }, { unique: true });

export default mongoose.model("SellerToBuyerRating", sellerToBuyerRatingSchema);
