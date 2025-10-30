// src/components/parking/ParkingSpaceList.tsx
import React, { useEffect, useState } from 'react';
import { ParkingSpace } from '../../types/parking';
import {
  FaStar,
  FaStarHalfAlt,
  FaRegStar,
  FaMapMarkerAlt,
  FaClock,
  FaShieldAlt,
  FaBolt,
  FaWheelchair,
  FaVideo,
  FaUmbrella,
  FaCar,
  FaSearch,
  FaRoad,
} from 'react-icons/fa';
import axios from 'axios';

interface ParkingSpaceListProps {
  spaces: ParkingSpace[];
  onSpaceSelect: (space: ParkingSpace) => void;
  searchRadius?: number;
  onRadiusChange?: (radius: number) => void;
  userLocation: { lat: number; lng: number };
  filters: {
    amenities: { [key: string]: boolean };
    priceRange: [number, number];
  };
  startTime?: string | null;
  endTime?: string | null;
}

// Haversine formula for distance
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRadians = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getAmenityIcon = (amenity: string) => {
  const amenityLower = amenity.toLowerCase();
  const amenityIcons: { [key: string]: React.ElementType } = {
    security: FaShieldAlt,
    cctv: FaVideo,
    surveillance: FaVideo,
    camera: FaVideo,
    charging: FaBolt,
    electric: FaBolt,
    wheelchair: FaWheelchair,
    accessible: FaWheelchair,
    covered: FaUmbrella,
    roof: FaUmbrella,
    indoor: FaUmbrella,
    '24/7': FaClock,
  };

  for (const [key, icon] of Object.entries(amenityIcons)) {
    if (amenityLower.includes(key)) return icon;
  }
  return FaCar;
};

const formatINR = (value: number, showCents = false) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(value);

const computePriceMeta = (space: any) => {
  const baseRaw = space?.priceParking ?? space?.price ?? 0;
  const base = Number(baseRaw) || 0;
  let rawDiscount = space?.discount ?? space?.discountPercent ?? space?.discount_percentage ?? 0;
  if (typeof rawDiscount === 'string') rawDiscount = rawDiscount.replace('%', '');
  if (typeof rawDiscount === 'object' && rawDiscount !== null) rawDiscount = rawDiscount.percent ?? rawDiscount.value ?? rawDiscount.amount ?? 0;
  const discountNum = Number(rawDiscount);
  const discountPercent = Number.isFinite(discountNum) ? Math.max(0, Math.min(100, discountNum)) : 0;
  const discountedPrice = +(base * (1 - discountPercent / 100)).toFixed(2);
  const hasDiscount = discountPercent > 0 && discountedPrice < base;
  return { basePrice: +base.toFixed(2), discountPercent, discountedPrice, hasDiscount };
};

function computeDurationHours(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) return null;
  return (e.getTime() - s.getTime()) / (1000 * 60 * 60);
}

function formatDurationReadable(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return '';
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

// render stars with possible half star
const renderStars = (value: number, sizeClass = 'text-xs') => {
  const safe = Number.isFinite(value) ? value : 0;
  const rounded = Math.round(safe * 2) / 2;
  const full = Math.floor(rounded);
  const hasHalf = rounded - full >= 0.5;
  const empty = 5 - full - (hasHalf ? 1 : 0);
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < full; i++) nodes.push(<FaStar key={`f-${i}`} className={`${sizeClass} text-yellow-400 mr-1`} />);
  if (hasHalf) nodes.push(<FaStarHalfAlt key="half" className={`${sizeClass} text-yellow-400 mr-1`} />);
  for (let i = 0; i < empty; i++) nodes.push(<FaRegStar key={`e-${i}`} className={`${sizeClass} text-gray-300 mr-1`} />);
  return <div className="flex items-center">{nodes}</div>;
};

