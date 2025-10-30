// // frontend/src/components/dashboard/providerspaces/ProviderLocations.tsx
// import React, { useEffect, useState } from 'react';
// import axios from 'axios';
// import LoadingScreen from '../../pages/LoadingScreen';
// import parkingService from '../../services/parking.service';
// import {
//   MapPin,
//   Star,
//   StarHalf,
//   DollarSign,
//   Clock,
//   Shield,
//   Car,
//   Wifi,
//   Power,
//   Trash2,
//   ToggleLeft,
//   ToggleRight,
//   Layers3
// } from 'lucide-react';

// interface Location {
//   _id: string;
//   title: string;
//   latitude: number;
//   longitude: number;
//   address: string;
//   description: string;
//   pricePerHour: number;
//   priceParking: number;
//   amenities: string[];
//   rating: number;       // average rating (0..5)
//   ratingCount?: number; // number of ratings
//   /** total slots hosted/created for this space */
//   totalSpots: number;
//   /** current available slots for this space (kept for future use, not shown) */
//   availableSpots: number;
//   status: string;
//   isOnline: boolean;
// }

// const ProviderLocations: React.FC = () => {
//   const [locations, setLocations] = useState<Location[]>([]);
//   const [loading, setLoading] = useState(false);

//   useEffect(() => {
//     const fetchLocations = async () => {
//       try {
//         setLoading(true);
//         const response = await axios.get(
//           `${import.meta.env.VITE_BASE_URL}/api/parking/my-spaces`,
//           {
//             headers: {
//               Accept: 'application/json',
//               Authorization: `Bearer ${localStorage.getItem('token')}`,
//             },
//           }
//         );

//         const mapped: Location[] = (response.data || []).map((item: any) => {
//           const coords = Array.isArray(item?.location?.coordinates) ? item.location.coordinates : [0, 0];
//           const addr = item?.address || {};
//           const addressStr = [addr.street, addr.city, addr.state, addr.zipCode, addr.country]
//             .filter(Boolean)
//             .join(', ');

//           return {
//             _id: item._id,
//             title: item.title,
//             latitude: Number(coords[1] ?? 0),
//             longitude: Number(coords[0] ?? 0),
//             address: addressStr || '—',
//             description: item.description || '',
//             pricePerHour: Number(item.pricePerHour ?? 0),
//             priceParking: Number(item.priceParking ?? 0),
//             amenities: Array.isArray(item.amenities) ? item.amenities : [],
//             rating: Number(item.rating ?? 0), // initial value (fallback)
//             ratingCount: undefined,
//             totalSpots: Number(item.totalSpots ?? 0),
//             availableSpots: Number(item.availableSpots ?? item.totalSpots ?? 0),
//             status: item.status || 'pending',
//             isOnline: Boolean(item.isOnline),
//           };
//         });

//         setLocations(mapped);

//         // AFTER setting mapped locations, fetch ratings for each parking space
//         // (do not change existing mapped data; augment rating & ratingCount)
//         if (mapped.length > 0) {
//           // fetch ratings in parallel (limit concurrency if needed)
//           const ratingPromises = mapped.map(async (loc) => {
//             try {
//               console.log('Fetching ratings for parking space:', loc._id);
//               const r = await axios.get(`${import.meta.env.VITE_BASE_URL}/api/ratings/parking/${loc._id}`, {
//                 headers: {
//                   Accept: 'application/json',
//                   Authorization: `Bearer ${localStorage.getItem('token')}`,
//                 },
//               });
//               console.log('Ratings response for', loc?._id, ':', r?.data);


//               const stats = r.data?.stats;
//               if (stats && typeof stats.avg === 'number') {
//                 return { id: loc._id, avg: stats.avg, count: stats.count ?? 0 };
//               }

