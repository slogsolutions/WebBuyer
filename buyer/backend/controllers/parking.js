// controllers/parking.js
import mongoose from 'mongoose';
import ParkingSpace from '../models/ParkingSpace.js';
import cloudinary from '../config/cloudinary.js';
import streamifier from 'streamifier';
import fs from 'fs';
import path from 'path';
import BookedSlot from '../models/BookedSlot.js';

/**
 * Helper to make accessible photo URL from multer file object or stored filename.
 */
function makePhotoUrlFromFile(req, file) {
  if (file.path) {
    if (typeof file.path === 'string' && (file.path.startsWith('/') || file.path.startsWith('http'))) {
      if (file.path.includes('/uploads/') && !file.path.startsWith('/mnt')) {
        return file.path.startsWith('http') ? file.path : `${req.protocol}://${req.get('host')}${file.path}`;
      }
    }
  }

  if (file.filename) {
    return `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
  }

  if (file.path) {
    const parts = file.path.split(/[\\/]/);
    const filename = parts[parts.length - 1];
    return `${req.protocol}://${req.get('host')}/uploads/${filename}`;
  }

  return null;
}

function makePhotoUrlFromString(req, photoStr) {
  if (!photoStr) return photoStr;
  if (photoStr.startsWith('http://') || photoStr.startsWith('https://')) return photoStr;
  if (photoStr.startsWith('/')) {
    return `${req.protocol}://${req.get('host')}${photoStr}`;
  }
  return `${req.protocol}://${req.get('host')}/uploads/${photoStr}`;
}

/**
 * Upload Buffer to Cloudinary
 */
