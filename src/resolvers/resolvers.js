const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { UserInputError, AuthenticationError, ForbiddenError } = require('apollo-server-express');
const User = require('../models/User');
const TravelPackage = require('../models/TravelPackage');
const Booking = require('../models/Booking');
const { PubSub } = require('graphql-subscriptions');

const pubsub = new PubSub();

// Helper function for generating JWT token
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Validation functions
const validateRegisterInput = (username, email, password, confirmPassword) => {
  const errors = {};
  
  if (username.trim() === '') errors.username = 'Username must not be empty';
  
  if (email.trim() === '') {
    errors.email = 'Email must not be empty';
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) errors.email = 'Email must be a valid email address';
  }
  
  if (password === '') {
    errors.password = 'Password must not be empty';
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords must match';
  }

  return {
    errors,
    valid: Object.keys(errors).length < 1,
  };
};

const validateLoginInput = (username, password) => {
  const errors = {};
  if (username.trim() === '') errors.username = 'Username must not be empty';
  if (password.trim() === '') errors.password = 'Password must not be empty';

  return {
    errors,
    valid: Object.keys(errors).length < 1,
  };
};

const validateUserId = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new UserInputError('User not found');
  return user;
};

const validatePackageId = async (packageId) => {
  const travelPackage = await TravelPackage.findById(packageId);
  if (!travelPackage) throw new UserInputError('Travel package not found');
  return travelPackage;
};

const validateUpdateProfileInput = (updateInput) => {
  const errors = {};
  
  if (updateInput.email) {
    if (updateInput.email.trim() === '') {
      errors.email = 'Email must not be empty';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updateInput.email)) errors.email = 'Email must be a valid email address';
    }
  }

  if (updateInput.password && updateInput.password !== updateInput.confirmPassword) {
    errors.confirmPassword = 'Passwords must match';
  }

  return {
    errors,
    valid: Object.keys(errors).length < 1,
  };
};