//               // fallback if stats missing (old response format)
//               const ratingsArray: any[] = Array.isArray(r.data) ? r.data : (r.data?.ratings || []);
//               if (!ratingsArray || ratingsArray.length === 0) {
//                 return { id: loc._id, avg: Number(loc.rating ?? 0), count: 0 };
//               }
//               const sum = ratingsArray.reduce((s, it) => s + (Number(it.score) || 0), 0);
//               const avg = sum / ratingsArray.length;
//               return { id: loc._id, avg, count: ratingsArray.length };
//             } catch (err) {
//               // If endpoint fails, keep existing rating field (no break)
//               console.error(`Failed fetching ratings for ${loc._id}:`, err);
//               return { id: loc._id, avg: Number(loc.rating ?? 0), count: 0 };
//             }
//           });

//           const ratingsResults = await Promise.all(ratingPromises);

//           // merge into locations state (update only rating & ratingCount)
//           setLocations((prev) =>
//             prev.map((loc) => {
//               const rr = ratingsResults.find((x) => x.id === loc._id);
//               if (!rr) return loc;
//               // Round avg to nearest 0.5 for display (keeping raw value if you need it)
//               const roundedAvg = Math.round((rr.avg ?? 0) * 2) / 2;
//               return { ...loc, rating: roundedAvg, ratingCount: rr.count };
//             })
//           );
//         }
//       } catch (err) {
//         console.error('Error fetching locations:', err);
//         setLocations([]);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchLocations();
//   }, []);

//   // Optimistic update with server fallback
//   const handleToggleOnline = async (id: string, current: boolean) => {
//     const desired = !current;

//     // optimistic UI update
//     setLocations((prev) =>
//       prev.map((loc) => (loc._id === id ? { ...loc, isOnline: desired } : loc))
//     );

//     try {
//       const updated = await parkingService.toggleOnline(id, desired);

//       const serverValue =
//         typeof updated?.isOnline === 'boolean'
//           ? updated.isOnline
//           : typeof updated?.parkingSpace?.isOnline === 'boolean'
//             ? updated.parkingSpace.isOnline
//             : desired;

//       setLocations((prev) =>
//         prev.map((loc) => (loc._id === id ? { ...loc, isOnline: serverValue } : loc))
//       );
//     } catch (err) {
//       console.error('Failed to toggle online status:', err);
//       const msg =
//         (err as any)?.response?.data?.message ||
//         (err as any)?.message ||
//         'Could not update online status';
//       alert(msg);

//       // rollback
//       setLocations((prev) =>
//         prev.map((loc) => (loc._id === id ? { ...loc, isOnline: current } : loc))
//       );
//     }
//   };

//   const handleDelete = async (id: string) => {
//     if (!confirm('Are you sure you want to delete this space?')) return;
//     try {
//       await parkingService.deleteSpace(id);
//       setLocations((prev) => prev.filter((loc) => loc._id !== id));
//     } catch (err) {
//       console.error('Failed to delete space:', err);
//       alert('Could not delete space');
//     }
//   };

//   const getAmenityIcon = (amenity: string) => {
//     const amenityLower = amenity.toLowerCase();
//     if (amenityLower.includes('covered') || amenityLower.includes('roof')) return <Shield className="h-3.5 w-3.5" />;
//     if (amenityLower.includes('security')) return <Shield className="h-3.5 w-3.5" />;
//     if (amenityLower.includes('wifi')) return <Wifi className="h-3.5 w-3.5" />;
//     if (amenityLower.includes('ev') || amenityLower.includes('charging')) return <Power className="h-3.5 w-3.5" />;
//     return <Car className="h-3.5 w-3.5" />;
//   };