function uploadBufferToCloudinary(buffer, originalName, folder) {
  return new Promise((resolve, reject) => {
    const opts = {
      folder: folder || process.env.CLOUDINARY_UPLOAD_FOLDER || 'aparkfinder/parking',
      public_id: originalName ? originalName.replace(/\.[^/.]+$/, '') + '-' + Date.now() : undefined,
      overwrite: false,
      resource_type: 'image',
      transformation: [{ quality: 'auto' }, { fetch_format: 'auto' }],
    };

    const uploadStream = cloudinary.uploader.upload_stream(opts, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

/**
 * Upload local file path to Cloudinary
 */
function uploadFilePathToCloudinary(filePath, originalName, folder) {
  return new Promise((resolve, reject) => {
    const opts = {
      folder: folder || process.env.CLOUDINARY_UPLOAD_FOLDER || 'aparkfinder/parking',
      public_id: originalName ? originalName.replace(/\.[^/.]+$/, '') + '-' + Date.now() : undefined,
      overwrite: false,
      resource_type: 'image',
      transformation: [{ quality: 'auto' }, { fetch_format: 'auto' }],
    };

    cloudinary.uploader.upload(filePath, opts, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
  });
}

// Register Parking Space
export const registerParkingSpace = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  try {
    const {
      title,
      description,
      location,
      address,
      pricePerHour,
      priceParking,
      availability,
      totalSpots,
      amenities,
      discount,
    } = req.body;

    // Parse address
    let addressParsed = address;
    if (typeof address === 'string') {
      try {
        addressParsed = JSON.parse(address);
      } catch (err) {
        return res.status(400).json({ message: '"address" is not valid JSON' });
      }
    }

    // Parse availability
    let availabilityParsed = availability;
    if (typeof availability === 'string') {
      try {
        availabilityParsed = JSON.parse(availability);
      } catch (err) {
        return res.status(400).json({ message: '"availability" is not valid JSON' });
      }
    }

    // Parse location
    let locationParsed = location;
    if (typeof location === 'string') {
      try {
        locationParsed = JSON.parse(location);
      } catch {}
    }

    let coords;
    if (locationParsed) {
      if (locationParsed.type === 'Point' && Array.isArray(locationParsed.coordinates)) {
        coords = locationParsed.coordinates.map(Number);
      } else if (Array.isArray(locationParsed) && locationParsed.length === 2) {
        coords = locationParsed.map(Number);
      } else if (locationParsed.lng !== undefined && locationParsed.lat !== undefined) {
        coords = [Number(locationParsed.lng), Number(locationParsed.lat)];
      } else if (locationParsed.longitude !== undefined && locationParsed.latitude !== undefined) {
        coords = [Number(locationParsed.longitude), Number(locationParsed.latitude)];
      }
    }

    if ((!coords || coords.some(Number.isNaN)) && req.body.lat !== undefined && req.body.lng !== undefined) {
      coords = [Number(req.body.lng), Number(req.body.lat)];
    }

    if (!coords || coords.length !== 2) {
      return res.status(400).json({ message: 'Invalid location coordinates' });
    }

    const [lonNum, latNum] = coords.map(v => Number(v));
    const valid =
      Number.isFinite(lonNum) && Number.isFinite(latNum) &&
      lonNum >= -180 && lonNum <= 180 &&
      latNum >= -90 && latNum <= 90;
    if (!valid) {
      return res.status(400).json({ message: 'Invalid location coordinates' });
    }

    // Process photos
    const photos = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        if (file.buffer) {
          try {
            const result = await uploadBufferToCloudinary(file.buffer, file.originalname, process.env.CLOUDINARY_UPLOAD_FOLDER);
            if (result?.secure_url) {
              photos.push(result.secure_url);
              continue;
            } else if (result?.url) {
              photos.push(result.url);
              continue;
            }
          } catch (err) {
            console.error('Cloudinary upload failed for', file.originalname, err);
          }
        }

        if (file.path) {
          try {
            const result = await uploadFilePathToCloudinary(file.path, file.originalname, process.env.CLOUDINARY_UPLOAD_FOLDER);
            if (result?.secure_url) {
              photos.push(result.secure_url);
              try { fs.unlinkSync(file.path); } catch {}
              continue;
            } else if (result?.url) {
              photos.push(result.url);
              try { fs.unlinkSync(file.path); } catch {}
              continue;
            }
          } catch (err) {
            console.error('Cloudinary upload from path failed:', err);
          }
        }

        const url = makePhotoUrlFromFile(req, file);
        if (url) photos.push(url);
        else if (file.filename) photos.push(`/uploads/${file.filename}`);
        else if (file.path) photos.push(file.path);
      }
    }

    // Parse amenities
    let amenitiesParsed = amenities;
    if (typeof amenities === 'string') {
      if (amenities.trim().startsWith('[')) {
        try { amenitiesParsed = JSON.parse(amenities); } catch { amenitiesParsed = []; }
      } else {
        amenitiesParsed = amenities.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    if (!Array.isArray(amenitiesParsed)) amenitiesParsed = [];

    // Parse discount
    let discountNum = 0;
    if (discount !== undefined && discount !== null) {
      discountNum = Number(discount);
      if (Number.isNaN(discountNum)) discountNum = 0;
      discountNum = Math.max(0, Math.min(100, discountNum));
    }

    const parkingSpace = new ParkingSpace({
      owner: req.user._id,
      title,
      description,
      location: { type: 'Point', coordinates: [lonNum, latNum] },
      address: addressParsed,
      pricePerHour,
      priceParking,
      totalSpots,
      availability: availabilityParsed,
      amenities: amenitiesParsed,
      photos,
      discount: discountNum,
    });

    await parkingSpace.save();

    const parkingObj = parkingSpace.toObject();
    if (Array.isArray(parkingObj.photos)) {
      parkingObj.photos = parkingObj.photos.map(p =>
        p?.startsWith('http') ? p : p?.startsWith('/') ? `${req.protocol}://${req.get('host')}${p}` : `${req.protocol}://${req.get('host')}/uploads/${p}`
      );
    }

    res.status(201).json({ message: 'Parking space registered successfully!', data: parkingObj });
  } catch (error) {
    console.error('Error registering parking space:', error.message);
    res.status(500).json({ message: 'Failed to register parking space', error: error.message });
  }
};

// Get Availability
export const getParkingSpaceAvailability = async (req, res) => {
  const { id: spaceId } = req.params;

  if (!req.user) return res.status(401).json({ message: 'User not authenticated' });

  try {
    const parkingSpace = await ParkingSpace.findById(spaceId);
    if (!parkingSpace || parkingSpace.isDeleted) {
      return res.status(404).json({ message: 'Parking space not found' });
    }

    const availability = (parkingSpace.availability || [])
      .flatMap(avail => (avail.slots || []).map(slot => ({
        startTime: slot.startTime?.toISOString() || null,
        endTime: slot.endTime?.toISOString() || null,
        isBooked: !!slot.isBooked,
      })));

    res.status(200).json({ availability });
  } catch (error) {
    console.error('Error fetching availability:', error.message);
    res.status(500).json({ message: 'Failed to fetch availability', error: error.message });
  }
};

// Update Parking Space
export const updateParkingSpace = async (req, res) => {
  try {
    const parkingSpace = await ParkingSpace.findById(req.params.id);
    if (!parkingSpace) return res.status(404).json({ message: 'Parking space not found' });
    if (parkingSpace.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (req.files && req.files.length > 0) {
      const newPhotos = [];
      for (const file of req.files) {
        if (file.buffer) {
          try {
            const result = await uploadBufferToCloudinary(file.buffer, file.originalname);
            if (result?.secure_url) newPhotos.push(result.secure_url);
            else if (result?.url) newPhotos.push(result.url);
          } catch (err) { console.error('Upload failed:', err); }
        }

        if (file.path) {
          try {
            const result = await uploadFilePathToCloudinary(file.path, file.originalname);
            if (result?.secure_url) {
              newPhotos.push(result.secure_url);
              try { fs.unlinkSync(file.path); } catch {}
            } else if (result?.url) {
              newPhotos.push(result.url);
              try { fs.unlinkSync(file.path); } catch {}
            }
          } catch (err) { console.error('Path upload failed:', err); }
        }

        const url = makePhotoUrlFromFile(req, file);
        if (url) newPhotos.push(url);
        else if (file.filename) newPhotos.push(`/uploads/${file.filename}`);
      }

      const existing = Array.isArray(parkingSpace.photos) ? parkingSpace.photos : [];
      req.body.photos = [...existing, ...newPhotos];
    }

    const updatedSpace = await ParkingSpace.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );

    const updatedObj = updatedSpace.toObject();
    if (Array.isArray(updatedObj.photos)) {
      updatedObj.photos = updatedObj.photos.map(p =>
        p?.startsWith('http') ? p : p?.startsWith('/') ? `${req.protocol}://${req.get('host')}${p}` : `${req.protocol}://${req.get('host')}/uploads/${p}`
      );
    }

    res.json(updatedObj);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update parking space' });
  }
};

// Set Online Status
export const setOnlineStatus = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Not authorized, user missing' });

    const { isOnline } = req.body;
    if (typeof isOnline !== 'boolean') {
      return res.status(400).json({ message: 'isOnline must be boolean' });
    }

    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid parking space id' });
    }

    const parkingSpace = await ParkingSpace.findById(id);
    if (!parkingSpace || parkingSpace.isDeleted) {
      return res.status(404).json({ message: 'Parking space not found' });
    }

    if (parkingSpace.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    parkingSpace.isOnline = isOnline;
    await parkingSpace.save();

    const psObj = parkingSpace.toObject();
    if (Array.isArray(psObj.photos)) {
      psObj.photos = psObj.photos.map(p =>
        p?.startsWith('http') ? p : p?.startsWith('/') ? `${req.protocol}://${req.get('host')}${p}` : `${req.protocol}://${req.get('host')}/uploads/${p}`
      );
    }

    return res.json({ message: 'Status updated', parkingSpace: psObj });
  } catch (error) {
    console.error('Error setting online status', error);
    return res.status(500).json({ message: 'Failed to set online status' });
  }
};

// Delete Parking Space (Soft Delete)
export const deleteParkingSpace = async (req, res) => {
  try {
    const parkingSpace = await ParkingSpace.findById(req.params.id);
    if (!parkingSpace) return res.status(404).json({ message: 'Parking space not found' });
    if (parkingSpace.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    parkingSpace.isDeleted = true;
    parkingSpace.deletedAt = new Date();
    await parkingSpace.save();

    res.json({ message: 'Parking space removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to delete parking space' });
  }
};

// Get All Parking Spaces (with optional geo + time filter)
export const getParkingSpaces = async (req, res) => {
  try {
    const { lat, lng, radius, startTime, endTime, onlyAvailable } = req.query;

    const query = { isDeleted: { $ne: true } };

    if (lat && lng) {
      const maxDistance = radius ? parseInt(radius, 10) : 5000;
      query.location = {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: maxDistance,
        },
      };
    }

    const parkings = await ParkingSpace.find(query).populate('owner', 'name').lean();

    let parsedStart = null, parsedEnd = null;
    if (startTime && endTime) {
      parsedStart = new Date(startTime);
      parsedEnd = new Date(endTime);
      if (isNaN(parsedStart) || isNaN(parsedEnd) || parsedEnd <= parsedStart) {
        return res.status(400).json({ message: 'Invalid startTime or endTime' });
      }
    }

    const results = await Promise.all(
      parkings.map(async (p) => {
        const out = { ...p };
        const totalSpots = Number(p.totalSpots ?? p.total_spots ?? p.slots ?? p.capacity ?? 0) || 0;
        out.totalSpots = totalSpots;

        if (parsedStart && parsedEnd) {
          const overlapQuery = {
            parkingSpace: p._id,
            startTime: { $lt: parsedEnd },
            endTime: { $gt: parsedStart },
          };
          const overlappingCount = await BookedSlot.countDocuments(overlapQuery);
          out.availableSpots = Math.max(0, totalSpots - overlappingCount);
        } else {
          out.availableSpots = Number(p.availableSpots ?? totalSpots);
        }

        if (Array.isArray(out.photos)) {
          out.photos = out.photos.map(ph =>
            typeof ph === 'string'
              ? ph.startsWith('http') ? ph : ph.startsWith('/') ? `${req.protocol}://${req.get('host')}${ph}` : `${req.protocol}://${req.get('host')}/uploads/${ph}`
              : ph
          );
        }

        return out;
      })
    );

    let filtered = results;
    if (parsedStart && parsedEnd && onlyAvailable === 'true') {
      filtered = results.filter(r => r.availableSpots > 0);
    }

    filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    res.json(filtered);
  } catch (err) {
    console.error('[getParkingSpaces] error:', err);
    res.status(500).json({ message: 'Failed to fetch parking spaces', error: err.message });
  }
};

// Get Single Parking Space
export const getParkingSpaceById = async (req, res) => {
  try {
    const parkingSpace = await ParkingSpace.findById(req.params.id).populate('owner', 'name');
    if (!parkingSpace || parkingSpace.isDeleted) {
      return res.status(404).json({ message: 'Parking space not found' });
    }

    const obj = parkingSpace.toObject();
    if (Array.isArray(obj.photos)) {
      obj.photos = obj.photos.map(p =>
        p?.startsWith('http') ? p : p?.startsWith('/') ? `${req.protocol}://${req.get('host')}${p}` : `${req.protocol}://${req.get('host')}/uploads/${p}`
      );
    }

    res.json(obj);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get parking space' });
  }
};

// Get My Parking Spaces
export const getMyParkingSpaces = async (req, res) => {
  try {
    const parkingSpaces = await ParkingSpace.find({
      owner: req.user._id,
      isDeleted: { $ne: true }
    }).sort('-createdAt');

    const normalized = parkingSpaces.map(ps => {
      const obj = ps.toObject();
      if (Array.isArray(obj.photos)) {
        obj.photos = obj.photos.map(p =>
          p?.startsWith('http') ? p : p?.startsWith('/') ? `${req.protocol}://${req.get('host')}${p}` : `${req.protocol}://${req.get('host')}/uploads/${p}`
        );
      }
      return obj;
    });

    res.json(normalized);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get your parking spaces' });
  }
};