// Resolvers
const resolvers = {
  Query: {
    getAllPackages: async () => {
      try {
        const packages = await TravelPackage.find().sort({ createdAt: -1 });
        return packages;
      } catch (err) {
        throw new Error('Error fetching travel packages');
      }
    },
    getPackages: async (_, { search, filter }) => {
      const query = {};

      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { destination: { $regex: search, $options: 'i' } },
        ];
      }

      if (filter) {
        if (filter.minPrice) query.price = { ...query.price, $gte: filter.minPrice };
        if (filter.maxPrice) query.price = { ...query.price, $lte: filter.maxPrice };
        if (filter.category) query.category = { $regex: filter.category, $options: 'i' };
        if (filter.availability) query.availability = { $gte: filter.availability };
      }

      return await TravelPackage.find(query);
    },
    getUserProfile: async (_, { userId }) => {
      return validateUserId(userId);
    },
    getBookings: async (_, { userId }) => {
      try {
        if (!userId) throw new Error('User ID is required');

        const bookings = await Booking.find({ userId })
          .populate('packageId')
          .lean()
          .exec();

        return bookings.map(booking => {
          // Handle case where packageId might be null
          if (!booking.packageId) {
            return {
              ...booking,
              id: booking._id.toString(),
              userId: booking.userId.toString(),
              packageId: {
                id: 'deleted',
                title: 'Package Deleted',
                description: 'This package is no longer available',
                price: 0,
                duration: 'N/A',
                destination: 'N/A',
                category: 'N/A',
                availability: 0,
                createdAt: new Date().toISOString()
              },
              date: booking.date,
              status: 'CANCELLED',
              createdAt: booking.createdAt
            };
          }

          // Return normal booking with valid packageId
          return {
            ...booking,
            id: booking._id.toString(),
            userId: booking.userId.toString(),
            packageId: {
              id: booking.packageId._id.toString(),
              title: booking.packageId.title,
              description: booking.packageId.description,
              price: booking.packageId.price,
              duration: booking.packageId.duration,
              destination: booking.packageId.destination,
              category: booking.packageId.category,
              availability: booking.packageId.availability,
              createdAt: booking.packageId.createdAt
            }
          };
        });
      } catch (error) {
        console.error('Error in getBookings:', error);
        throw new Error('Failed to fetch bookings: ' + error.message);
      }
    },
    getPackageById: async (_, { id }) => {
      try {
        const package = await TravelPackage.findById(id);
        if (!package) throw new UserInputError('Package not found');

        return {
          id: package._id.toString(),
          title: package.title,
          description: package.description,
          price: package.price,
          duration: package.duration,
          destination: package.destination,
          category: package.category,
          availability: package.availability,
          createdAt: package.createdAt,
        };
      } catch (error) {
        throw new Error('Error fetching package: ' + error.message);
      }
    },
    getAllUsers: async () => {
      try {
        return await User.find().sort({ createdAt: -1 }).select('-password');
      } catch (err) {
        throw new Error('Error fetching users');
      }
    },
    getAllBookings: async () => {
      try {
        const bookings = await Booking.find()
          .populate('packageId')
          .populate('userId')
          .lean();

        return bookings.map(booking => {
          // Handle case where packageId might be null
          if (!booking.packageId) {
            return {
              ...booking,
              id: booking._id.toString(),
              userId: booking.userId?._id.toString(),
              packageId: {
                id: 'deleted',
                title: 'Package Deleted',
                description: 'This package no longer exists',
                price: 0,
                duration: 'N/A',
                destination: 'N/A',
                category: 'N/A',
                availability: 0,
                createdAt: new Date().toISOString()
              },
              date: booking.date,
              status: 'CANCELLED',
              createdAt: booking.createdAt
            };
          }

          return {
            ...booking,
            id: booking._id.toString(),
            userId: booking.userId?._id.toString(),
            packageId: {
              ...booking.packageId,
              id: booking.packageId._id.toString()
            }
          };
        });
      } catch (err) {
        throw new Error('Error fetching bookings: ' + err.message);
      }
    },
  },
  Mutation: {
    login: async (_, { username, password }) => {
      const { errors, valid } = validateLoginInput(username, password);
      if (!valid) throw new UserInputError('Errors', { errors });

      const user = await User.findOne({ username });
      if (!user) {
        errors.general = 'User not found';
        throw new UserInputError('User not found', { errors });
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        errors.general = 'Wrong credentials';
        throw new UserInputError('Wrong credentials', { errors });
      }

      const token = generateToken(user);

      return { ...user._doc, id: user._id, token };
    },
    register: async (_, { registerInput: { username, email, password, confirmPassword } }) => {
      const { valid, errors } = validateRegisterInput(username, email, password, confirmPassword);
      if (!valid) throw new UserInputError('Errors', { errors });

      const existingUser = await User.findOne({ $or: [{ username }, { email }] });
      if (existingUser) throw new UserInputError('Username or email is taken', { errors: { username: 'This username or email is already taken' } });

      const hashedPassword = await bcrypt.hash(password, 12);

      const newUser = new User({ email, username, password: hashedPassword, createdAt: new Date().toISOString() });
      const res = await newUser.save();
      const token = generateToken(res);

      return { ...res._doc, id: res._id, token };
    },
    createBooking: async (_, { packageId, userId, date }) => {
      const user = await validateUserId(userId);
      const travelPackage = await validatePackageId(packageId);

      if (travelPackage.availability <= 0) throw new UserInputError('Package is not available');

      const newBooking = new Booking({
        packageId,
        userId,
        date,
        status: 'CONFIRMED',
        createdAt: new Date().toISOString(),
      });

      const booking = await newBooking.save();
      await TravelPackage.findByIdAndUpdate(packageId, { $inc: { availability: -1 } });

      const populatedBooking = await Booking.findById(booking._id).populate('packageId').lean();
      const transformedBooking = {
        id: populatedBooking._id.toString(),
        userId: populatedBooking.userId.toString(),
        packageId: {
          id: populatedBooking.packageId._id.toString(),
          title: populatedBooking.packageId.title,
          description: populatedBooking.packageId.description,
          price: populatedBooking.packageId.price,
          duration: populatedBooking.packageId.duration,
          destination: populatedBooking.packageId.destination,
          category: populatedBooking.packageId.category,
          availability: populatedBooking.packageId.availability,
          createdAt: populatedBooking.packageId.createdAt,
        },
        date: populatedBooking.date,
        status: populatedBooking.status,
        createdAt: populatedBooking.createdAt,
      };

      pubsub.publish('BOOKING_CREATED', { bookingCreated: transformedBooking });

      return transformedBooking;
    },
    cancelBooking: async (_, { bookingId, userId }) => {
      try {
        const booking = await Booking.findOneAndUpdate(
          { _id: bookingId, userId },
          { status: 'CANCELLED' },
          { new: true }
        ).populate('packageId');

        if (!booking) {
          throw new UserInputError('Booking not found');
        }

        // Increment the availability of the package
        await TravelPackage.findByIdAndUpdate(
          booking.packageId._id,
          { $inc: { availability: 1 } }
        );

        // Transform the booking object to match the expected type
        return {
          id: booking._id.toString(),
          userId: booking.userId.toString(),
          packageId: {
            id: booking.packageId._id.toString(),
            title: booking.packageId.title,
            description: booking.packageId.description,
            price: booking.packageId.price,
            duration: booking.packageId.duration,
            destination: booking.packageId.destination,
            category: booking.packageId.category,
            availability: booking.packageId.availability,
            createdAt: booking.packageId.createdAt
          },
          date: booking.date,
          status: booking.status,
          createdAt: booking.createdAt
        };
      } catch (error) {
        throw new Error('Error cancelling booking: ' + error.message);
      }
    },
    deleteTravelPackage: async (_, { packageId }, context) => {
      try {
        // Log the context and headers for debugging
        console.log('Context:', context);
        
        // Check admin status
        if (!context.isAdmin) {
          console.log('Admin check failed:', context.isAdmin);
          throw new Error('Unauthorized: Only admins can delete travel packages');
        }

        const travelPackage = await TravelPackage.findById(packageId);
        if (!travelPackage) {
          throw new Error('Travel package not found');
        }

        await TravelPackage.findByIdAndDelete(packageId);

        return {
          id: travelPackage._id.toString(),
          success: true,
          message: 'Travel package deleted successfully'
        };
      } catch (error) {
        console.error('Delete error:', error);
        throw new Error(error.message);
      }
    },
    removeUser: async (_, { userId }, context) => {
      try {
        // Check admin privileges
        if (!context.isAdmin) {
          throw new ForbiddenError('Unauthorized: Only admins can remove users');
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
          throw new UserInputError('User not found');
        }

        // Remove user
        await User.findByIdAndDelete(userId);

        return {
          id: userId,
          message: 'User removed successfully',
        };
      } catch (error) {
        throw new Error('Error removing user: ' + error.message);
      }
    },
    addTravelPackage: async (_, { 
      title, 
      description, 
      price, 
      duration, 
      destination, 
      category, 
      availability
    }) => {
      try {
        const newPackage = new TravelPackage({
          title,
          description,
          price,
          duration,
          destination,
          category,
          availability,
          createdAt: new Date().toISOString()
        });

        const res = await newPackage.save();
        return {
          ...res._doc,
          id: res._id.toString()
        };
      } catch (err) {
        throw new Error('Error creating travel package: ' + err.message);
      }
    },
    editTravelPackage: async (_, { packageId, ...updateFields }, context) => {
      try {
        // Check admin privileges
        if (!context.isAdmin) {
          throw new ForbiddenError('Unauthorized: Only admins can edit travel packages');
        }
    
        // Find the travel package
        const travelPackage = await TravelPackage.findById(packageId);
        if (!travelPackage) {
          throw new UserInputError('Travel package not found');
        }
    
        // Update the fields
        Object.keys(updateFields).forEach((key) => {
          travelPackage[key] = updateFields[key];
        });
    
        const updatedPackage = await travelPackage.save();
    
        return updatedPackage;
      } catch (error) {
        throw new Error('Error editing package: ' + error.message);
      }
    },
    updateUserProfile: async (_, { userId, updateInput }, context) => {
      try {
        // First check if user exists
        const existingUser = await User.findById(userId);
        if (!existingUser) {
          throw new UserInputError('User not found');
        }

        // Validate the input if email is being updated
        if (updateInput.email) {
          const { valid, errors } = validateUpdateProfileInput(updateInput);
          if (!valid) {
            throw new UserInputError('Errors', { errors });
          }
        }

        // Remove confirmPassword from updateInput if it exists
        const { confirmPassword, password, ...updateData } = updateInput;

        // If password is being updated, hash it
        if (password) {
          if (password !== confirmPassword) {
            throw new UserInputError('Passwords must match');
          }
          updateData.password = await bcrypt.hash(password, 12);
        }

        // Update the user with new data
        const updatedUser = await User.findByIdAndUpdate(
          userId,
          { $set: updateData },
          { new: true, runValidators: true }
        );

        // Generate new token if email or username was updated
        let token = null;
        if (updateInput.email || updateInput.username) {
          token = generateToken(updatedUser);
        }

        return {
          ...updatedUser._doc,
          id: updatedUser._id,
          token
        };
      } catch (error) {
        throw new Error('Error updating user profile: ' + error.message);
      }
    },
  },
};

module.exports = resolvers;
