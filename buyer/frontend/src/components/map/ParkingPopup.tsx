// frontend/src/components/map/ParkingPopup.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Popup } from 'react-map-gl';
import axios from 'axios';
import {
  FaStar,
  FaStarHalfAlt,
  FaMapMarkerAlt,
  FaClock,
  FaShieldAlt,
  FaCar,
  FaBolt,
  FaWheelchair,
  FaVideo,
  FaUmbrella,
  FaChevronLeft,
  FaChevronRight,
  FaCheck,
  FaTimes,
  FaUserCircle,
  FaFire,
  FaHeart,
  FaInfoCircle,
} from 'react-icons/fa';
import { toast } from 'react-toastify';

import { useAuth } from '../../context/AuthContext';
import PhoneVerifyModal from '../PhoneVerifyModal';
import { ParkingSpace } from '../../types/parking';

interface ParkingPopupProps {
  space: ParkingSpace;
  onClose: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  user: { id?: string; _id?: string; name?: string; isVerified?: boolean } | null;
  startTime?: string | null;
  endTime?: string | null;
}

type Review = {
  _id?: string;
  score?: number;
  comment?: string;
  fromUser?: { name?: string; _id?: string; email?: string } | string | null;
  createdAt?: string;
};

export default function ParkingPopup({
  space,
  onClose,
  onMouseEnter,
  onMouseLeave,
  user,
  startTime,
  endTime,
}: ParkingPopupProps) {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [ratingAvg, setRatingAvg] = useState<number>(Number(space?.rating ?? 0));
  const [ratingCount, setRatingCount] = useState<number>(0);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  const API_BASE = import.meta.env.VITE_BASE_URL?.replace(/\/$/, '') || window.location.origin;
  const CLOUD_NAME = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ?? '').toString().trim();

  // Clear stale UI state immediately when space changes
  useEffect(() => {
    setRatingAvg(Number(space?.rating ?? 0));
    setRatingCount(0);
    setReviews([]);
    setCurrentImageIndex(0);
    setIsImageLoaded(false);
  }, [space?._id]);

  // Fetch ratings + reviews with AbortController to avoid race/stale updates
  useEffect(() => {
    if (!space?._id) {
      setRatingAvg(Number(space?.rating ?? 0));
      setRatingCount(0);
      setReviews([]);
      return;
    }

    const controller = new AbortController();
    const spaceId = String(space._id);

    const fetchRatings = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/ratings/parking/${spaceId}`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        const data = res.data;

        // Normalize different response shapes
        let ratingsArray: any[] = [];
        if (Array.isArray(data)) ratingsArray = data;
        else if (Array.isArray(data?.ratings)) ratingsArray = data.ratings;
        else ratingsArray = [];

        // Use server-provided stats if available
        if (data?.stats && (typeof data.stats.avg === 'number' || typeof data.stats.count === 'number')) {
          setRatingAvg(Number(data.stats.avg ?? 0));
          setRatingCount(Number(data.stats.count ?? 0));
        } else if (ratingsArray.length > 0) {
          const sum = ratingsArray.reduce((s: number, r: any) => s + (Number(r.score) || 0), 0);
          setRatingAvg(sum / Math.max(1, ratingsArray.length));
          setRatingCount(ratingsArray.length);
        } else {
          setRatingAvg(Number(space?.rating ?? 0));
          setRatingCount(0);
        }

        if (ratingsArray.length > 0) {
          const normalized = ratingsArray
            .map((r) => ({
              _id: r._id,
              score: Number(r.score || 0),
              comment: r.comment || '',
              fromUser:
                typeof r.fromUser === 'string'
                  ? r.fromUser
                  : r.fromUser && typeof r.fromUser === 'object'
                  ? { name: r.fromUser.name || r.fromUser.fullName || r.fromUser.email || 'Anonymous', _id: r.fromUser._id }
                  : null,
              createdAt: r.createdAt,
            }))
            .sort((a, b) => {
              const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return tb - ta;
            });

          if (spaceId === String(space._id) && !controller.signal.aborted) {
            setReviews(normalized);
          }
        } else {
          setReviews([]);
        }
      } catch (err: any) {
        if (controller.signal.aborted) return;
        console.warn('Failed to load ratings:', err?.message ?? err);
        setRatingAvg(Number(space?.rating ?? 0));
        setRatingCount(0);
        setReviews([]);
      }
    };

    fetchRatings();

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space?._id]);

  const fmt = (value: number, decimals = 2) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: decimals,
    }).format(value);

  const computeDiscountedPrice = (s: any) => {
    const base = Number(s.priceParking ?? s.pricePerHour ?? s.price ?? 0) || 0;
    const rawDiscount = s.discount ?? s.discountPercent ?? 0;
    let discountNum = 0;
    if (typeof rawDiscount === 'string') {
      discountNum = Number(rawDiscount.replace?.('%', '') ?? 0);
    } else if (typeof rawDiscount === 'number') {
      discountNum = rawDiscount;
    } else if (typeof rawDiscount === 'object' && rawDiscount !== null) {
      discountNum = Number(rawDiscount.percent ?? rawDiscount.value ?? rawDiscount.amount ?? 0);
    }
    const clamped = Number.isFinite(discountNum) ? Math.max(0, Math.min(100, discountNum)) : 0;
    const discounted = +(base * (1 - clamped / 100)).toFixed(2);
    return {
      basePrice: +base.toFixed(2),
      discountPercent: clamped,
      discountedPrice: discounted,
      hasDiscount: clamped > 0 && discounted < base,
    };
  };

  function computeDurationHours(start?: string | null, end?: string | null): number | null {
    if (!start || !end) return null;
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) return null;
    const minutes = (e.getTime() - s.getTime()) / (1000 * 60);
    return +(minutes / 60);
  }
  const durationHours = computeDurationHours(startTime, endTime);

  const priceMeta = (space as any).__price ?? computeDiscountedPrice(space as any);
  const basePrice = priceMeta.basePrice;
  const discountedPrice = priceMeta.discountedPrice;
  const hasDiscount = priceMeta.hasDiscount;
  const discountPercent = priceMeta.discountPercent;
  const perHour = hasDiscount ? discountedPrice : basePrice;
  const totalAmount = durationHours ? +(perHour * durationHours).toFixed(2) : null;

  const makeUrl = (p: any) => {
    if (!p) return null;
    if (typeof p === 'string') {
      if (p.startsWith('http://') || p.startsWith('https://')) return p;
      if (p.startsWith('/')) return `${API_BASE}${p}`;
      if (CLOUD_NAME && p.includes('/')) {
        return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${p}`;
      }
      return `${API_BASE}/uploads/${p}`;
    }
    if (typeof p === 'object') {
      if (p.url) return p.url;
      if (p.path && (p.path.startsWith('http://') || p.path.startsWith('https://'))) return p.path;
      if (p.path && p.path.startsWith('/')) return `${API_BASE}${p.path}`;
      if (p.filename) return `${API_BASE}/uploads/${p.filename}`;
    }
    return null;
  };

  const rawPhotos = (space as any).photos;
  const images =
    Array.isArray(rawPhotos) && rawPhotos.length > 0
      ? rawPhotos.map(makeUrl).filter(Boolean)
      : rawPhotos
      ? [makeUrl(rawPhotos)].filter(Boolean)
      : [
          'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
        ];

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
    setIsImageLoaded(false);
  };
  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    setIsImageLoaded(false);
  };

  const handleBookNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.info('Please log in to book the parking space.');
      navigate('/login');
      return;
    }

    if (!user.isVerified) {
      toast.info('Your account is not verified. Please complete your KYC to book.');
      return;
    }

    const phoneVerified = (authUser as any)?.phoneVerified;
    if (phoneVerified === false) {
      setShowPhoneModal(true);
      return;
    }

    const sid = (space as any)._id?.toString() || (space as any)._id;
    const uid = (user as any)._id || (user as any).id;

    navigate('/vehicle-details', {
      state: {
        spaceId: sid,
        userId: uid,
        startTime: startTime ?? null,
        endTime: endTime ?? null,
        totalAmount: totalAmount ?? null,
      },
    });
  };

  const getStars = (avg: number) => {
    const rounded = Math.round(Number(avg || 0) * 2) / 2;
    const full = Math.floor(rounded);
    const half = rounded - full >= 0.5;
    const stars: JSX.Element[] = [];
    for (let i = 0; i < full; i++) stars.push(<FaStar key={`f-${i}`} className="text-yellow-400" />);
    if (half) stars.push(<FaStarHalfAlt key="half" className="text-yellow-400" />);
    const remaining = 5 - full - (half ? 1 : 0);
    for (let i = 0; i < remaining; i++) stars.push(<FaStar key={`e-${i}`} className="text-gray-300" />);
    return stars;
  };

  const topComments = reviews.slice(0, 2);

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(15px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }
        
        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }
        
        .animate-slide-up {
          animation: slideUp 0.3s ease-out;
        }
        
        .animate-pulse-slow {
          animation: pulse 2s ease-in-out infinite;
        }
        
        .skeleton {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 1000px 100%;
          animation: shimmer 2s infinite;
        }
        
        .glass-effect {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        
        .hover-lift {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .hover-lift:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
        }
        
        .review-card {
          transition: all 0.3s ease;
          border-left: 2px solid transparent;
        }
        
        .review-card:hover {
          border-left-color: #667eea;
          background: #f9fafb;
          transform: translateX(3px);
        }
        
        .image-zoom {
          transition: transform 0.4s ease;
        }
        
        .image-zoom:hover {
          transform: scale(1.03);
        }
      `}</style>

      <Popup
        latitude={(space as any).location?.coordinates?.[1] ?? 0}
        longitude={(space as any).location?.coordinates?.[0] ?? 0}
        onClose={onClose}
        closeButton={false}
        closeOnClick={false}
        anchor="top"
        offset={[0, -10]}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          maxWidth: '280px',
          minWidth: '260px',
          padding: 0,
          borderRadius: '12px',
        }}
        closeOnMove={false}
      >
        <div
          className="glass-effect rounded-xl shadow-xl border border-white/20 overflow-hidden animate-slide-up"
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-2 right-2 z-30 glass-effect hover:bg-red-50/90 text-gray-600 hover:text-red-600 rounded-full w-6 h-6 flex items-center justify-center transition-all duration-300 shadow-md border border-white/40 hover:scale-110"
            aria-label="Close popup"
          >
            <FaTimes className="text-xs" />
          </button>

          {/* Action Buttons */}
          <div className="absolute top-2 left-2 z-30 flex gap-1.5">
            <button
              onClick={() => setIsFavorite(!isFavorite)}
              className={`glass-effect rounded-full w-6 h-6 flex items-center justify-center transition-all duration-300 shadow-md border border-white/40 hover:scale-110 ${
                isFavorite ? 'text-red-500 bg-red-50/90' : 'text-gray-600 hover:text-red-500'
              }`}
              aria-label="Add to favorites"
            >
              <FaHeart className={`text-xs ${isFavorite ? 'animate-pulse-slow' : ''}`} />
            </button>
          </div>

          {/* Compact Image Header */}
          <div className="relative h-24 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 overflow-hidden">
            {!isImageLoaded && <div className="absolute inset-0 skeleton"></div>}
            <img
              src={images[currentImageIndex]}
              alt={(space as any).title || 'Parking space'}
              className={`w-full h-full object-cover image-zoom transition-opacity duration-500 ${isImageLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setIsImageLoaded(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>

            {/* Image Navigation */}
            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-1.5 top-1/2 transform -translate-y-1/2 glass-effect hover:bg-white text-gray-700 hover:text-gray-900 rounded-full w-5 h-5 flex items-center justify-center transition-all duration-300 shadow-md hover:scale-110"
                  aria-label="Previous image"
                >
                  <FaChevronLeft className="text-[8px]" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-1.5 top-1/2 transform -translate-y-1/2 glass-effect hover:bg-white text-gray-700 hover:text-gray-900 rounded-full w-5 h-5 flex items-center justify-center transition-all duration-300 shadow-md hover:scale-110"
                  aria-label="Next image"
                >
                  <FaChevronRight className="text-[8px]" />
                </button>

                {/* Image Indicators */}
                <div className="absolute bottom-1.5 left-1/2 transform -translate-x-1/2 flex gap-1">
                  {images.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-1 rounded-full transition-all duration-300 ${
                        idx === currentImageIndex ? 'w-4 bg-white shadow-md' : 'w-1 bg-white/50 hover:bg-white/75'
                      }`}
                    ></div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Compact Rating and Price Section */}
          <div className="px-2.5 pt-2 pb-1.5 flex items-center justify-between border-b border-gray-100">
            {/* Rating Badge */}
            <div className="flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
              <div className="flex items-center gap-0.5 text-[9px]">{getStars(ratingAvg)}</div>
              <div className="text-[10px] text-gray-900 font-bold">
                {Number.isFinite(ratingAvg) ? ratingAvg.toFixed(1) : '0.0'}
              </div>
              {ratingCount > 0 && <div className="text-[9px] text-gray-600 font-medium">({ratingCount})</div>}
            </div>

            {/* Price Badge */}
            <div>
              {hasDiscount ? (
                <div className="flex items-center gap-1.5">
                  <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                    {discountPercent}% OFF
                  </div>
                  <div className="text-right">
                    <div className="line-through text-gray-500 font-medium text-[9px]">{fmt(basePrice, 0)}</div>
                    <div className="text-green-600 font-bold text-xs">{fmt(discountedPrice)}</div>
                  </div>
                </div>
              ) : (
                <div className="text-right">
                  <div className="text-green-600 font-bold text-sm">{fmt(basePrice)}</div>
                  <div className="text-[8px] text-gray-600 font-medium">per hour</div>
                </div>
              )}
            </div>
          </div>

          {/* Compact Content Section */}
          <div className="p-2.5">
            {/* Title and Location */}
            <div className="mb-2">
              <h3 className="font-bold text-gray-900 text-xs mb-1.5 leading-tight line-clamp-1 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {(space as any).title || 'Premium Parking Space'}
              </h3>

              <div className="flex items-start text-gray-600 gap-1.5">
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-red-400 to-pink-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FaMapMarkerAlt className="text-white text-[8px]" />
                </div>
                <span className="text-[10px] leading-relaxed line-clamp-2 flex-1">
                  {(space as any).address?.street || 'Unknown Street'}, {(space as any).address?.city || ''}
                </span>
              </div>
            </div>

            {/* Description */}
            {(space as any).description && (
              <div className="mb-2 p-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
                <p className="text-gray-700 text-[10px] leading-relaxed line-clamp-2">{(space as any).description}</p>
              </div>
            )}

            {/* Reviews Section */}
            {topComments.length > 0 ? (
              <div className="mb-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                      <FaStar className="text-white text-[8px]" />
                    </div>
                    <span className="text-[10px] font-bold text-gray-800">Recent Reviews</span>
                  </div>
                  {reviews.length > 1 && (
                    <button onClick={() => setShowReviewsModal(true)} className="text-[9px] font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
                      View all ({reviews.length})
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {topComments.map((rev, idx) => (
                    <div key={rev._id ?? idx} className="review-card p-2 bg-white rounded-lg shadow-sm border border-gray-100">
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <FaUserCircle className="text-white text-sm" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <div className="font-semibold text-gray-900 text-[10px] truncate">
                              {typeof rev.fromUser === 'string' ? rev.fromUser : rev.fromUser?.name || 'Anonymous'}
                            </div>
                            <div className="flex items-center gap-0.5 text-[8px] ml-1.5 flex-shrink-0">
                              {getStars(rev.score ?? 0)}
                            </div>
                          </div>
                          <div className="text-gray-600 text-[9px] leading-relaxed line-clamp-2">
                            {rev.comment || <span className="italic text-gray-400">No comment</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-2 p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-center">
                <FaStar className="text-gray-300 text-lg mx-auto mb-1" />
                <p className="text-[9px] text-gray-500">No reviews yet</p>
              </div>
            )}
          </div>

          {/* Compact CTA Button */}
          <div className="px-2.5 pb-2.5">
            <button
              onClick={handleBookNow}
              className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white py-2 px-3 rounded-xl font-bold text-xs shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-between group relative overflow-hidden hover-lift"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>

              <div className="flex items-center gap-2 relative z-10">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                  <FaCheck className="text-[9px]" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-[11px]">Book Now</div>
                  {durationHours && totalAmount ? (
                    <div className="text-[8px] opacity-90 font-medium">{Math.round(durationHours * 60) / 60}h</div>
                  ) : (
                    <div className="text-[8px] opacity-90 font-medium">Instant</div>
                  )}
                </div>
              </div>

              <div className="relative z-10">
                <div className="text-sm font-black">{durationHours && totalAmount ? fmt(totalAmount, 0) : fmt(perHour, 0)}</div>
                {!durationHours && <div className="text-[8px] opacity-90 font-medium">/hr</div>}
              </div>
            </button>
          </div>
        </div>
      </Popup>

      {/* Enhanced Reviews Modal */}
      {showReviewsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-slide-up">
          <div className="max-w-2xl w-full glass-effect rounded-3xl shadow-2xl p-6 border-2 border-white/20 max-h-[85vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <FaStar className="text-white text-lg" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">All Reviews</h3>
                  <p className="text-sm text-gray-600">{reviews.length} total reviews</p>
                </div>
              </div>
              <button
                onClick={() => setShowReviewsModal(false)}
                className="glass-effect hover:bg-red-50 text-gray-600 hover:text-red-600 rounded-full w-10 h-10 flex items-center justify-center transition-all duration-300 shadow-lg border border-white/40 hover:scale-110 hover:rotate-90"
              >
                <FaTimes className="text-lg" />
              </button>
            </div>

            {/* Rating Summary */}
            <div className="mb-6 p-5 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl border border-yellow-200">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-5xl font-black bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
                    {Number.isFinite(ratingAvg) ? ratingAvg.toFixed(1) : '0.0'}
                  </div>
                  <div className="flex items-center justify-center gap-1 mt-2">{getStars(ratingAvg)}</div>
                  <div className="text-xs text-gray-600 mt-1 font-medium">{ratingCount} ratings</div>
                </div>
                <div className="flex-1 text-sm text-gray-700">
                  <div className="font-semibold mb-1">Customer Satisfaction</div>
                  <div className="text-xs text-gray-600">Based on verified bookings and reviews</div>
                </div>
              </div>
            </div>

            {/* Reviews List */}
            <div className="space-y-4 overflow-y-auto pr-2 flex-1" style={{ maxHeight: 'calc(85vh - 320px)' }}>
              {reviews.length === 0 && (
                <div className="text-center py-12">
                  <FaStar className="text-gray-300 text-5xl mx-auto mb-4" />
                  <p className="text-sm text-gray-500">No reviews available yet.</p>
                </div>
              )}
              {reviews.map((r, idx) => (
                <div
                  key={r._id ?? `${r.createdAt}-${idx}`}
                  className="review-card p-5 bg-white rounded-2xl shadow-md border-2 border-gray-100 hover:shadow-xl transition-all duration-300"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-400 via-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                      <FaUserCircle className="text-white text-2xl" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-bold text-gray-900 text-sm">
                            {typeof r.fromUser === 'string' ? r.fromUser : r.fromUser?.name ?? 'Anonymous'}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {r.createdAt
                              ? new Date(r.createdAt).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-sm flex-shrink-0 ml-3">{getStars(r.score ?? 0)}</div>
                      </div>
                      <div className="text-sm text-gray-700 leading-relaxed">
                        {r.comment || <span className="italic text-gray-400">No comment provided</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-xs text-gray-500">
                <FaInfoCircle className="inline mr-1" />
                Verified reviews only
              </div>
              <button
                onClick={() => setShowReviewsModal(false)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-sm font-semibold transition-all duration-300 shadow-lg hover:shadow-xl hover-lift"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phone Verify Modal */}
      {showPhoneModal && <PhoneVerifyModal open={showPhoneModal} onClose={() => setShowPhoneModal(false)} />}
    </>
  );
}
