// src/pages/Home.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import Map, { Source, Layer } from 'react-map-gl';
import { toast } from 'react-toastify';
import { ParkingSpace } from '../types/parking';
import ParkingSpaceList from '../components/parking/ParkingSpaceList';
import ParkingMarker from '../components/map/ParkingMarker';
import ParkingPopup from '../components/map/ParkingPopup';
import { useMapContext } from '../context/MapContext';
import { parkingService } from '../services/parking.service';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { GeocodingResult } from '../utils/geocoding';
import {
  MdLocationOn,
  MdFilterList,
  MdGpsFixed,
  MdSearch,
  MdMyLocation,
  MdClose,
  MdAccessTime,
  MdSchedule,
  MdList,
  MdExpandMore,
  MdExpandLess
} from 'react-icons/md';
import { FaParking, FaMapMarkerAlt, FaShieldAlt, FaBolt, FaWheelchair, FaVideo, FaUmbrella } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import LoadingScreen from './LoadingScreen';
import { useSocket } from '../context/SocketContext';

export default function Home() {
  const { viewport, setViewport } = useMapContext();
  const { user } = useAuth();
  const navigate = useNavigate();
  const socket = useSocket();

  const [parkingSpaces, setParkingSpaces] = useState<ParkingSpace[]>([]);
  const [filteredSpaces, setFilteredSpaces] = useState<ParkingSpace[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<ParkingSpace | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchedLocation, setSearchedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [routeData, setRouteData] = useState<any>(null);
  const [popupTimeout, setPopupTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isPopupHovered, setIsPopupHovered] = useState(false);

  // UI State
  const [showFilters, setShowFilters] = useState(false);
  const [showParkingList, setShowParkingList] = useState(true);
  const [showTimeFilter, setShowTimeFilter] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFilterActive, setIsSearchFilterActive] = useState(false);
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Time filter state
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);

  // Filters state
  const [filters, setFilters] = useState({
    amenities: {
      covered: false,
      security: false,
      charging: false,
      cctv: false,
      wheelchair: false,
    },
    priceRange: [0, 1000] as [number, number],
    isPriceFilterActive: false,
  });

  // Amenity config
  const amenityFilters = [
    { id: 'covered', label: 'Covered', icon: FaUmbrella, description: 'Protected from weather' },
    { id: 'security', label: 'Security', icon: FaShieldAlt, description: '24/7 security guard' },
    { id: 'charging', label: 'EV Charging', icon: FaBolt, description: 'Electric vehicle charging' },
    { id: 'cctv', label: 'CCTV', icon: FaVideo, description: 'Surveillance cameras' },
    { id: 'wheelchair', label: 'Accessible', icon: FaWheelchair, description: 'Wheelchair accessible' },
  ];

  // Get current datetime rounded to nearest 30 minutes in 24-hour format
  const getCurrentDateTimeRounded = () => {
    const now = new Date();
    const minutes = now.getMinutes();
    const roundedMinutes = minutes < 30 ? 30 : 0;
    now.setMinutes(roundedMinutes, 0, 0);
    if (roundedMinutes === 0 && minutes >= 30) {
      now.setHours(now.getHours() + 1);
    }
    return now.toISOString().slice(0, 16);
  };

  // Get minimum end time (start time + 30 minutes)
  const getMinEndTime = () => {
    if (!startTime) return getCurrentDateTimeRounded();
    const start = new Date(startTime);
    start.setMinutes(start.getMinutes() + 30);
    return start.toISOString().slice(0, 16);
  };

  // Get maximum date (current date + 30 days)
  const getMaxDateTime = () => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    return maxDate.toISOString().slice(0, 16);
  };

  // Validate time selection
  const validateTimeSelection = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const now = new Date();

    if (startDate < now) {
      toast.error('Start time cannot be in the past');
      return false;
    }

    if (endDate <= startDate) {
      toast.error('End time must be after start time');
      return false;
    }

    const diffMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
    if (diffMinutes < 30) {
      toast.error('Minimum booking duration is 30 minutes');
      return false;
    }

    return true;
  };

  // Format time for display in 24-hour format
  const formatDisplayTime = (datetime: string) => {
    if (!datetime) return '';
    const date = new Date(datetime);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).replace('AM', '').replace('PM', '').trim();
  };

  // ---------- price meta helper ----------
  const computePriceMeta = (space: any) => {
    const baseRaw = space?.priceParking ?? space?.pricePerHour ?? space?.price ?? 0;
    const base = Number(baseRaw) || 0;
    const rawDiscount = space?.discount ?? 0;
    const discount = Number(rawDiscount);
    const clamped = Number.isFinite(discount) ? Math.max(0, Math.min(100, discount)) : 0;
    const discounted = +(base * (1 - clamped / 100)).toFixed(2);
    return {
      basePrice: +base.toFixed(2),
      discountedPrice: discounted,
      discountPercent: clamped,
      hasDiscount: clamped > 0 && discounted < base,
    };
  };
  // --------------------------------------------

  // ---------- time-window availability helper ----------
  function computeAvailableSpotsForWindow(
    space: any,
    start?: string | null,
    end?: string | null
  ): number | undefined {
    if (!start || !end) return undefined;

    // If backend already provided a window-specific number, respect it.
    if (typeof space.availableSpots === 'number' && !Number.isNaN(space.availableSpots)) {
      return space.availableSpots;
    }

    // Derive from total capacity & overlapping bookings/reservations
    const total =
      Number(space.totalSpots ?? space.total_slots ?? space.capacity ?? space.slotCount ?? space.total ?? 0) || 0;
    if (total <= 0) return undefined;

    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return undefined;

    const bookings: any[] = Array.isArray(space.bookings)
      ? space.bookings
      : Array.isArray(space.reservations)
      ? space.reservations
      : [];

    let used = 0;
    for (const b of bookings) {
      const bs = new Date(b.startTime ?? b.start ?? b.from ?? b.checkIn ?? b.begin ?? '').getTime();
      const be = new Date(b.endTime ?? b.end ?? b.to ?? b.checkOut ?? b.finish ?? '').getTime();
      if (!Number.isFinite(bs) || !Number.isFinite(be)) continue;

      const overlaps = bs < e && be > s;
      const status = String(b.status ?? '').toLowerCase();
      const isCancelled = ['cancelled', 'canceled', 'void', 'refunded'].includes(status);

      if (overlaps && !isCancelled) {
        const qty = Number(b.quantity ?? b.qty ?? 1);
        used += Number.isFinite(qty) ? Math.max(0, qty) : 1;
      }
    }

    return Math.max(0, total - used);
  }

  // small helper to attach price + computed availability in one place
  const decorateSpace = (s: any) => {
    const computedAvail = computeAvailableSpotsForWindow(s, startTime, endTime);
    return {
      ...s,
      __price: s.__price ?? computePriceMeta(s),
      ...(computedAvail !== undefined ? { availableSpots: computedAvail } : {}),
    };
  };
  // -------------------------------------------------------------

  // ---------- only-approve helper ----------
  const onlyApproved = (spaces: any[] | undefined | null) => {
    if (!Array.isArray(spaces)) return [];
    return spaces.filter((s) => {
      const status = String(s?.status || '').toLowerCase();
      const online = typeof s?.isOnline !== 'undefined' ? Boolean(s.isOnline) : false;
      return status === 'submitted' && online;
    });
  };

  // -------------------------------------------------------------

  // Keep filteredSpaces in sync with parkingSpaces
  useEffect(() => {
    setFilteredSpaces(parkingSpaces);
  }, [parkingSpaces]);

  // Socket: handle realtime park updates & respect time filter
  useEffect(() => {
    if (!socket) return;

    const handleParkingUpdate = (data: any) => {
      if (!data) return;
      const parkingId = data.parkingId || data._id || data.id;
      const availableSpots =
        typeof data.availableSpots === 'number' ? data.availableSpots : data.available || data.availableSpots;
      if (!parkingId || (availableSpots !== undefined && (typeof availableSpots !== 'number' || isNaN(availableSpots)))) {
        // if no numeric availableSpots provided, we won't change availability here
      }

      setParkingSpaces((prev) => {
        const pid = String(parkingId);
        const foundIdx = prev.findIndex((s: any) => {
          const sid = s._id ? (typeof s._id === 'string' ? s._id : String(s._id)) : s.id;
          return sid === pid;
        });

        const incomingStatus = String(data.status || '').toLowerCase();
        const incomingOnline = typeof data.isOnline !== 'undefined' ? Boolean(data.isOnline) : true;

        // If incoming is not approved or offline -> remove
        if ((incomingStatus && incomingStatus !== 'submitted') || incomingOnline === false) {
          if (foundIdx >= 0) {
            const copy = [...prev];
            copy.splice(foundIdx, 1);
            return copy;
          }
          return prev;
        }

        // If time filter active and availableSpots <= 0 -> remove
        if (startTime && endTime && typeof availableSpots === 'number' && availableSpots <= 0) {
          if (foundIdx >= 0) {
            const copy = [...prev];
            copy.splice(foundIdx, 1);
            return copy;
          }
          return prev;
        }

        // Update/append
        if (foundIdx >= 0) {
          const copy = [...prev];
          copy[foundIdx] = {
            ...copy[foundIdx],
            ...data,
            ...(typeof availableSpots === 'number' ? { availableSpots } : {}),
          };
          return copy;
        } else {
          if ((data.status && String(data.status).toLowerCase() !== 'submitted') || (typeof data.isOnline !== 'undefined' && !data.isOnline)) {
            return prev;
          }
          if (startTime && endTime && typeof availableSpots === 'number' && availableSpots <= 0) {
            return prev;
          }
          const newSpace = { ...data, __price: data.__price ?? computePriceMeta(data) };
          return [newSpace, ...prev];
        }
      });

      // filteredSpaces mirror
      setFilteredSpaces((prev) => {
        const pid = String(parkingId);
        const foundIdx = prev.findIndex((s: any) => {
          const sid = s._id ? (typeof s._id === 'string' ? s._id : String(s._id)) : s.id;
          return sid === pid;
        });

        const incomingStatus = String(data.status || '').toLowerCase();
        const incomingOnline = typeof data.isOnline !== 'undefined' ? Boolean(data.isOnline) : true;

        if ((incomingStatus && incomingStatus !== 'submitted') || incomingOnline === false) {
          if (foundIdx >= 0) {
            const copy = [...prev];
            copy.splice(foundIdx, 1);
            return copy;
          }
          return prev;
        }

        if (startTime && endTime && typeof availableSpots === 'number' && availableSpots <= 0) {
          if (foundIdx >= 0) {
            const copy = [...prev];
            copy.splice(foundIdx, 1);
            return copy;
          }
          return prev;
        }

        if (foundIdx >= 0) {
          const copy = [...prev];
          copy[foundIdx] = {
            ...copy[foundIdx],
            ...data,
            ...(typeof availableSpots === 'number' ? { availableSpots } : {}),
          };
          return copy;
        } else {
          if ((data.status && String(data.status).toLowerCase() !== 'submitted') || (typeof data.isOnline !== 'undefined' && !data.isOnline)) return prev;
          if (startTime && endTime && typeof availableSpots === 'number' && availableSpots <= 0) return prev;
          const newSpace = { ...data, __price: data.__price ?? computePriceMeta(data) };
          return [newSpace, ...prev];
        }
      });

      // Selected space
      setSelectedSpace((prev) => {
        if (!prev) return prev;
        const sid = prev._id ? (typeof prev._id === 'string' ? prev._id : String(prev._id)) : (prev as any).id;
        if (sid === String(parkingId)) {
          if ((data.status && String(data.status).toLowerCase() !== 'submitted') || (typeof data.isOnline !== 'undefined' && !data.isOnline)) {
            return null;
          }
          if (startTime && endTime && typeof availableSpots === 'number' && availableSpots <= 0) {
            return null;
          }
          return { ...prev, ...(typeof availableSpots === 'number' ? { availableSpots } : {}), ...data } as any;
        }
        return prev;
      });
    };

    socket.on('parking-updated', handleParkingUpdate);
    socket.on('parking-released', handleParkingUpdate);

    return () => {
      socket.off('parking-updated', handleParkingUpdate);
      socket.off('parking-released', handleParkingUpdate);
    };
  }, [socket, startTime, endTime]);

  // Debounced popup close
  const debouncedClosePopup = useCallback(() => {
    if (popupTimeout) clearTimeout(popupTimeout);
    if (!isPopupHovered) {
      const timeout = setTimeout(() => setSelectedSpace(null), 300);
      setPopupTimeout(timeout);
    }
  }, [popupTimeout, isPopupHovered]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (popupTimeout) clearTimeout(popupTimeout);
    };
  }, [popupTimeout]);

  // ----- Geolocation & initial load -----
  useEffect(() => {
    const init = async () => {
      try {
        if ('permissions' in navigator) {
          const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          if (permission.state === 'granted' || permission.state === 'prompt') {
            await getUserLocation();
          } else {
            await setDefaultLocation();
          }
        } else {
          await getUserLocation();
        }
      } catch {
        await setDefaultLocation();
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setDefaultLocation = async () => {
    const defaultLat = 28.6139;
    const defaultLng = 77.2090;
    setViewport({
      ...viewport,
      latitude: defaultLat,
      longitude: defaultLng,
      zoom: 16,
      pitch: 30,
      bearing: -10,
    });
    setCurrentLocation({ lat: defaultLat, lng: defaultLng });
    await loadDefaultParkingMarkers(defaultLat, defaultLng);
    setLoading(false);
  };

  const getUserLocation = async () => {
    if (!navigator.geolocation) {
      await setDefaultLocation();
      return;
    }

    return new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setViewport({
            ...viewport,
            latitude,
            longitude,
            zoom: 16,
            pitch: 35,
            bearing: -12,
          });
          setCurrentLocation({ lat: latitude, lng: longitude });
          await loadDefaultParkingMarkers(latitude, longitude);
          setLoading(false);
          resolve();
        },
        async (error) => {
          console.error('Location error:', error);
          toast.error(
            <div className="flex items-center justify-between">
              <span>Could not get your location. Please enable location services.</span>
              <button
                onClick={() => {
                  if (navigator.userAgent.includes('Chrome')) {
                    window.open('chrome://settings/content/location', '_blank');
                  } else if (navigator.userAgent.includes('Firefox')) {
                    window.open('about:preferences#privacy', '_blank');
                  } else {
                    window.open('chrome://settings/content/location', '_blank');
                  }
                }}
                className="bg-blue-600 text-white px-3 py-1 ml-2 rounded-lg hover:bg-blue-700 text-sm transition-all duration-300 hover:scale-105"
              >
                Enable Location
              </button>
            </div>,
            { autoClose: false }
          );
          await setDefaultLocation();
          resolve();
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    });
  };

  // Load default markers (only approved). Respects startTime/endTime.
  const loadDefaultParkingMarkers = async (lat: number, lng: number) => {
    try {
      setLoading(true);
      if (typeof (parkingService as any).getAllSpaces === 'function') {
        try {
          // pass onlyAvailable = true so backend filters by availability for given interval
          const all = await (parkingService as any).getAllSpaces(startTime ?? undefined, endTime ?? undefined, true);
          if (Array.isArray(all) && all.length > 0) {
            let allowed = onlyApproved(all).map((s) => decorateSpace(s));

            if (startTime && endTime) {
              allowed = allowed.filter((s: any) => Number(s.availableSpots) > 0);
            }

            setParkingSpaces(allowed);
            return;
          }
        } catch (err) {
          console.warn('getAllSpaces failed, falling back to getNearbySpaces', err);
        }
      }

      const spaces = await parkingService.getNearbySpaces(
        lat,
        lng,
        startTime ?? undefined,
        endTime ?? undefined,
        true
      );

      let allowed = onlyApproved(spaces).map((s) => decorateSpace(s));

      if (startTime && endTime) {
        allowed = allowed.filter((s: any) => Number(s.availableSpots) > 0);
      }

      setParkingSpaces(allowed || []);
    } catch (err) {
      console.error('Failed to load default parking markers', err);
      setParkingSpaces([]);
      toast.error('Failed to load parking markers.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch nearby when searching or fetching all (only approved)
  const fetchNearbyParkingSpaces = async (_lat: number, _lng: number) => {
    try {
      setLoading(true);

      const spaces = await parkingService.getAllSpaces(
        startTime ?? undefined,
        endTime ?? undefined,
        true
      );

      const spacesWithPrice = (spaces || []).map((s: any) => decorateSpace(s));

      let allowed = onlyApproved(spacesWithPrice);

      if (startTime && endTime) {
        allowed = allowed.filter((s) => Number(s.availableSpots) > 0);
      }

      setParkingSpaces(allowed);

      if (allowed && allowed.length > 0) {
        setTimeout(() => {
          setViewport((prev) => ({
            ...prev,
            zoom: Math.min((prev.zoom ?? 9), 11),
          }));
        }, 500);
      }
    } catch (error) {
      console.error('Failed to fetch parking spaces.', error);
      toast.error('Failed to fetch parking spaces.');
    } finally {
      setLoading(false);
    }
  };

  // ----- Handlers -----
  const handleSearchByCurrentLocation = () => {
    if (currentLocation) {
      setIsSearchFilterActive(false);
      setSearchedLocation(null);
      setSearchQuery('');
      setViewport({ ...viewport, latitude: currentLocation.lat, longitude: currentLocation.lng, zoom: 16 });
      loadDefaultParkingMarkers(currentLocation.lat, currentLocation.lng);
      toast.success('Showing parking spaces around you');
    } else {
      toast.info('Current location not available.');
    }
  };

  const handleMarkerClick = async (space: ParkingSpace) => {
    setSelectedSpace(space);
    if (popupTimeout) clearTimeout(popupTimeout);

    setViewport((prev) => ({
      ...prev,
      latitude: space.location.coordinates[1],
      longitude: space.location.coordinates[0],
    }));

    if (currentLocation) {
      const { lat: originLat, lng: originLng } = currentLocation;
      const [destLng, destLat] = space.location.coordinates;
      await fetchRoute(originLat, originLng, destLat, destLng);
    }
  };

  const handleMarkerHover = (space: ParkingSpace) => {
    setSelectedSpace(space);
    if (popupTimeout) clearTimeout(popupTimeout);
  };

  const handlePopupMouseEnter = () => {
    setIsPopupHovered(true);
    if (popupTimeout) clearTimeout(popupTimeout);
  };

  const handlePopupMouseLeave = () => {
    setIsPopupHovered(false);
    debouncedClosePopup();
  };

  const handleClosePopup = () => {
    setSelectedSpace(null);
    if (popupTimeout) clearTimeout(popupTimeout);
  };

  const handleFilterToggle = (amenity: string) => {
    setFilters((prev) => ({
      ...prev,
      amenities: {
        ...prev.amenities,
        [amenity]: !prev.amenities[amenity as keyof typeof prev.amenities],
      },
    }));
  };

  const handlePriceRangeChange = (min: number, max: number) => {
    setFilters((prev) => ({
      ...prev,
      priceRange: [min, max],
      isPriceFilterActive: true,
    }));
  };

  const clearAllFilters = () => {
    setFilters({
      amenities: {
        covered: false,
        security: false,
        charging: false,
        cctv: false,
        wheelchair: false,
      },
      priceRange: [0, 1000],
      isPriceFilterActive: false,
    });
    setSearchQuery('');
    setIsSearchFilterActive(false);
  };

  const getActiveFilterCount = () => {
    const activeAmenities = Object.values(filters.amenities).filter(Boolean).length;
    const isPriceFiltered = filters.isPriceFilterActive;
    const hasSearchQuery = isSearchFilterActive && searchQuery.trim() !== '';
    return activeAmenities + (isPriceFiltered ? 1 : 0) + (hasSearchQuery ? 1 : 0);
  };

  const fetchRoute = async (originLat: number, originLng: number, destLat: number, destLng: number) => {
    try {
      const response = await axios.get(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${originLng},${originLat};${destLng},${destLat}`,
        {
          params: {
            alternatives: false,
            geometries: 'geojson',
            overview: 'full',
            steps: true,
            access_token:
              'pk.eyJ1IjoicGFya2Vhc2UxIiwiYSI6ImNtNGN1M3pmZzBkdWoya3M4OGFydjgzMzUifQ.wbsW51a7zFMq0yz0SeV6_A',
          },
        }
      );
      setRouteData(response.data.routes[0]);
    } catch (error) {
      console.error('Route fetch error:', error);
    }
  };

  const handleGoToCurrentLocation = () => {
    if (currentLocation) {
      setViewport({ ...viewport, latitude: currentLocation.lat, longitude: currentLocation.lng, zoom: 16 });
      loadDefaultParkingMarkers(currentLocation.lat, currentLocation.lng);
    } else {
      toast.info('Current location not available.');
    }
  };

  // Route layer setup
  const routeLayer = {
    id: 'route',
    type: 'line',
    source: 'route',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#3887be', 'line-width': 5 },
  };

  const routeSourceData = routeData ? { type: 'Feature', geometry: routeData.geometry } : null;

  // Mapbox geocoding for the search box
  const searchLocations = async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    try {
      const response = await axios.get(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
        {
          params: {
            access_token:
              'pk.eyJ1IjoicGFya2Vhc2UxIiwiYSI6ImNtNGN1M3pmZzBkdWoya3M4OGFydjgzMzUifQ.wbsW51a7zFMq0yz0SeV6_A',
            limit: 5,
            types: 'place,locality,neighborhood,address',
            proximity: currentLocation ? `${currentLocation.lng},${currentLocation.lat}` : undefined,
          },
        }
      );

      const results: GeocodingResult[] = response.data.features.map((feature: any) => ({
        latitude: feature.center[1],
        longitude: feature.center[0],
        address: feature.place_name,
      }));

      setSearchResults(results);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Geocoding error:', error);
      toast.error('Failed to search locations');
    }
  };

  // When user selects a search suggestion: center map & fetch that area's parkings
  const handleLocationSelect = async (result: GeocodingResult) => {
    setIsSearchFilterActive(false);

    setSearchQuery(result.address || '');
    setSearchedLocation({ lat: result.latitude, lng: result.longitude });
    setViewport({ ...viewport, longitude: result.longitude, latitude: result.latitude, zoom: 16 });
    setShowSearchResults(false);

    try {
      setLoading(true);
      const spaces = await parkingService.getNearbySpaces(
        result.latitude,
        result.longitude,
        startTime ?? undefined,
        endTime ?? undefined,
        true
      );

      const spacesWithDecor = (spaces || []).map((s: any) => decorateSpace(s));

      let allowed = onlyApproved(spacesWithDecor);

      if (startTime && endTime) {
        allowed = allowed.filter((s) => Number(s.availableSpots) > 0);
      }

      setParkingSpaces(allowed);

      if (!allowed || allowed.length === 0) {
        toast.info('No parking spaces found in this area. Try increasing the search radius or remove time filter.');
      } else {
        toast.success(`Found ${allowed.length} parking spaces near ${result.address.split(',')[0]}`);
      }
    } catch (error) {
      toast.error('Failed to fetch parking spaces for the selected location.');
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = useCallback(debounce((query: string) => searchLocations(query), 300), [currentLocation]);

  // When user types in input => enable textual filter behavior
  const handleSearchInputChange = async (query: string) => {
    setSearchQuery(query);
    setIsSearchFilterActive(true);
    await searchLocations(query);
    debouncedSearch(query);
  };

  // Apply time filter
  const applyTimeFilter = async () => {
    if (startTime && endTime && !validateTimeSelection(startTime, endTime)) {
      return;
    }
    try {
      setLoading(true);
      if (currentLocation) {
        const spaces = await parkingService.getNearbySpaces(
          currentLocation.lat,
          currentLocation.lng,
          startTime ?? undefined,
          endTime ?? undefined,
          true
        );
        let spacesWithDecor = (spaces || []).map((s: any) => decorateSpace(s));
        let allowed = onlyApproved(spacesWithDecor);
        if (startTime && endTime) allowed = allowed.filter((s) => Number(s.availableSpots) > 0);
        setParkingSpaces(allowed);
      } else {
        const spaces = await parkingService.getAllSpaces(startTime ?? undefined, endTime ?? undefined, true);
        let spacesWithDecor = (spaces || []).map((s: any) => decorateSpace(s));
        let allowed = onlyApproved(spacesWithDecor);
        if (startTime && endTime) allowed = allowed.filter((s) => Number(s.availableSpots) > 0);
        setParkingSpaces(allowed);
      }
      toast.success('🎯 Time filter applied successfully!');
      setShowTimeFilter(false);
    } catch (err) {
      console.error('Failed to refresh parking for selected time window', err);
      toast.error('Unable to apply time filter.');
    } finally {
      setLoading(false);
    }
  };

  // Clear time filter
  const clearTimeFilter = async () => {
    setStartTime(null);
    setEndTime(null);
    try {
      setLoading(true);
      if (currentLocation) {
        const spaces = await parkingService.getNearbySpaces(currentLocation.lat, currentLocation.lng);
        const spacesWithDecor = (spaces || []).map((s: any) => decorateSpace(s));
        setParkingSpaces(onlyApproved(spacesWithDecor));
      } else {
        const spaces = await parkingService.getAllSpaces();
        const spacesWithDecor = (spaces || []).map((s: any) => decorateSpace(s));
        setParkingSpaces(onlyApproved(spacesWithDecor));
      }
      toast.info('🕒 Time filter cleared');
      setShowTimeFilter(false);
    } finally {
      setLoading(false);
    }
  };

  // ----- Sidebar drag logic -----
  const [sidebarPos, setSidebarPos] = useState({ top: 160, left: 16 });
  const draggingRef = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const sidebarRef = useRef<HTMLDivElement | null>(null);

  const onPointerDownSidebar = (e: React.PointerEvent) => {
    draggingRef.current = true;
    const rect = sidebarRef.current?.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    dragOffset.current = {
      x: startX - (rect?.left ?? 0),
      y: startY - (rect?.top ?? 0),
    };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMoveWindow = (e: PointerEvent) => {
    if (!draggingRef.current) return;
    const x = e.clientX - dragOffset.current.x;
    const y = e.clientY - dragOffset.current.y;
    const padding = 12;
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const sidebarW = sidebarRef.current?.offsetWidth ?? 384;
    const sidebarH = sidebarRef.current?.offsetHeight ?? 480;
    const left = Math.max(padding, Math.min(winW - sidebarW - padding, x));
    const top = Math.max(padding, Math.min(winH - sidebarH - padding, y));
    setSidebarPos({ left, top });
  };

  const onPointerUpWindow = () => {
    draggingRef.current = false;
  };

  useEffect(() => {
    window.addEventListener('pointermove', onPointerMoveWindow);
    window.addEventListener('pointerup', onPointerUpWindow);
    window.addEventListener('pointercancel', onPointerUpWindow);
    return () => {
      window.removeEventListener('pointermove', onPointerMoveWindow);
      window.removeEventListener('pointerup', onPointerUpWindow);
      window.removeEventListener('pointercancel', onPointerUpWindow);
    };
  }, []);

  // ----- Loading UI -----
  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 animate-gradient-x">
        <LoadingScreen />
      </div>
    );
  }

  // ----- Render -----
  return (
    <div className="h-[calc(100vh-64px)] relative bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 animate-gradient-x">
      {/* Top Search Bar - Fixed Compact Layout */}
      <div className="absolute top-4 left-4 right-4 z-20 animate-fade-in-down">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">

          {/* Search Input */}
          <div className="flex-1 w-full max-w-2xl">
            <div className="relative">
              <MdSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl z-10" />
              <input
                type="text"
                placeholder="Search for locations, areas, or landmarks..."
                value={searchQuery}
                onChange={(e) => handleSearchInputChange(e.target.value)}
                className="w-full pl-12 pr-12 py-4 bg-white/95 backdrop-blur-sm border border-white/20 rounded-2xl shadow-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/30 focus:border-transparent text-lg font-medium placeholder-gray-500 transition-all duration-500 hover:shadow-3xl"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setShowSearchResults(false);
                    setIsSearchFilterActive(false);
                    if (currentLocation) loadDefaultParkingMarkers(currentLocation.lat, currentLocation.lng);
                  }}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-all duration-300 hover:scale-110"
                >
                  <MdClose className="text-xl" />
                </button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden z-30 max-h-48 overflow-y-auto animate-fade-in-up">
                {searchResults.map((result, index) => (
                  <button
                    key={index}
                    onClick={() => handleLocationSelect(result)}
                    className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-all duration-300 border-b border-gray-100 last:border-b-0 flex items-center gap-3"
                  >
                    <MdLocationOn className="text-blue-500 text-xl flex-shrink-0" />
                    <div className="text-left">
                      <div className="font-medium text-gray-900 text-sm">{result.address.split(',')[0]}</div>
                      <div className="text-xs text-gray-500 truncate">{result.address.split(',').slice(1).join(',').trim()}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons Container */}
          <div className="flex gap-3 items-center">
            {/* Time Filter Button */}
            <button
              onClick={() => setShowTimeFilter(!showTimeFilter)}
              className="bg-white/95 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-500 hover:bg-white flex items-center gap-3 border border-white/20 transform hover:scale-105 group"
            >
              <div className="relative">
                <MdSchedule className="text-2xl text-blue-600 group-hover:scale-110 transition-transform duration-300" />
                {(startTime || endTime) && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                )}
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-700 text-sm">Time Filter</div>
                <div className="text-xs text-gray-500">
                  {startTime && endTime
                    ? `${formatDisplayTime(startTime)} - ${formatDisplayTime(endTime)}`
                    : 'Set time range'}
                </div>
              </div>
              {showTimeFilter ? <MdExpandLess className="text-gray-400" /> : <MdExpandMore className="text-gray-400" />}
            </button>

            {/* Filters Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="bg-white/95 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-500 hover:bg-white flex items-center gap-3 border border-white/20 transform hover:scale-105 group"
            >
              <div className="relative">
                <MdFilterList className="text-2xl text-purple-600 group-hover:scale-110 transition-transform duration-300" />
                {getActiveFilterCount() > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">
                    {getActiveFilterCount()}
                  </span>
                )}
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-700 text-sm">Filters</div>
                <div className="text-xs text-gray-500">{getActiveFilterCount()} active</div>
              </div>
              {showFilters ? <MdExpandLess className="text-gray-400" /> : <MdExpandMore className="text-gray-400" />}
            </button>

            {/* Parking List Button */}
            <button
              onClick={() => setShowParkingList(!showParkingList)}
              className="bg-white/95 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-500 hover:bg-white flex items-center gap-3 border border-white/20 transform hover:scale-105 group"
            >
              <div className="relative">
                <MdList className="text-2xl text-green-600 group-hover:scale-110 transition-transform duration-300" />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-green-600 to-teal-600 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">
                  {filteredSpaces.length}
                </span>
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-700 text-sm">Parking List</div>
                <div className="text-xs text-gray-500">{filteredSpaces.length} spaces</div>
              </div>
              {showParkingList ? <MdExpandLess className="text-gray-400" /> : <MdExpandMore className="text-gray-400" />}
            </button>
          </div>
        </div>
      </div>

      {/* Time Filter Modal - Centered on screen */}
      {showTimeFilter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-fade-in">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-white/20 shadow-2xl p-6 w/full max-w-md transition-all duration-500 animate-fade-in-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <MdSchedule className="text-blue-600 text-xl" />
                Select Parking Time
                {(startTime || endTime) && (
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium animate-pulse">
                    Active
                  </span>
                )}
              </h3>
              <button
                onClick={() => setShowTimeFilter(false)}
                className="text-gray-400 hover:text-gray-600 transition-all duration-300 hover:scale-110"
              >
                <MdClose className="text-xl" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Start Time */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <MdAccessTime className="text-blue-500" />
                  Start Time
                  {startTime && (
                    <span className="text-green-600 text-xs bg-green-50 px-2 py-1 rounded-lg animate-fade-in">
                      📅 {formatDisplayTime(startTime)}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    step="1800"
                    min={getCurrentDateTimeRounded()}
                    max={getMaxDateTime()}
                    value={startTime ?? ''}
                    onChange={(e) => {
                      const newStartTime = e.target.value;
                      setStartTime(newStartTime);
                      if (endTime && newStartTime && new Date(endTime) <= new Date(newStartTime)) {
                        setEndTime('');
                      }
                    }}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 bg-white"
                  />
                </div>
              </div>

              {/* End Time */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <MdAccessTime className="text-green-500" />
                  End Time
                  {endTime && (
                    <span className="text-green-600 text-xs bg-green-50 px-2 py-1 rounded-lg animate-fade-in">
                      🕒 {formatDisplayTime(endTime)}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    step="1800"
                    min={getMinEndTime()}
                    max={getMaxDateTime()}
                    value={endTime ?? ''}
                    onChange={(e) => setEndTime(e.target.value)}
                    className={`w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300 ${
                      !startTime ? 'bg-gray-100 cursor-not-allowed' : 'bg-white focus:border-green-500'
                    }`}
                    disabled={!startTime}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={applyTimeFilter}
                  disabled={startTime && endTime ? !validateTimeSelection(startTime, endTime) : true}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform hover:scale-105 shadow-lg hover:shadow-xl"
                >
                  <MdSchedule className="text-lg" />
                  Apply Time Filter
                </button>

                <button
                  onClick={clearTimeFilter}
                  className="px-6 py-3 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all duration-300 bg-white flex items-center justify-center gap-2 transform hover:scale-105"
                >
                  <MdClose className="text-lg" />
                  Clear
                </button>
              </div>

              {/* Info Text */}
              <div className="text-xs text-gray-500 text-center pt-3 border-t border-gray-100 bg-blue-50 rounded-lg p-3">
                <p className="font-medium mb-1">⏰ 24-hour format • 30-minute intervals</p>
                <p>Book parking slots in advance (up to 30 days)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div className="absolute top-32 right-4 z-10 w-72 bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-white/20 animate-fade-in-up">
          <div className="p-3 border-b border-gray-100">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-base">Filter Parking</h3>
              <button
                onClick={clearAllFilters}
                className="text-xs bg-gradient-to-r from-blue-600 to-purple-600 text-white px-2 py-1 rounded-md hover:opacity-90 transition-all duration-300 font-medium transform hover:scale-105"
              >
                Clear all
              </button>
            </div>
          </div>
          <div className="p-3 border-b border-gray-100">
            <h4 className="font-semibold text-gray-700 text-sm mb-2 flex items-center gap-2">
              <span>Price Range</span>
              <span className="text-xs bg-gradient-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text font-medium">
                {filters.isPriceFilterActive ? `₹${filters.priceRange[0]} - ₹${filters.priceRange[1]}/hr` : 'Any price'}
              </span>
            </h4>
            <div className="flex items-center justify-between mb-1 text-xs text-gray-600">
              <span>₹0</span>
              <span>₹1000</span>
            </div>
            <input
              type="range"
              min="0"
              max="1000"
              step="50"
              value={filters.priceRange[1]}
              onChange={(e) => handlePriceRangeChange(filters.priceRange[0], parseInt(e.target.value))}
              className="w-full slider-thumb"
            />
          </div>

          <div className="p-3">
            <h4 className="font-semibold text-gray-700 text-sm mb-2">Amenities</h4>
            <div className="space-y-1">
              {amenityFilters.map((amenity) => {
                const IconComponent = amenity.icon;
                const isActive = filters.amenities[amenity.id as keyof typeof filters.amenities];
                return (
                  <button
                    key={amenity.id}
                    onClick={() => handleFilterToggle(amenity.id)}
                    className={`w-full flex items-center gap-2 p-2 rounded-lg transition-all duration-300 transform hover:scale-[1.02] ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 shadow-md'
                        : 'bg-gray-50 border-transparent hover:bg-gray-100'
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-md transition-all duration-300 ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white transform scale-110'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      <IconComponent className="text-sm" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-gray-800 text-xs">{amenity.label}</div>
                      <div className="text-xs text-gray-500 truncate">{amenity.description}</div>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all duration-300 ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-500 to-purple-500 border-blue-500 transform scale-110'
                          : 'bg-white border-gray-300'
                      }`}
                    >
                      {isActive && <span className="text-white text-xs font-bold animate-scale-in">✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Current Location Button */}
      <div className="absolute top-20 right-4 z-30 animate-fade-in-down">
        <button
          onClick={handleGoToCurrentLocation}
          className="bg-white/95 backdrop-blur-sm p-4 rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-500 hover:bg-white border border-white/20 group transform hover:scale-110"
          title="Go to current location"
        >
          <MdGpsFixed className="text-2xl text-blue-600 group-hover:scale-110 transition-transform duration-300" />
        </button>
      </div>

      {/* Map */}
      <div className="relative h-full animate-fade-in">
        <Map
          {...viewport}
          onMove={(evt) => setViewport(evt.viewState)}
          mapboxAccessToken="pk.eyJ1IjoicGFya2Vhc2UxIiwiYSI6ImNtNGN1M3pmZzBkdWoya3M4OGFydjgzMzUifQ.wbsW51a7zFMq0yz0SeV6_A"
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
        >
          {/* Current Location Marker */}
          {currentLocation && (
            <ParkingMarker
              latitude={currentLocation.lat}
              longitude={currentLocation.lng}
              color="#3b82f6"
              isCurrentLocation={true}
              icon={FaMapMarkerAlt}
            />
          )}

          {/* Parking markers from filteredSpaces */}
          {filteredSpaces.map((space) => {
            const key =
              typeof (space as any)._id === 'object' && ((space as any)._id as any).toString
                ? ((space as any)._id as any).toString()
                : ((space as any)._id as string);
            return (
              <ParkingMarker
                key={key}
                space={space}
                latitude={(space as any).location.coordinates[1]}
                longitude={(space as any).location.coordinates[0]}
                onClick={() => handleMarkerClick(space)}
                onMouseEnter={() => handleMarkerHover(space)}
                onMouseLeave={debouncedClosePopup}
                color="#10b981"
                icon={FaParking}
              />
            );
          })}

          {/* Route visualization */}
          {routeSourceData && (
            <Source id="route" type="geojson" data={routeSourceData}>
              <Layer {...routeLayer} />
            </Source>
          )}

          {/* Searched location marker */}
          {searchedLocation && (
            <ParkingMarker
              latitude={searchedLocation.lat}
              longitude={searchedLocation.lng}
              color="#ef4444"
              icon={() => <MdLocationOn style={{ fontSize: '28px', color: '#ef4444' }} />}
              isCurrentLocation={false}
            />
          )}

          {/* Popup */}
          {selectedSpace && (
            <ParkingPopup
              space={selectedSpace}
              onClose={handleClosePopup}
              onMouseEnter={handlePopupMouseEnter}
              onMouseLeave={handlePopupMouseLeave}
              user={user ?? null}
              startTime={startTime}
              endTime={endTime}
            />
          )}
        </Map>
      </div>

      {/* Draggable Sidebar - Conditionally Rendered */}
      {showParkingList && (
        <div
          ref={sidebarRef}
          style={{ top: sidebarPos.top, left: sidebarPos.left, width: 384 }}
          className="absolute z-40 h-[480px] bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden border border-white/20 animate-fade-in-left"
        >
          <div
            onPointerDown={onPointerDownSidebar}
            className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white cursor-grab select-none transition-all duration-300 hover:shadow-lg"
            style={{ touchAction: 'none' }}
          >
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold mb-1">Find your perfect parking...</h2>
                <p className="text-blue-100 text-sm opacity-90">Drag this panel anywhere</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowParkingList(false)}
                  className="bg-white/10 px-3 py-1 rounded-lg text-sm hover:bg-white/20 transition-all duration-300 transform hover:scale-105"
                >
                  <MdClose className="text-lg" />
                </button>
                <button
                  onClick={() => setSidebarPos({ top: 80, left: 16 })}
                  className="bg-white/10 px-3 py-1 rounded-lg text-sm hover:bg-white/20 transition-all duration-300 transform hover:scale-105"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50">
            <div className="flex gap-3">
              <button
                onClick={handleSearchByCurrentLocation}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <MdMyLocation className="text-lg" />
                {/* <span>Near Me</span> */}
                <span>Show More</span>
              </button>
            </div>
          </div>

          <div className="h-full overflow-auto p-3">
            <ParkingSpaceList
              spaces={filteredSpaces}
              onSpaceSelect={(space) => handleMarkerClick(space)}
              filters={filters}
              userLocation={searchedLocation || currentLocation || { lat: 0, lng: 0 }}
              startTime={startTime}
              endTime={endTime}
            />
          </div>
        </div>
      )}

      {/* Custom CSS */}
      <style jsx>{`
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes fade-in-down {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in-left {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fade-in-right {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-in {
          from { transform: scale(0); }
          to { transform: scale(1); }
        }

        .animate-gradient-x {
          animation: gradient-x 15s ease infinite;
          background-size: 200% 200%;
        }
        .animate-fade-in-down { animation: fade-in-down 0.6s ease-out; }
        .animate-fade-in-up { animation: fade-in-up 0.6s ease-out; }
        .animate-fade-in-left { animation: fade-in-left 0.6s ease-out; }
        .animate-fade-in-right { animation: fade-in-right 0.6s ease-out; }
        .animate-fade-in { animation: fade-in 0.8s ease-out; }
        .animate-scale-in { animation: scale-in 0.2s ease-out; }

        .slider-thumb::-webkit-slider-thumb {
          appearance: none;
          height: 24px; width: 24px; border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          cursor: pointer; border: 3px solid #ffffff;
          box-shadow: 0 4px 15px rgba(59, 130, 246, 0.5);
          transition: all 0.3s ease;
        }
        .slider-thumb::-webkit-slider-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 20px rgba(59, 130, 246, 0.7);
        }
        .slider-thumb::-moz-range-thumb {
          height: 24px; width: 24px; border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          cursor: pointer; border: 3px solid #ffffff;
          box-shadow: 0 4px 15px rgba(59, 130, 246, 0.5);
          transition: all 0.3s ease;
        }
        .slider-thumb::-moz-range-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 20px rgba(59, 130, 246, 0.7);
        }
      `}</style>
    </div>
  );
}

// Debounce utility
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
