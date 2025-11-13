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

  // Dark theme detection (same as Home.tsx)
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

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
        totalAmount: totalAmount,
        perHour: perHour,
        durationHours: durationHours,
      },
    });
    onClose();
  };

  const getStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<FaStar key={i} className="text-yellow-400" />);
      } else if (i === fullStars && hasHalfStar) {
        stars.push(<FaStarHalfAlt key={i} className="text-yellow-400" />);
      } else {
        stars.push(<FaStar key={i} className="text-gray-300 dark:text-gray-600" />);
      }
    }
    return stars;
  };

  // const topComments = reviews.slice(0, 2); // Not needed anymore

  return (
    <>
      <style jsx global>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
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
        
        .dark .skeleton {
          background: linear-gradient(90deg, #374151 25%, #4b5563 50%, #374151 75%);
          background-size: 1000px 100%;
          animation: shimmer 2s infinite;
        }
        
        .glass-effect {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        
        .dark .glass-effect {
          background: rgba(17, 24, 39, 0.95);
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
        
        .dark .review-card:hover {
          background: #374151;
          border-left-color: #8b5cf6;
        }
        
        .image-zoom {
          transition: transform 0.4s ease;
        }
        
        .image-zoom:hover {
          transform: scale(1.03);
        }

        /* Remove white strip from mapbox popup */
        .mapboxgl-popup-content {
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
        }
        
        .mapboxgl-popup-tip {
          display: none !important;
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
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
        }}
        closeOnMove={false}
      >
        <div
          className={`glass-effect rounded-xl shadow-xl border ${isDark ? 'border-gray-600' : 'border-white/20'} overflow-hidden animate-slide-up`}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className={`absolute top-2 right-2 z-30 glass-effect hover:bg-red-50/90 ${isDark ? 'hover:bg-red-900/50' : ''} ${isDark ? 'text-gray-300 hover:text-red-400' : 'text-gray-600 hover:text-red-600'} rounded-full w-6 h-6 flex items-center justify-center transition-all duration-300 shadow-md ${isDark ? 'border-gray-600' : 'border-white/40'} hover:scale-110`}
            aria-label="Close popup"
          >
            <FaTimes className="text-xs" />
          </button>

          {/* Action Buttons */}
          <div className="absolute top-2 left-2 z-30 flex gap-1.5">
            <button
              onClick={() => setIsFavorite(!isFavorite)}
              className={`glass-effect rounded-full w-6 h-6 flex items-center justify-center transition-all duration-300 shadow-md ${isDark ? 'border-gray-600' : 'border-white/40'} hover:scale-110 ${
                isFavorite ? `text-red-500 ${isDark ? 'bg-red-900/50' : 'bg-red-50/90'}` : `${isDark ? 'text-gray-300 hover:text-red-400' : 'text-gray-600 hover:text-red-500'}`
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
                  className={`absolute left-1.5 top-1/2 transform -translate-y-1/2 glass-effect ${isDark ? 'hover:bg-gray-700 text-gray-300 hover:text-gray-100' : 'hover:bg-white text-gray-700 hover:text-gray-900'} rounded-full w-5 h-5 flex items-center justify-center transition-all duration-300 shadow-md hover:scale-110`}
                  aria-label="Previous image"
                >
                  <FaChevronLeft className="text-[8px]" />
                </button>
                <button
                  onClick={nextImage}
                  className={`absolute right-1.5 top-1/2 transform -translate-y-1/2 glass-effect ${isDark ? 'hover:bg-gray-700 text-gray-300 hover:text-gray-100' : 'hover:bg-white text-gray-700 hover:text-gray-900'} rounded-full w-5 h-5 flex items-center justify-center transition-all duration-300 shadow-md hover:scale-110`}
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
                        idx === currentImageIndex ? `w-4 ${isDark ? 'bg-gray-300' : 'bg-white'} shadow-md` : `w-1 ${isDark ? 'bg-gray-500' : 'bg-white/50'} ${isDark ? 'hover:bg-gray-400' : 'hover:bg-white/75'}`
                      }`}
                    ></div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Compact Rating and Price Section */}
          <div className={`px-2.5 pt-2 pb-1.5 flex items-center justify-between border-b ${isDark ? 'border-gray-600' : 'border-gray-100'}`}>
            {/* Rating Badge - Made Clickable */}
            <button
              onClick={() => setShowReviewsModal(true)}
              className={`flex items-center gap-1.5 px-2 py-1 ${isDark ? 'bg-gradient-to-r from-yellow-900/50 to-orange-900/50 border-yellow-700' : 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200'} rounded-lg border transition-all duration-200 hover:scale-[1.02] hover:shadow-md`}
              aria-label={`View ${ratingCount} reviews for a rating of ${ratingAvg.toFixed(1)}`}
            >
              <div className="flex items-center gap-0.5 text-[9px]">{getStars(ratingAvg)}</div>
              <div className="text-[10px] font-bold dark:text-white">{Number.isFinite(ratingAvg) ? ratingAvg.toFixed(1) : '0.0'}</div>
              {ratingCount > 0 && <div className="text-[9px] dark:text-gray-300 font-medium">({ratingCount})</div>}
            </button>

            {/* Price Badge */}
            <div>
              {hasDiscount ? (
                <div className="flex items-center gap-1.5">
                  <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                    {discountPercent}% OFF
                  </div>
                  <div className="text-right">
                    <div className="line-through text-gray-500 dark:text-gray-400 font-medium text-[9px]">{fmt(basePrice, 0)}</div>
                    <div className="text-green-600 dark:text-green-400 font-bold text-xs">{fmt(discountedPrice)}</div>
                  </div>
                </div>
              ) : (
                <div className="text-right">
                  <div className="text-green-600 dark:text-green-400 font-bold text-sm">{fmt(basePrice)}</div>
                  <div className="text-[8px] dark:text-gray-300 font-medium">per hour</div>
                </div>
              )}
            </div>
          </div>

          {/* Compact Content Section */}
          <div className="p-2.5">
            {/* Title and Location */}
            <div className="mb-2">
              <h3 className="font-bold dark:text-white text-xs mb-1.5 leading-tight line-clamp-1 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {(space as any).title || 'Premium Parking Space'}
              </h3>

              <div className="flex items-start text-gray-600 dark:text-gray-300 gap-1.5">
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-red-400 to-pink-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FaMapMarkerAlt className="text-white text-[8px]" />
                </div>
                <span className="text-[10px] leading-relaxed line-clamp-2 flex-1">
                  {(space as any).address?.street || 'Unknown Street'}, {(space as any).address?.city || ''}
                </span>
              </div>
            </div>

            {/* Book Now Button - Moved up and now the primary element */}
            <button
              onClick={handleBookNow}
              className="w-full p-3 rounded-xl text-white font-bold text-sm shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.01] bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <FaCheck className="text-lg" />
                <span>Book Now</span>
                {durationHours && <span className="text-xs font-normal">({durationHours.toFixed(1)} hrs)</span>}
              </div>
              <div className="text-right">
                <span className="text-lg">
                  {totalAmount ? fmt(totalAmount, 0) : fmt(perHour, 0)}
                </span>
                <span className="text-xs font-normal">
                  {totalAmount ? '' : '/hr'}
                </span>
              </div>
            </button>
          </div>

          {/* Amenities Section - Removed to reduce size */}
          {/* <div className={`p-2.5 border-t ${isDark ? 'border-gray-600' : 'border-gray-100'}`}>
            <h4 className="text-xs font-bold dark:text-white mb-2">Amenities</h4>
            <div className="grid grid-cols-3 gap-2">
              {((space as any).amenities || []).map((amenity: string) => (
                <div key={amenity} className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                  {amenity === 'covered' && <FaUmbrella className="text-sm text-blue-500" />}
                  {amenity === 'security' && <FaShieldAlt className="text-sm text-green-500" />}
                  {amenity === 'ev_charging' && <FaBolt className="text-sm text-yellow-500" />}
                  {amenity === 'handicap' && <FaWheelchair className="text-sm text-purple-500" />}
                  {amenity === '24_7' && <FaClock className="text-sm text-indigo-500" />}
                  {amenity === 'camera' && <FaVideo className="text-sm text-red-500" />}
                  <span className="text-[10px] capitalize">{amenity.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div> */}
        </div>
      </Popup>

      {showReviewsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowReviewsModal(false)}
        >
          <div
            className={`glass-effect rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto ${isDark ? 'border-gray-600' : 'border-white/20'} border animate-slide-up`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 p-4 flex items-center justify-between border-b bg-white/90 dark:bg-gray-900/90 z-10">
              <h3 className="text-lg font-bold dark:text-white">Customer Reviews ({ratingCount})</h3>
              <button
                onClick={() => setShowReviewsModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                aria-label="Close reviews modal"
              >
                <FaTimes className="text-xl" />
              </button>
            </div>

            <div className="p-4">
              {/* Summary */}
              <div className={`p-4 mb-4 rounded-lg text-center ${isDark ? 'bg-gray-800/50' : 'bg-gray-50'} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="text-4xl font-extrabold text-yellow-500 mb-1">
                  {Number.isFinite(ratingAvg) ? ratingAvg.toFixed(1) : '0.0'}
                </div>
                <div className="flex justify-center items-center gap-1 text-xl mb-2">
                  {getStars(ratingAvg)}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Based on {ratingCount} review{ratingCount !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Review List */}
              <div className="space-y-4">
                {reviews.length > 0 ? (
                  reviews.map((review, index) => (
                    <div
                      key={review._id || index}
                      className={`p-4 rounded-lg shadow-md ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FaUserCircle className="text-gray-400 text-xl" />
                          <span className="text-sm font-semibold dark:text-white">
                            {typeof review.fromUser === 'object' && review.fromUser?.name ? review.fromUser.name : 'Anonymous'}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5 text-sm text-yellow-400">
                          {getStars(review.score || 0)}
                        </div>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 text-sm mb-2">
                        {review.comment || 'No comment provided.'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : 'Date unknown'}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center p-6 text-gray-500 dark:text-gray-400">
                    <FaInfoCircle className="text-3xl mx-auto mb-2" />
                    <p>No reviews have been submitted for this parking space yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showPhoneModal && (
        <PhoneVerifyModal
          onClose={() => setShowPhoneModal(false)}
          onSuccess={() => {
            setShowPhoneModal(false);
            handleBookNow({ stopPropagation: () => {} } as any); // Re-trigger booking after verification
          }}
        />
      )}
    </>
  );
}