export default function ParkingSpaceList({
  spaces,
  onSpaceSelect,
  searchRadius,
  userLocation,
  filters,
  startTime,
  endTime,
}: ParkingSpaceListProps) {
  // store avg + count results keyed by parking space id
  const [ratingsMap, setRatingsMap] = useState<Record<string, { avg: number; count: number }>>({});

  // robust fetch: tries many response shapes and a fallback to /api/parking/:id
  useEffect(() => {
    if (!Array.isArray(spaces) || spaces.length === 0) {
      setRatingsMap({});
      return;
    }

    let mounted = true;
    const token = localStorage.getItem('token') || '';
    const base = import.meta.env.VITE_BASE_URL || '';

    // helper: get string id from _id or id
    const idOf = (s: any) => {
      if (!s) return null;
      if (s._id && typeof s._id === 'object' && s._id.toString) return s._id.toString();
      if (s._id) return String(s._id);
      if (s.id && typeof s.id === 'object' && s.id.toString) return s.id.toString();
      if (s.id) return String(s.id);
      return null;
    };

    // prepare ids to fetch (we'll still include ones that already have rating to keep map consistent)
    const ids = spaces
      .map((s: any) => idOf(s))
      .filter(Boolean) as string[];

    // fetch one id and parse various response formats
    const fetchRatingFor = async (id: string) => {
      try {
        // primary call to ratings endpoint
        const r = await axios.get(`${base}/api/ratings/parking/${id}`, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        });
        const data = r?.data ?? {};

        // 1) { stats: { avg, count } }
        if (data?.stats && (typeof data.stats.avg === 'number' || typeof data.stats.count === 'number')) {
          return { id, avg: Number(data.stats.avg) || 0, count: Number(data.stats.count) || 0 };
        }

        // 2) direct fields: avg, average, mean, avgScore
        const directAvgCandidates = [
          data?.avg,
          data?.average,
          data?.avgScore,
          data?.averageScore,
          data?.mean,
          data?.rating,
          data?.average_rating,
        ];
        const foundDirectAvg = directAvgCandidates.find((v) => typeof v === 'number');
        if (typeof foundDirectAvg === 'number') {
          const count = typeof data.count === 'number' ? data.count : typeof data?.ratings?.length === 'number' ? data.ratings.length : 0;
          return { id, avg: Number(foundDirectAvg), count };
        }

        // 3) ratings array present -> compute average
        const ratingsArray: any[] = Array.isArray(data) ? data : Array.isArray(data?.ratings) ? data.ratings : [];
        if (ratingsArray.length > 0) {
          const sum = ratingsArray.reduce((s, it) => s + (Number(it.score) || 0), 0);
          const avg = sum / ratingsArray.length;
          return { id, avg, count: ratingsArray.length };
        }

        // 4) diagnostics sampleDocs maybe present (debug format)
        if (Array.isArray(data?.diagnostics?.sampleDocs) && data.diagnostics.sampleDocs.length > 0) {
          const sample = data.diagnostics.sampleDocs.filter((d: any) => String(d.parkingSpace) === id);
          if (sample.length > 0) {
            const sum = sample.reduce((s: number, it: any) => s + (Number(it.score) || 0), 0);
            return { id, avg: sum / sample.length, count: sample.length };
          }
        }

        // 5) fallback: try reading /api/parking/:id (some implementations store avg on parking object)
        try {
          const p = await axios.get(`${base}/api/parking/${id}`, {
            headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
          });
          const pd = p?.data ?? {};
          if (typeof pd.rating === 'number' || typeof pd.avg === 'number' || typeof pd.avgRating === 'number') {
            const avg = pd.rating ?? pd.avg ?? pd.avgRating ?? 0;
            const count = pd.ratingCount ?? pd.ratingsCount ?? 0;
            return { id, avg: Number(avg) || 0, count: Number(count) || 0 };
          }
        } catch (e) {
          // ignore; fallback below
        }

        // nothing found
        return { id, avg: 0, count: 0 };
      } catch (err) {
        console.error(`rating fetch failed for ${id}`, err?.response?.data ?? err.message ?? err);
        return { id, avg: 0, count: 0 };
      }
    };

    (async () => {
      const results = await Promise.all(ids.map((id) => fetchRatingFor(id)));
      if (!mounted) return;
      const map: Record<string, { avg: number; count: number }> = {};
      results.forEach((r) => {
        if (r && r.id) map[r.id] = { avg: r.avg, count: r.count };
      });

      // also include any spaces that already had rating fields (avoid overwriting)
      spaces.forEach((s: any) => {
        const id = idOf(s);
        if (!id) return;
        if (map[id]) return; // already set from results
        const preAvg =
          typeof s.rating === 'number'
            ? s.rating
            : typeof s.avg === 'number'
            ? s.avg
            : typeof s.avgRating === 'number'
            ? s.avgRating
            : 0;
        const preCount = typeof s.ratingCount === 'number' ? s.ratingCount : typeof s.count === 'number' ? s.count : 0;
        map[id] = { avg: preAvg, count: preCount };
      });

      if (mounted) setRatingsMap(map);
    })();

    return () => {
      mounted = false;
    };
  }, [spaces]);

  // Filter & attach distance (keeps your existing filtering logic)
  const filteredSpaces = spaces.filter((space: any) => {
    const coords = space?.location?.coordinates ?? [0, 0];
    const distance = calculateDistance(userLocation.lat, userLocation.lng, coords[1] ?? 0, coords[0] ?? 0);
    (space as any).distance = distance;

    // amenities
    for (const [key, value] of Object.entries(filters.amenities)) {
      if (value && !space.amenities?.some((amenity: string) => amenity?.toLowerCase?.().includes(key.toLowerCase()))) {
        return false;
      }
    }

    // price range
    const price = Number(space.priceParking ?? space.price ?? 0);
    if (price < filters.priceRange[0] || price > filters.priceRange[1]) return false;

    return true;
  });

  if (filteredSpaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center h-48 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl border border-white/30">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-200 to-purple-300 rounded-full flex items-center justify-center mb-3 shadow-lg">
          <FaSearch className="text-2xl text-blue-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-700 mb-1">No parking spaces found</h3>
        <p className="text-gray-500 text-sm mb-3 max-w-xs">Try adjusting your filters or search radius</p>
      </div>
    );
  }

  const durationHours = computeDurationHours(startTime, endTime);
  const timeFilterActive = Boolean(startTime && endTime);

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {filteredSpaces.map((space: any) => {
        const address: any = space.address || {};
        const amenities = Array.isArray(space.amenities) ? space.amenities : [];

        // get id and mapped rating
        const id =
          space?._id && typeof space._id === 'object' && space._id.toString ? space._id.toString() : String(space._id ?? '');
        const mapped = ratingsMap[id];
        const ratingVal = mapped?.avg ?? (typeof space.rating === 'number' ? space.rating : typeof space.avg === 'number' ? space.avg : 0);
        const ratingCount = mapped?.count ?? (typeof space.ratingCount === 'number' ? space.ratingCount : 0);

        const timeWindowAvail = typeof space.availableSpots === 'number' ? space.availableSpots : undefined;
        const totalCapacity = Number(space.totalSpots ?? space.total_slots ?? space.capacity ?? 0) || 0;
        const shownAvailability = timeFilterActive ? (timeWindowAvail ?? 0) : totalCapacity;

        const priceMeta = (space as any).__price ?? computePriceMeta(space);
        const basePrice = priceMeta.basePrice;
        const discountedPrice = priceMeta.discountedPrice;
        const hasDiscount = priceMeta.hasDiscount;
        const discountPercent = priceMeta.discountPercent;
        const perHour = hasDiscount ? discountedPrice : basePrice;
        const totalAmount = durationHours ? +(perHour * durationHours).toFixed(2) : null;
        const durationReadable = durationHours ? formatDurationReadable(durationHours) : null;

        const key = id || `${Math.random()}`;

        return (
          <div
            key={key}
            onClick={() => onSpaceSelect(space)}
            className="group bg-white/90 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl cursor-pointer transition-all duration-300 transform hover:-translate-y-0.5 border border-white/30 overflow-hidden hover:border-blue-300 relative"
          >
            <div className="p-3">
              {/* Header Row */}
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 text-sm leading-tight truncate mb-1">
                    {space.title || 'Premium Parking Space'}
                  </h3>
                  <div className="flex items-center text-gray-600 text-xs">
                    <FaMapMarkerAlt className="text-red-500 mr-1 flex-shrink-0" />
                    <span className="truncate">
                      {address.street || 'Unknown Street'}, {address.city || 'Unknown City'}
                    </span>
                  </div>
                </div>

                {/* Price and Rating */}
                <div className="text-right ml-2 flex-shrink-0">
                  {hasDiscount ? (
                    <div className="flex flex-col items-end">
                      <div className="text-xs text-gray-400 line-through">{formatINR(basePrice, false)}</div>
                      <div className="text-lg font-bold text-green-700">{formatINR(discountedPrice, true)}</div>
                      <div className="text-[10px] mt-1 inline-block bg-gradient-to-r from-green-500 to-emerald-600 text-white px-2 py-0.5 rounded font-semibold">
                        {discountPercent}% OFF
                      </div>
                      <div className="text-xs text-gray-500 mt-1">/hr</div>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-2 py-1 rounded-lg text-sm font-bold">
                      {formatINR(basePrice, false)}
                      <span className="text-xs ml-1">/hr</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end mt-1">
                    {ratingVal > 0 ? (
                      <div className="flex items-center">
                        <div className="mr-2">{renderStars(ratingVal, 'text-xs')}</div>
                        <div className="text-xs font-semibold text-gray-700">{Number(ratingVal).toFixed(1)}</div>
                        {ratingCount ? <div className="text-xs text-gray-400 ml-1">({ratingCount})</div> : null}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400">No ratings</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Distance and Availability */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center text-xs text-gray-600 bg-blue-50 px-2 py-1 rounded-full">
                  <FaRoad className="text-blue-500 mr-1" />
                  <span>{(space.distance as number)?.toFixed(1)} km away</span>
                </div>

                <div
                  className={`flex items-center text-xs px-2 py-1 rounded-full font-semibold ${
                    timeFilterActive ? 'text-green-600 bg-green-50' : 'text-gray-600 bg-gray-100'
                  }`}
                >
                  {shownAvailability} spot{shownAvailability !== 1 ? 's' : ''} {timeFilterActive ? 'available for your time' : 'total'}
                </div>
              </div>

              {/* Amenities */}
              {amenities.length > 0 && (
                <div className="mb-2">
                  <div className="flex flex-wrap gap-1">
                    {amenities.slice(0, 2).map((amenity: string, idx: number) => {
                      const AmenityIcon = getAmenityIcon(amenity);
                      return (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2 py-1 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 rounded-full text-xs font-medium border border-blue-200"
                          title={amenity}
                        >
                          <AmenityIcon className="mr-1 text-xs" />
                          {amenity.length > 12 ? amenity.substring(0, 10) + '...' : amenity}
                        </span>
                      );
                    })}
                    {amenities.length > 2 && (
                      <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                        +{amenities.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Pricing */}
              <div className="mb-2">
                {durationHours && totalAmount ? (
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-600">Total for {durationReadable}</div>
                    <div className="font-semibold text-gray-900">{formatINR(totalAmount, true)}</div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-600">Rate</div>
                    <div className="font-semibold text-gray-900">{formatINR(perHour, false)}/hr</div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <div className="flex items-center text-xs text-gray-500">
                  <span className="flex items-center bg-gray-100 px-2 py-1 rounded-full">
                    <FaClock className="mr-1 text-blue-500 text-xs" />
                    {space.available24_7 ? '24/7 Available' : 'Limited hours'}
                  </span>
                </div>

                <button
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSpaceSelect(space);
                  }}
                >
                  View Details
                </button>
              </div>
            </div>

            <div className="absolute inset-0 border-2 border-transparent group-hover:border-blue-300 rounded-xl pointer-events-none transition-all duration-300"></div>
          </div>
        );
      })}

      <style jsx>{`
        .max-h-64::-webkit-scrollbar {
          width: 6px;
        }
        .max-h-64::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        .max-h-64::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          border-radius: 10px;
        }
        .max-h-64::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(135deg, #2563eb, #7c3aed);
        }
      `}</style>
    </div>
  );
}



