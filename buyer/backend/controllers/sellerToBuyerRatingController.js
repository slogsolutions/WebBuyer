import SellerToBuyerRating from "../models/SellerToBuyerRating.js";
import Booking from "../models/Booking.js";

// ✅ Seller rates Buyer
export const rateBuyer = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const { bookingId, rating, comment } = req.body;

    const booking = await Booking.findById(bookingId)
      .populate("user")        // buyer
      .populate("providerId"); // seller

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // ✅ Ensure the logged-in seller is the real provider of this booking
    if (String(booking.providerId?._id) !== String(sellerId)) {
      return res.status(403).json({ message: "You are not allowed to rate this buyer" });
    }

    // ✅ Avoid duplicate rating
    if (booking.sellerRatedBuyer) {
      return res.status(400).json({ message: "You already rated this buyer" });
    }

    // ✅ Save Rating
    await SellerToBuyerRating.create({
      bookingId,
      sellerId,
      buyerId: booking.user._id,
      rating,
      comment
    });

    // ✅ Update booking flag
    booking.sellerRatedBuyer = true;
    await booking.save();

    return res.status(201).json({ message: "Rating submitted successfully" });

  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ✅ Get Buyer Rating Summary
export const getBuyerRating = async (req, res) => {
  try {
    const { buyerId } = req.params;

    const ratings = await SellerToBuyerRating.find({ buyerId });

    if (!ratings.length)
      return res.json({ average: 0, count: 0 });

    const total = ratings.reduce((sum, r) => sum + r.rating, 0);
    const avg = total / ratings.length;

    return res.json({ average: Number(avg.toFixed(1)), count: ratings.length });

  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ✅ NEW: Get all individual comments (FOR VIEW COMMENTS UI)
export const getBuyerComments = async (req, res) => {
  try {
    const { buyerId } = req.params;

    const comments = await SellerToBuyerRating.find({ buyerId })
      .populate("sellerId", "name") // show who gave the rating
      .sort({ createdAt: -1 });

    return res.json(comments);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
