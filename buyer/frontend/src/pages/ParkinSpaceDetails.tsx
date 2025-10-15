import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ParkingSpace } from '../types/parking';
import { toast } from 'react-toastify';
import { 
  Car, 
  Shield, 
  Camera, 
  Wifi, 
  Umbrella, 
  Zap,
  MapPin,
  Clock,
  User,
  Star,
  Map
} from 'lucide-react';
import { FaMoneyCheck } from 'react-icons/fa';

// ✅ import socket hook
import { useSocket } from '../context/SocketContext';

const amenityIcons: { [key: string]: React.ReactNode } = {
  'Security': <Shield className="w-4 h-4" />,
  'CCTV': <Camera className="w-4 h-4" />,
  'WiFi': <Wifi className="w-4 h-4" />,
  'Covered': <Umbrella className="w-4 h-4" />,
  'EV Charging': <Zap className="w-4 h-4" />,
  'Car Wash': <Car className="w-4 h-4" />
};

export default function ParkingDetails() {
  const location = useLocation();
  const navigate = useNavigate();
  const socket = useSocket(); // ✅ socket instance

  const { state } = location;
  const initialSpace: ParkingSpace | undefined = state?.space;
  const user = state?.user;

  // ✅ use local state so we can update availableSpots on socket events
  const [space, setSpace] = useState<ParkingSpace | undefined>(initialSpace);

  useEffect(() => {
    setSpace(initialSpace);
  }, [initialSpace]);

  // ✅ listen for parking-updated / parking-released events
  useEffect(() => {
    if (!socket || !space) return;

    const handleParkingUpdate = (data: any) => {
      const parkingId = data.parkingId || data._id || data.id;
      const availableSpots =
        typeof data.availableSpots === 'number'
          ? data.availableSpots
          : data.available || data.availableSpots;

      if (!parkingId || typeof availableSpots !== 'number') return;

      const sid =
        space._id && typeof space._id === 'object' && space._id.toString
          ? space._id.toString()
          : space._id;

      if (String(parkingId) === String(sid)) {
        setSpace((prev) => (prev ? { ...prev, availableSpots } : prev));
      }
    };

    socket.on('parking-updated', handleParkingUpdate);
    socket.on('parking-released', handleParkingUpdate);

    return () => {
      socket.off('parking-updated', handleParkingUpdate);
      socket.off('parking-released', handleParkingUpdate);
    };
  }, [socket, space]);

  if (!space) {
    return <div>Parking space details not found.</div>;
  }

  // Safely access address properties
  const address = space.address || {};
  const street = address.street || 'No street information';
  const city = address.city || 'No city information';
  const stateName = address.state || 'No state information';
  const country = address.country || 'No country information';
  const zipCode = address.zipCode || 'No zip code';

  const handleBookNow = () => {
    if (!user) {
      toast.info('Please log in to book the parking space.');
      return;
    }

    if (!user.isVerified) {
      toast.info('Your account is not verified. Please complete your verification to book the parking space.');
      return;
    }

    // Ensure we pass strings, not Mongoose ObjectIds or nested objects
    const sid =
      space._id && typeof space._id === 'object' && space._id.toString
        ? space._id.toString()
        : space._id;
    const uid = user._id ?? user.id ?? userId ?? user?.toString();

    console.log('Navigating to VehicleDetails with:', { sid, uid });
    navigate('/vehicle-details', { state: { spaceId: sid, userId: uid } });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Image Section */}
          <div className="w-full h-48 relative">
            <img
              src={
                space.imageUrl ||
                "https://plus.unsplash.com/premium_photo-1673886205989-24c637783c60?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
              }
              alt={space.title}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="p-4">
            {/* Title and Location */}
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-gray-800">{space.title}</h1>
              <div className="flex items-center text-gray-600">
                <MapPin className="w-4 h-4 mr-1" />
                <p className="text-sm">
                  {street}, {city}, {stateName}, {country} - {zipCode}
                </p>
              </div>
            </div>

            {/* Price and Availability */}
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center text-red-600">
                <span className="text-lg font-bold">₹{space.pricePerHour}</span>
                <span className="text-sm ml-1">/hour</span>
              </div>

              <div className="flex items-center text-gray-600 mt-2">
                <FaMoneyCheck className="w-4 h-4 mr-1 text-red-500" />
                <span className="text-sm">Extra Price: {space.priceParking} </span>
              </div>

              <div className="flex items-center text-red-600">
                <Clock className="w-4 h-4 mr-1" />
                <span className="text-sm">
                  {space.availableSpots} spots available
                </span>
              </div>
            </div>

            {/* Distance */}
            <div className="flex items-center text-gray-600 mt-2">
              <Map className="w-4 h-4 mr-1" />
              <span className="text-sm">
                {(space.distance ?? 0).toFixed(2)} km away
              </span>
            </div>

            {/* Owner Information */}
            <div className="flex items-center text-gray-600 mt-2">
              <User className="w-4 h-4 mr-1" />
              <span className="text-sm">
                Owner: {space.owner?.name || 'Unknown'}
              </span>
            </div>

            {/* Rating */}
            <div className="flex items-center text-gray-600 mt-2">
              <Star className="w-4 h-4 mr-1 text-red-500" />
              <span className="text-sm">Rating: {space.rating} / 5</span>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-600 mt-3">{space.description}</p>

            {/* Amenities */}
            {space.amenities && space.amenities.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  Amenities
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {space.amenities.map((amenity) => (
                    <div
                      key={amenity}
                      className="flex items-center space-x-1 bg-gray-50 rounded p-2"
                    >
                      <span className="text-red-600">
                        {amenityIcons[amenity] || (
                          <Shield className="w-4 h-4" />
                        )}
                      </span>
                      <span className="text-xs text-gray-600">{amenity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Book Now Button */}
            <button
              onClick={handleBookNow}
              className="mt-4 w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center justify-center space-x-2"
            >
              <Car className="w-4 h-4" />
              <span>Book Now</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