//   // helper: render star icons for average rating (rounded to nearest 0.5)
//   const renderStars = (avg: number, count?: number) => {
//     const safeAvg = Number.isFinite(avg) ? avg : 0;
//     const rounded = Math.round(safeAvg * 2) / 2; // nearest 0.5
//     const fullStars = Math.floor(rounded);
//     const hasHalf = rounded - fullStars >= 0.5;
//     const stars = [];
//     for (let i = 0; i < fullStars; i++) {
//       stars.push(<Star key={`f-${i}`} className="h-4 w-4 text-yellow-400 mr-0.5 inline-block" />);
//     }
//     if (hasHalf) {
//       stars.push(<StarHalf key="half" className="h-4 w-4 text-yellow-400 mr-0.5 inline-block" />);
//     }
//     const emptyCount = 5 - fullStars - (hasHalf ? 1 : 0);
//     for (let i = 0; i < emptyCount; i++) {
//       // show muted star for empty
//       stars.push(<Star key={`e-${i}`} className="h-4 w-4 text-gray-300 mr-0.5 inline-block" />);
//     }
//     return (
//       <div className="flex items-center space-x-2">
//         <div className="flex items-center">{stars}</div>
//         <div className="text-xs text-gray-500 dark:text-gray-400">
//           {safeAvg ? rounded.toFixed(1) : '0.0'} {count ? `· ${count}` : ''}
//         </div>
//       </div>
//     );
//   };

//   if (loading) {
//     return (
//       <div className="h-[calc(100vh-64px)] flex items-center justify-center">
//         <LoadingScreen />
//       </div>
//     );
//   }

//   return (
//     <div className="w-full p-4 bg-gray-50 dark:bg-gray-900 min-h-screen">
//       <div className="max-w-7xl mx-auto">
//         {/* Header */}
//         <div className="mb-6">
//           <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
//             My Parking Spaces
//           </h2>
//           <p className="text-gray-600 dark:text-gray-400 mt-1">
//             Manage your parking locations and slots
//           </p>
//         </div>

//         {locations.length === 0 ? (
//           <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
//             <Car className="h-16 w-16 text-gray-400 mx-auto mb-4" />
//             <p className="text-lg text-gray-500 dark:text-gray-400">No parking spaces available.</p>
//             <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
//               Get started by registering your first parking space
//             </p>
//           </div>
//         ) : (
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//             {locations.map((location) => (
//               <div
//                 key={location._id}
//                 className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-200"
//               >
//                 <div className="p-4">
//                   {/* Header */}
//                   <div className="flex justify-between items-start mb-3">
//                     <div className="flex flex-col">
//                       <h3 className="font-semibold text-gray-800 dark:text-white text-lg line-clamp-1">
//                         {location.title}
//                       </h3>
//                       {/* RATING: added display */}
//                       <div className="mt-1">
//                         {renderStars(location.rating ?? 0, location.ratingCount)}
//                       </div>
//                     </div>

//                     <span
//                       className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${location.status === 'pending'
//                           ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
//                           : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
//                         }`}
//                     >
//                       {location.status}
//                     </span>
//                   </div>

//                   {/* Address */}
//                   <div className="flex items-start mb-3">
//                     <MapPin className="h-4 w-4 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
//                     <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
//                       {location.address}
//                     </p>
//                   </div>

//                   {/* Description */}
//                   {location.description && (
//                     <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
//                       {location.description}
//                     </p>
//                   )}

//                   {/* Pricing */}
//                   <div className="grid grid-cols-2 gap-3 mb-3">
//                     <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
//                       <div className="flex items-center text-blue-700 dark:text-blue-300 mb-1">
//                         <DollarSign className="h-3.5 w-3.5 mr-1" />
//                         <span className="text-xs font-medium">Regular</span>
//                       </div>
//                       <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
//                         ₹{location.priceParking}/hr
//                       </p>
//                     </div>
//                     <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2">
//                       <div className="flex items-center text-orange-700 dark:text-orange-300 mb-1">
//                         <Clock className="h-3.5 w-3.5 mr-1" />
//                         <span className="text-xs font-medium">Overtime</span>
//                       </div>
//                       <p className="text-sm font-semibold text-orange-800 dark:text-orange-200">
//                         ₹{location.pricePerHour}/hr
//                       </p>
//                     </div>
//                   </div>

//                   {/* Hosted Slots ONLY */}
//                   <div className="mb-4">
//                     <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-3 flex items-center justify-between">
//                       <div className="flex items-center text-gray-700 dark:text-gray-300">
//                         <Layers3 className="h-4 w-4 mr-2" />
//                         <span className="text-sm font-medium">Hosted Slots</span>
//                       </div>
//                       <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
//                         {location.totalSpots}
//                       </div>
//                     </div>
//                   </div>

