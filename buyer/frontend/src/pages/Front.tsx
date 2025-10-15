import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, X, Car, Building, Star, Clock, Shield, Zap, Navigation, Map } from 'lucide-react';
import { searchLocation, GeocodingResult } from '../utils/geocoding';
import { motion, AnimatePresence } from 'framer-motion';

import ImageSlider from './ImageSlider';
import image1 from '../assest/1.jpg';
import image7 from '../assest/2.jpg';
import image2 from '../assest/3.jpg';
import image3 from '../assest/4.jpg';
import image4 from '../assest/5.jpg';
import image5 from '../assest/6.jpg';
import image6 from '../assest/8.png';
import image8 from '../assest/7.jpg';
import image9 from '../assest/8.jpg';
import image10 from '../assest/9.jpg';
import { useMapContext } from '../context/MapContext';
import { ParkingSpace } from '../types/parking';
import { parkingService } from '../services/parking.service';
import { toast } from 'react-toastify';
import { SearchBar,AnimatedSearchBar } from './SearchBar';
import { SearchOverlay } from './SearchOverlayProps';
import { useNavigate } from 'react-router-dom';

interface LocationSearchBoxProps {
  onLocationSelect?: (location: GeocodingResult) => void;
  onProceed?: () => void;
}

interface ParkingArea {
  id: string;
  imageUrl: string;
  title?: string;
  description?: string;
}

const popularAreas: ParkingArea[] = [
  {
    id: '1',
    imageUrl: `${image1}`,
    title: 'Downtown Premium',
    description: '24/7 Secure Parking',
  },
  {
    id: '2',
    imageUrl: `${image7}`,
    title: 'Business District',
    description: 'Covered & Monitored',
  },
  {
    id: '3',
    imageUrl: `${image2}`,
    title: 'EV Charging',
    description: 'Spacious & Safe',
  },
  {
    id: '4',
    imageUrl: `${image4}`,
    title: 'Residential Zone',
    description: 'Peaceful & Secure',
  },
  {
    id: '5',
    imageUrl: `${image3}`,
    title: 'Covered Parking',
    description: 'Ample Space Available',
  },
  {
    id: '6',
    imageUrl: `${image9}`, 
    title: 'Premium Parking',
    description: 'Long-term Security',
  }
];

const featuredImages = [
  { 
    url: `${image5}`,
    title: 'Valet Parking',
    subtitle: 'Assisted Parking'
  },
  { 
    url: `${image6}`,
    title: '24/7 Security',
    subtitle: 'Always Protected'
  },
  { 
    url: `${image8}`,
    title: 'Easy Booking',
    subtitle: 'Instant Reservation'
  },
  { 
    url: `${image10}`,
    title: 'Prime Locations',
    subtitle: 'Best Spots in City'
  },
];

// Floating animation component
const FloatingElement = ({ children, delay = 0, yOffset = 20 }: { children: React.ReactNode; delay?: number; yOffset?: number }) => (
  <motion.div
    initial={{ y: yOffset, opacity: 0, scale: 0.95 }}
    animate={{ y: 0, opacity: 1, scale: 1 }}
    transition={{ 
      duration: 0.6, 
      delay,
      type: "spring",
      stiffness: 100
    }}
    whileHover={{ 
      y: -5,
      transition: { type: "spring", stiffness: 400 }
    }}
  >
    {children}
  </motion.div>
);

// Animated background particles
const BackgroundParticles = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(20)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-2 h-2 bg-red-200 rounded-full"
        initial={{
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
        }}
        animate={{
          y: [0, -30, 0],
          opacity: [0.3, 0.7, 0.3],
        }}
        transition={{
          duration: 3 + Math.random() * 2,
          repeat: Infinity,
          delay: Math.random() * 2,
        }}
      />
    ))}
  </div>
);

