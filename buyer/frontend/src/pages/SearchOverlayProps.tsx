// src/components/SearchOverlayProps.tsx
import React, { useEffect, useState } from 'react';
import { X, Car, ShieldCheck, Plug, Video, Home } from 'lucide-react';
import LocationSearchBox from '../components/search/LocationSearch';
import { GeocodingResult } from '../utils/geocoding';
import { useMapContext } from '../context/MapContext';
import { parkingService } from '../services/parking.service';
import { ParkingSpace } from '../types/parking';
import { toast } from 'react-toastify';
import ParkingSpaceList from '../components/parking/ParkingSpaceList';
import FilterBox from './Filterbox';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const [searchedLocation, setSearchedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const { viewport, setViewport } = useMapContext();
  const [parkingSpaces, setParkingSpaces] = useState<ParkingSpace[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
    const { user } = useAuth();
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    amenities: {
      covered: false,
      security: false,
      charging: false,
      cctv: false,
      wheelchair: false,
    },
    priceRange: [0, 500],
  });

  const fetchNearbyParkingSpaces = async (lat: number, lng: number) => {
    try {
      const spaces = await parkingService.getNearbySpaces(lat, lng);
      setParkingSpaces(spaces);
    } catch (error) {
      toast.error('Failed to fetch parking spaces.');
    }
  };

  // On mount: fetch all spaces when there is no explicit searched location
  useEffect(() => {
    let cancelled = false;
    const loadAll = async () => {
      try {
        const all = await parkingService.getAllSpaces();
        if (!cancelled) setParkingSpaces(all || []);
      } catch (err) {
        console.warn('getAllSpaces failed in SearchOverlay mount', err);
      }
    };
    loadAll();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setViewport({ ...viewport, latitude, longitude });
          setCurrentLocation({ lat: latitude, lng: longitude });
          // If you prefer to show only nearby on location detection, you can call fetchNearbyParkingSpaces(latitude, longitude)
          // But to keep the "show all unless filters are applied" behavior, we don't overwrite the all-spaces list here.
        },
        (error) => {
          console.error('Location error:', error);
          toast.error('Could not get your location. Please enable location services.');
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isOpen) return null;

  const handleLocationSelect = async (result: GeocodingResult) => {
    setSearchedLocation({ lat: result.latitude, lng: result.longitude });
    setViewport({ ...viewport, longitude: result.longitude, latitude: result.latitude });

    try {
      const spaces = await parkingService.getNearbySpaces(result.latitude, result.longitude);
      setParkingSpaces(spaces);
      if (spaces.length === 0) toast.info('No nearby parking spaces available at the selected location.');
    } catch (error) {
      toast.error('Failed to fetch parking spaces for the selected location.');
    }
  };

  const handleGoToCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });
        setSearchedLocation({ lat: latitude, lng: longitude });
        setViewport({ ...viewport, latitude, longitude, zoom: 14 });
        // fetchNearbyParkingSpaces(latitude, longitude); // optional - user expectation may vary
      },
      () => {
        toast.error('Failed to access your current location.');
      }
    );
  };

  const amenities = [
    { id: 'covered', label: 'Covered Parking', icon: Car },
    { id: 'security', label: 'Security', icon: ShieldCheck },
    { id: 'charging', label: 'EV Charging', icon: Plug },
    { id: 'cctv', label: 'CCTV Surveillance', icon: Video },
    { id: 'wheelchair', label: 'Wheelchair Accessible', icon: Home },
  ];

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-y-auto flex justify-center ">
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-lg p-6 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2">
            <Home className="w-6 h-6 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-800">Find Your Parking Space</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full">
            <X className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        <div className="relative mb-6 z-10">
          <LocationSearchBox onLocationSelect={handleLocationSelect} onGoToCurrentLocation={handleGoToCurrentLocation} />
        </div>

        <FilterBox filters={filters} onFilterChange={setFilters} />

        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Select Amenities:</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {amenities.map((amenity: any) => (
              <div
                key={amenity.id}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border cursor-pointer hover:bg-red-100 transition ${
                  filters.amenities[amenity.id] ? 'bg-red-200 border-red-400' : 'border-gray-300'
                }`}
                onClick={() => setFilters({
                  ...filters,
                  amenities: { ...filters.amenities, [amenity.id]: !filters.amenities[amenity.id] }
                })}
              >
                <amenity.icon className="w-8 h-8 text-red-500" />
                <p className="text-sm text-gray-700 mt-2">{amenity.label}</p>
              </div>
            ))}
          </div>
        </div>

        <ParkingSpaceList
          spaces={parkingSpaces}onSpaceSelect={(space) => navigate('/parking-details', { state: { space, user } })}
          filters={filters}
          userLocation={searchedLocation || currentLocation}
        />
      </div>
    </div>
  );
}