//                   {/* Amenities */}
//                   {location.amenities && location.amenities.length > 0 && (
//                     <div className="mb-4">
//                       <div className="flex items-center mb-2">
//                         <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
//                           Amenities
//                         </span>
//                       </div>
//                       <div className="flex flex-wrap gap-1">
//                         {location.amenities.map((amenity, index) => (
//                           <div
//                             key={index}
//                             className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
//                           >
//                             {getAmenityIcon(amenity)}
//                             <span className="text-xs ml-1">{amenity}</span>
//                           </div>
//                         ))}
//                       </div>
//                     </div>
//                   )}

//                   {/* Footer Actions */}
//                   <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
//                     <button
//                       onClick={() => handleToggleOnline(location._id, location.isOnline)}
//                       className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 ${location.isOnline
//                           ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800'
//                           : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
//                         }`}
//                     >
//                       {location.isOnline ? (
//                         <ToggleRight className="h-4 w-4 mr-1.5" />
//                       ) : (
//                         <ToggleLeft className="h-4 w-4 mr-1.5" />
//                       )}
//                       {location.isOnline ? 'Online' : 'Offline'}
//                     </button>

//                     <button
//                       onClick={() => handleDelete(location._id)}
//                       className="flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors duration-200"
//                     >
//                       <Trash2 className="h-4 w-4 mr-1.5" />
//                       Delete
//                     </button>
//                   </div>
//                 </div>
//               </div>
//             ))}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default ProviderLocations;





import React, { useEffect, useState } from 'react';
import axios from 'axios';
import LoadingScreen from '../../pages/LoadingScreen';
import parkingService from '../../services/parking.service';
import {
  MapPin,
  Star,
  StarHalf,
  DollarSign,
  Clock,
  Shield,
  Car,
  Wifi,
  Power,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Layers3,
  X,
} from 'lucide-react';

interface Location {
  _id: string;
  title: string;
  latitude: number;
  longitude: number;
  address: string;
  description: string;
  pricePerHour: number;
  priceParking: number;
  amenities: string[];
  rating: number;
  ratingCount?: number;
  totalSpots: number;
  availableSpots: number;
  status: string;
  isOnline: boolean;
}

interface Review {
  _id: string;
  score: number;
  comment: string;
  fromUser?: {
    name?: string;
    email?: string;
  };
  createdAt?: string;
}