const Front: React.FC<LocationSearchBoxProps> = ({ onLocationSelect, onProceed }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedParking, setSelectedParking] = useState<any | null>(null);
  const { viewport, setViewport } = useMapContext();
  const [parkingSpaces, setParkingSpaces] = useState<ParkingSpace[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const navigate = useNavigate();

  // Auto-rotate featured images
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveImage((prev) => (prev + 1) % featuredImages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const fetchNearbyParkingSpaces = async (lat: number, lng: number) => {
    try {
      const spaces = await parkingService.getNearbySpaces(lat, lng);
      setParkingSpaces(spaces);
    } catch (error) {
      toast.error('Failed to fetch parking spaces.');
    }
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setViewport({ ...viewport, latitude, longitude });
          setCurrentLocation({ lat: latitude, lng: longitude });
          fetchNearbyParkingSpaces(latitude, longitude);
        },
        (error) => {
          console.error('Location error:', error);
          toast.error('Could not get your location. Please enable location services.');
        }
      );
    }
  }, []);

  useEffect(() => {
    const loadInitialAreas = async () => {
      const locations = await searchLocation('');
      setResults(locations.slice(0, 3));
    };
    loadInitialAreas();
  }, []);

  const handleLocationSelect = async (result: GeocodingResult) => {
    setViewport({ ...viewport, longitude: result.longitude, latitude: result.latitude });

    try {
      const spaces = await parkingService.getNearbySpaces(result.latitude, result.longitude);
      setParkingSpaces(spaces);
      if (spaces.length === 0) {
        toast.info('No nearby parking spaces available at the selected location.');
      }
    } catch (error) {
      toast.error('Failed to fetch parking spaces for the selected location.');
    }

    onLocationSelect?.(result);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-red-50 relative overflow-hidden">
      {/* Animated Background */}
      <BackgroundParticles />
      
      {/* Animated gradient orbs */}
      <motion.div
        className="absolute top-1/4 -left-20 w-72 h-72 bg-gradient-to-r from-red-200 to-pink-200 rounded-full blur-3xl opacity-40"
        animate={{
          x: [0, 100, 0],
          y: [0, -50, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      <motion.div
        className="absolute bottom-1/4 -right-20 w-72 h-72 bg-gradient-to-r from-blue-200 to-cyan-200 rounded-full blur-3xl opacity-30"
        animate={{
          x: [0, -100, 0],
          y: [0, 50, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Main Content - Header removed as requested */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12 mt-8"
        >
          
        

          {/* Enhanced Search Bar */}
          {/* --- place full-width SearchBar outside the centered container so it can stretch --- */}


{/* Hero Section */}
<motion.div
  initial={{ opacity: 0, y: 30 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.8 }}
  className="text-center mb-16 mt-12"
>
  {/* New Clean Animated Search Bar */}
  <AnimatedSearchBar
    onOpen={() => {
      setIsSearchOpen(true);
      onProceed?.();
    }}
  />
</motion.div>


        </motion.div>

        {/* Popular Areas Grid with Enhanced Animations */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mb-12"
        >
          

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {popularAreas.map((area, index) => (
              <FloatingElement key={area.id} delay={index * 0.1}>
                <motion.div
                  className="group relative bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden border border-white/20 cursor-pointer"
                  whileHover={{ 
                    scale: 1.05,
                    transition: { type: "spring", stiffness: 300 }
                  }}
                >
                  <div className="relative overflow-hidden rounded-2xl">
                    <motion.img
                      src={area.imageUrl}
                      alt={area.title}
                      className="w-full h-32 sm:h-40 object-cover"
                      whileHover={{ scale: 1.1 }}
                      transition={{ duration: 0.5 }}
                    />
                    
                    {/* Overlay with text */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    <div className="absolute bottom-0 left-0 right-0 p-3 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                      <motion.h3 
                        className="text-white font-bold text-sm mb-1"
                        initial={{ opacity: 0, y: 10 }}
                        whileHover={{ opacity: 1, y: 0 }}
                      >
                        {area.title}
                      </motion.h3>
                      <motion.p 
                        className="text-red-200 text-xs"
                        initial={{ opacity: 0, y: 10 }}
                        whileHover={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                      >
                        {area.description}
                      </motion.p>
                    </div>

                    {/* Rating and Price Badges */}
                    {/* <div className="absolute top-2 left-2 flex items-center space-x-1 bg-black/50 rounded-full px-2 py-1">
                      <Star className="w-3 h-3 text-yellow-400 fill-current" />
                      <span className="text-white text-xs font-medium">{area.rating}</span>
                    </div>
                    
                    <div className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold rounded-full px-2 py-1">
                      {area.price}
                    </div>

                    {/* Distance Badge */}
                    {/* <div className="absolute bottom-2 right-2 bg-white/90 text-gray-900 text-xs rounded-full px-2 py-1 font-medium">
                      {area.distance}
                    </div>  */}
                  </div>
                </motion.div>
              </FloatingElement>
            ))}
          </div>
        </motion.div>

        {/* Enhanced Featured Image Slider */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="max-w-4xl mx-auto"
        >
          <motion.h3 
            className="text-2xl font-bold text-center text-gray-900 mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
          >
            Why Choose Us?
          </motion.h3>

          <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/20">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeImage}
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.8 }}
                className="relative h-64 sm:h-80"
              >
                <img
                  src={featuredImages[activeImage].url}
                  alt={featuredImages[activeImage].title}
                  className="w-full h-full object-cover"
                />
                
                {/* Text Overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent flex items-center">
                  <div className="p-8 text-white max-w-md">
                    <motion.h4 
                      className="text-2xl font-bold mb-2"
                      initial={{ opacity: 0, x: -50 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      {featuredImages[activeImage].title}
                    </motion.h4>
                    <motion.p
                      className="text-lg text-red-200"
                      initial={{ opacity: 0, x: -50 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 }}
                    >
                      {featuredImages[activeImage].subtitle}
                    </motion.p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation Dots */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
              {featuredImages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveImage(index)}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index === activeImage ? 'bg-red-600 scale-125' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
          </div>
        </motion.div>

        {/* Enhanced Quick Stats with 2 additional features */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.4 }}
          className="grid grid-cols-2 sm:grid-cols-6 gap-4 max-w-4xl mx-auto mt-12"
        >
          {[
            { icon: <Car className="w-6 h-6" />, value: '10K+', label: 'Spaces' },
            { icon: <Map className="w-6 h-6" />, value: '50+', label: 'Cities' },
            { icon: <Star className="w-6 h-6" />, value: '4.8', label: 'Rating' },
            { icon: <Shield className="w-6 h-6" />, value: '24/7', label: 'Security' },
            { icon: <Zap className="w-6 h-6" />, value: '500+', label: 'EV Charging' },
            { icon: <Clock className="w-6 h-6" />, value: 'Instant', label: 'Booking' },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              className="text-center p-4 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20"
              whileHover={{ scale: 1.05, y: -5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <motion.div
                className="text-red-600 mb-2 flex justify-center"
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.5 }}
              >
                {stat.icon}
              </motion.div>
              <div className="text-xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-xs text-gray-600">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Search Overlay */}
      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />

      {/* Search Results */}
      <AnimatePresence>
        {results.length > 0 && query.length > 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute z-50 left-4 right-4 sm:left-auto sm:right-auto sm:w-full max-w-2xl bg-white/95 backdrop-blur-md rounded-xl shadow-2xl max-h-64 overflow-y-auto border border-white/20"
          >
            {results.map((result: any) => (
              <motion.button
                key={result.id}
                onClick={() => handleLocationSelect(result)}
                className="w-full px-4 py-3 text-left hover:bg-red-50 flex items-center gap-3 border-b border-gray-100 last:border-b-0"
                whileHover={{ x: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <MapPin className="w-5 h-5 text-red-600 flex-shrink-0" />
                <div>
                  <div className="font-medium text-gray-900">{result.placeName}</div>
                  <div className="text-sm text-gray-500">{result.area}</div>
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Front;