const ProviderLocations: React.FC = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState<Location | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `${import.meta.env.VITE_BASE_URL}/api/parking/my-spaces`,
          {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );

        const mapped: Location[] = (response.data || []).map((item: any) => {
          const coords = Array.isArray(item?.location?.coordinates)
            ? item.location.coordinates
            : [0, 0];
          const addr = item?.address || {};
          const addressStr = [addr.street, addr.city, addr.state, addr.zipCode, addr.country]
            .filter(Boolean)
            .join(', ');

          return {
            _id: item._id,
            title: item.title,
            latitude: Number(coords[1] ?? 0),
            longitude: Number(coords[0] ?? 0),
            address: addressStr || '—',
            description: item.description || '',
            pricePerHour: Number(item.pricePerHour ?? 0),
            priceParking: Number(item.priceParking ?? 0),
            amenities: Array.isArray(item.amenities) ? item.amenities : [],
            rating: Number(item.rating ?? 0),
            ratingCount: undefined,
            totalSpots: Number(item.totalSpots ?? 0),
            availableSpots: Number(item.availableSpots ?? item.totalSpots ?? 0),
            status: item.status || 'pending',
            isOnline: Boolean(item.isOnline),
          };
        });

        setLocations(mapped);

        // Fetch ratings for each parking space
        if (mapped.length > 0) {
          const ratingPromises = mapped.map(async (loc) => {
            try {
              const r = await axios.get(
                `${import.meta.env.VITE_BASE_URL}/api/ratings/parking/${loc._id}`,
                {
                  headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                  },
                }
              );
              const stats = r.data?.stats;
              if (stats && typeof stats.avg === 'number') {
                return { id: loc._id, avg: stats.avg, count: stats.count ?? 0 };
              }
              const ratingsArray: any[] = Array.isArray(r.data)
                ? r.data
                : r.data?.ratings || [];
              if (!ratingsArray || ratingsArray.length === 0) {
                return { id: loc._id, avg: Number(loc.rating ?? 0), count: 0 };
              }
              const sum = ratingsArray.reduce((s, it) => s + (Number(it.score) || 0), 0);
              const avg = sum / ratingsArray.length;
              return { id: loc._id, avg, count: ratingsArray.length };
            } catch {
              return { id: loc._id, avg: Number(loc.rating ?? 0), count: 0 };
            }
          });

          const ratingsResults = await Promise.all(ratingPromises);

          setLocations((prev) =>
            prev.map((loc) => {
              const rr = ratingsResults.find((x) => x.id === loc._id);
              if (!rr) return loc;
              const roundedAvg = Math.round((rr.avg ?? 0) * 2) / 2;
              return { ...loc, rating: roundedAvg, ratingCount: rr.count };
            })
          );
        }
      } catch (err) {
        console.error('Error fetching locations:', err);
        setLocations([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLocations();
  }, []);

  // Toggle online/offline
  const handleToggleOnline = async (id: string, current: boolean) => {
    const desired = !current;
    setLocations((prev) =>
      prev.map((loc) => (loc._id === id ? { ...loc, isOnline: desired } : loc))
    );

    try {
      const updated = await parkingService.toggleOnline(id, desired);
      const serverValue =
        typeof updated?.isOnline === 'boolean'
          ? updated.isOnline
          : typeof updated?.parkingSpace?.isOnline === 'boolean'
          ? updated.parkingSpace.isOnline
          : desired;

      setLocations((prev) =>
        prev.map((loc) => (loc._id === id ? { ...loc, isOnline: serverValue } : loc))
      );
    } catch {
      alert('Could not update online status');
      setLocations((prev) =>
        prev.map((loc) => (loc._id === id ? { ...loc, isOnline: current } : loc))
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this space?')) return;
    try {
      await parkingService.deleteSpace(id);
      setLocations((prev) => prev.filter((loc) => loc._id !== id));
    } catch {
      alert('Could not delete space');
    }
  };

  const getAmenityIcon = (amenity: string) => {
    const amenityLower = amenity.toLowerCase();
    if (amenityLower.includes('covered') || amenityLower.includes('roof'))
      return <Shield className="h-3.5 w-3.5" />;
    if (amenityLower.includes('security')) return <Shield className="h-3.5 w-3.5" />;
    if (amenityLower.includes('wifi')) return <Wifi className="h-3.5 w-3.5" />;
    if (amenityLower.includes('ev') || amenityLower.includes('charging'))
      return <Power className="h-3.5 w-3.5" />;
    return <Car className="h-3.5 w-3.5" />;
  };

  const renderStars = (avg: number, count?: number) => {
    const safeAvg = Number.isFinite(avg) ? avg : 0;
    const rounded = Math.round(safeAvg * 2) / 2;
    const fullStars = Math.floor(rounded);
    const hasHalf = rounded - fullStars >= 0.5;
    const stars = [];

    for (let i = 0; i < fullStars; i++)
      stars.push(
        <Star key={`f-${i}`} className="h-4 w-4 text-yellow-400 mr-0.5 inline-block" />
      );
    if (hasHalf)
      stars.push(
        <StarHalf key="half" className="h-4 w-4 text-yellow-400 mr-0.5 inline-block" />
      );
    const emptyCount = 5 - fullStars - (hasHalf ? 1 : 0);
    for (let i = 0; i < emptyCount; i++)
      stars.push(<Star key={`e-${i}`} className="h-4 w-4 text-gray-300 mr-0.5 inline-block" />);

    return (
      <div className="flex items-center space-x-2">
        <div className="flex items-center">{stars}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {safeAvg ? rounded.toFixed(1) : '0.0'} {count ? `· ${count}` : ''}
        </div>
      </div>
    );
  };

  // open modal
  const openReviewsModal = async (space: Location) => {
    setSelectedSpace(space);
    setReviews([]);
    setReviewsLoading(true);
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_BASE_URL}/api/ratings/parking/${space._id}`,
        {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      setReviews(Array.isArray(res.data?.ratings) ? res.data.ratings : []);
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedSpace(null);
    setReviews([]);
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <LoadingScreen />
      </div>
    );
  }

  return (
    <div className="w-full p-4 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">My Parking Spaces</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your parking locations and slots
          </p>
        </div>

        {locations.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            <Car className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-lg text-gray-500 dark:text-gray-400">No parking spaces available.</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Get started by registering your first parking space
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {locations.map((location) => (
              <div
                key={location._id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-200"
              >
                <div className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex flex-col">
                      <h3 className="font-semibold text-gray-800 dark:text-white text-lg line-clamp-1">
                        {location.title}
                      </h3>
                      <div className="mt-1 flex items-center space-x-2">
                        {renderStars(location.rating ?? 0, location.ratingCount)}
                        <button
                          onClick={() => openReviewsModal(location)}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Show Details
                        </button>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        location.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      }`}
                    >
                      {location.status}
                    </span>
                  </div>

                  <div className="flex items-start mb-3">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                      {location.address}
                    </p>
                  </div>

                  {location.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                      {location.description}
                    </p>
                  )}

                  {/* Pricing */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
                      <div className="flex items-center text-blue-700 dark:text-blue-300 mb-1">
                        <DollarSign className="h-3.5 w-3.5 mr-1" />
                        <span className="text-xs font-medium">Regular</span>
                      </div>
                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                        ₹{location.priceParking}/hr
                      </p>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2">
                      <div className="flex items-center text-orange-700 dark:text-orange-300 mb-1">
                        <Clock className="h-3.5 w-3.5 mr-1" />
                        <span className="text-xs font-medium">Overtime</span>
                      </div>
                      <p className="text-sm font-semibold text-orange-800 dark:text-orange-200">
                        ₹{location.pricePerHour}/hr
                      </p>
                    </div>
                  </div>

                  {/* Slots */}
                  <div className="mb-4">
                    <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center text-gray-700 dark:text-gray-300">
                        <Layers3 className="h-4 w-4 mr-2" />
                        <span className="text-sm font-medium">Hosted Slots</span>
                      </div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {location.totalSpots}
                      </div>
                    </div>
                  </div>

                  {/* Amenities */}
                  {location.amenities && location.amenities.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center mb-2">
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Amenities
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {location.amenities.map((amenity, index) => (
                          <div
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                          >
                            {getAmenityIcon(amenity)}
                            <span className="text-xs ml-1">{amenity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => handleToggleOnline(location._id, location.isOnline)}
                      className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                        location.isOnline
                          ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {location.isOnline ? (
                        <ToggleRight className="h-4 w-4 mr-1.5" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 mr-1.5" />
                      )}
                      {location.isOnline ? 'Online' : 'Offline'}
                    </button>

                    <button
                      onClick={() => handleDelete(location._id)}
                      className="flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors duration-200"
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal for showing reviews */}
      {selectedSpace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-4 relative">
            <button
              onClick={closeModal}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
              Ratings & Reviews — {selectedSpace.title}
            </h3>

            {reviewsLoading ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-6">
                Loading reviews...
              </div>
            ) : reviews.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-6">
                No reviews yet for this parking space.
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-3 pr-2">
                {reviews.map((rev) => (
                  <div
                    key={rev._id}
                    className="border border-gray-200 dark:border-gray-700 rounded-md p-3"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-sm text-gray-800 dark:text-gray-100">
                        {rev.fromUser?.name || 'Anonymous'}
                      </span>
                      {renderStars(rev.score)}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {rev.comment || '—'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {rev.createdAt
                        ? new Date(rev.createdAt).toLocaleString()
                        : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderLocations;
