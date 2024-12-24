const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  UserInputError,
  AuthenticationError,
  ForbiddenError,
} = require("apollo-server-express");
const User = require("../models/User");
const TravelPackage = require("../models/TravelPackage");
const Booking = require("../models/Booking");
const { PubSub } = require("graphql-subscriptions");
const Wishlist = require("../models/Wishlist");
const axios = require("axios");

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
    { expiresIn: "7d" }
  );
};
// Helper function to fetch currency rates
async function fetchCurrencyRates() {
  try {
    const response = await axios.get(
      "http://v6.exchangerate-api.com/v6/e956fd5a9e148110ef181fad/latest/USD"
    );
    // console.log("Currency API response:", response.data); // Log the response for debugging
    if (response.data && response.data.conversion_rates) {
      return response.data.conversion_rates;
    } else {
      throw new Error("Invalid response structure");
    }
  } catch (error) {
    console.error("Error fetching currency rates:", error);
    throw new Error("Failed to fetch currency rates");
  }
}

// Helper function to convert currency
function convertCurrency(amount, rate) {
  return (amount * rate).toFixed(2); // Convert and format to 2 decimal places
}
// Validation functions
const validateRegisterInput = (username, email, password, confirmPassword) => {
  const errors = {};

  if (username.trim() === "") errors.username = "Username must not be empty";

  if (email.trim() === "") {
    errors.email = "Email must not be empty";
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
      errors.email = "Email must be a valid email address";
  }

  if (password === "") {
    errors.password = "Password must not be empty";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords must match";
  }

  return {
    errors,
    valid: Object.keys(errors).length < 1,
  };
};

const validateLoginInput = (username, password) => {
  const errors = {};
  if (username.trim() === "") errors.username = "Username must not be empty";
  if (password.trim() === "") errors.password = "Password must not be empty";

  return {
    errors,
    valid: Object.keys(errors).length < 1,
  };
};

const validateUserId = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new UserInputError("User not found");
  return user;
};

const validatePackageId = async (packageId) => {
  const travelPackage = await TravelPackage.findById(packageId);
  if (!travelPackage) throw new UserInputError("Travel package not found");
  return travelPackage;
};

const validateUpdateProfileInput = (updateInput) => {
  const errors = {};

  if (updateInput.email) {
    if (updateInput.email.trim() === "") {
      errors.email = "Email must not be empty";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updateInput.email))
        errors.email = "Email must be a valid email address";
    }
  }

  if (
    updateInput.password &&
    updateInput.password !== updateInput.confirmPassword
  ) {
    errors.confirmPassword = "Passwords must match";
  }

  return {
    errors,
    valid: Object.keys(errors).length < 1,
  };
};

// Resolvers
const resolvers = {
  Query: {
    //get all packages resolver
    getAllPackages: async () => {
      try {
        const packages = await TravelPackage.find().sort({ createdAt: -1 });
        return packages;
      } catch (err) {
        throw new Error("Error fetching travel packages");
      }
    },
    //get packages resolver
    getPackages: async (_, { search, filter }) => {
      const query = {};
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: "i" } },
          { destination: { $regex: search, $options: "i" } },
        ];
      }

      if (filter) {
        if (filter.minPrice)
          query.price = { ...query.price, $gte: filter.minPrice };
        if (filter.maxPrice)
          query.price = { ...query.price, $lte: filter.maxPrice };
        if (filter.category)
          query.category = { $regex: filter.category, $options: "i" };
        if (filter.availability)
          query.availability = { $gte: filter.availability };
      }

      return await TravelPackage.find(query);
    },
    //get user profile resolver
    getUserProfile: async (_, { userId }) => {
      return validateUserId(userId);
    },
    //get bookings resolver
    getBookings: async (_, { userId }) => {
      try {
        if (!userId) throw new Error("User ID is required");

        const bookings = await Booking.find({ userId })
          .populate("packageId")
          .populate("userId")
          .lean()
          .exec();

        return bookings.map((booking) => {
          // Handle case where packageId might be null
          if (!booking.packageId) {
            return {
              ...booking,
              id: booking._id.toString(),
              userId: booking.userId._id.toString(),
              username: booking.userId.username,
              packageId: {
                id: "deleted",
                title: "Package Deleted",
                description: "This package is no longer available",
                price: 0,
                duration: "N/A",
                destination: "N/A",
                category: "N/A",
                availability: 0,
                createdAt: new Date().toISOString(),
              },
              date:
                booking.date instanceof Date
                  ? booking.date.toISOString()
                  : new Date(booking.date).toISOString(),
              status: "CANCELLED",
              createdAt:
                booking.createdAt instanceof Date
                  ? booking.createdAt.toISOString()
                  : new Date(booking.createdAt).toISOString(),
            };
          }

          // Return normal booking with valid packageId
          return {
            ...booking,
            id: booking._id.toString(),
            userId: booking.userId._id.toString(),
            username: booking.userId.username,
            packageId: {
              id: booking.packageId._id.toString(),
              title: booking.packageId.title,
              description: booking.packageId.description,
              price: booking.packageId.price,
              duration: booking.packageId.duration,
              destination: booking.packageId.destination,
              category: booking.packageId.category,
              availability: booking.packageId.availability,
              createdAt:
                booking.packageId.createdAt instanceof Date
                  ? booking.packageId.createdAt.toISOString()
                  : new Date(booking.packageId.createdAt).toISOString(),
            },
            date:
              booking.date instanceof Date
                ? booking.date.toISOString()
                : new Date(booking.date).toISOString(),
            createdAt:
              booking.createdAt instanceof Date
                ? booking.createdAt.toISOString()
                : new Date(booking.createdAt).toISOString(),
          };
        });
      } catch (error) {
        console.error("Error in getBookings:", error);
        throw new Error("Failed to fetch bookings: " + error.message);
      }
    },
    //get package by id resolver with currency conversion
    getPackageById: async (_, { id, currency }) => {
      try {
        const package = await TravelPackage.findById(id);
        if (!package) throw new UserInputError("Package not found");

        if (currency) {
          try {
            const rates = await fetchCurrencyRates(); // Fetch currency rates from ExchangeRatesAPI
            const conversionRate = rates[currency];

            if (conversionRate) {
              package.price = convertCurrency(package.price, conversionRate); // Convert price
            } else {
              throw new UserInputError("Invalid currency code");
            }
          } catch (error) {
            throw new Error("Failed to fetch currency rates: " + error.message);
          }
        }

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
        throw new Error("Error fetching package: " + error.message);
      }
    },
    //get all users resolver
    getAllUsers: async () => {
      try {
        return await User.find().sort({ createdAt: -1 }).select("-password");
      } catch (err) {
        throw new Error("Error fetching users");
      }
    },
    //get all bookings resolver
    getAllBookings: async () => {
      try {
        const bookings = await Booking.find()
          .populate({
            path: "userId",
            select: "username",
          })
          .populate("packageId")
          .lean()
          .exec();

        return bookings.map((booking) => {
          const user = booking.userId || {
            _id: "unknown",
            username: "Unknown User",
          };
          const travelPackage = booking.packageId || {
            _id: "unknown",
            title: "Unknown Package",
            description: "No description available",
            price: 0,
            duration: "N/A",
            destination: "N/A",
            category: "N/A",
            availability: 0,
            createdAt: new Date().toISOString(),
          };

          // Ensure dates are properly formatted as ISO strings
          const formattedDate =
            booking.date instanceof Date
              ? booking.date.toISOString()
              : new Date(booking.date).toISOString();

          const formattedCreatedAt =
            booking.createdAt instanceof Date
              ? booking.createdAt.toISOString()
              : new Date(booking.createdAt).toISOString();

          return {
            ...booking,
            id: booking._id.toString(),
            userId: user._id.toString(),
            username: user.username,
            packageId: {
              id: travelPackage._id.toString(),
              title: travelPackage.title,
              description: travelPackage.description,
              price: travelPackage.price,
              duration: travelPackage.duration,
              destination: travelPackage.destination,
              category: travelPackage.category,
              availability: travelPackage.availability,
              createdAt:
                travelPackage.createdAt instanceof Date
                  ? travelPackage.createdAt.toISOString()
                  : new Date(travelPackage.createdAt).toISOString(),
            },
            date: formattedDate,
            createdAt: formattedCreatedAt,
          };
        });
      } catch (error) {
        console.error("Error in getAllBookings:", error);
        throw new Error("Failed to fetch bookings: " + error.message);
      }
    },
    // Add new query for getting user's wishlist
    getUserWishlist: async (_, { userId }) => {
      try {
        const wishlist = await Wishlist.find({ userId })
          .populate("packageId")
          .lean();

        return wishlist.map((item) => ({
          id: item._id.toString(),
          userId: item.userId.toString(),
          packageId: {
            id: item.packageId._id.toString(),
            title: item.packageId.title,
            description: item.packageId.description,
            price: item.packageId.price,
            duration: item.packageId.duration,
            destination: item.packageId.destination,
            category: item.packageId.category,
            availability: item.packageId.availability,
            createdAt: item.packageId.createdAt,
          },
          createdAt: item.createdAt,
        }));
      } catch (error) {
        throw new Error("Error fetching wishlist: " + error.message);
      }
    },
    getAdminAnalytics: async () => {
      try {
        const bookings = await Booking.find().populate("packageId").exec();

        // Calculate the count of confirmed and cancelled bookings
        const confirmedBookingsCount = bookings.filter(
          (booking) => booking.status === "CONFIRMED"
        ).length;

        const cancelledBookingsCount = bookings.filter(
          (booking) => booking.status === "CANCELLED"
        ).length;

        // Existing logic for total revenue and most popular packages
        const packagePopularity = bookings.reduce((acc, booking) => {
          if (booking.packageId) {
            acc[booking.packageId._id] = (acc[booking.packageId._id] || 0) + 1;
          }
          return acc;
        }, {});

        // Sort packages by the number of bookings
        const mostPopularPackageIds = Object.entries(packagePopularity)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5) // Select top 5 packages
          .map(([id]) => id);

        // Fetch the most popular packages
        const mostPopularPackages = await TravelPackage.find({
          _id: { $in: mostPopularPackageIds },
        });

        // Calculate total revenue from confirmed bookings only
        const totalRevenue = bookings.reduce((sum, booking) => {
          if (
            booking.status === "CONFIRMED" &&
            booking.packageId &&
            typeof booking.packageId.price === "number"
          ) {
            return sum + booking.packageId.price;
          }
          return sum;
        }, 0);

        return {
          totalRevenue,
          totalBookings: bookings.length,
          mostPopularPackages,
          confirmedBookingsCount,
          cancelledBookingsCount,
        };
      } catch (error) {
        console.error("Error in getAdminAnalytics:", error);
        throw new Error("Failed to fetch analytics: " + error.message);
      }
    },
  },
  Mutation: {
    //login resolver
    login: async (_, { username, password }) => {
      const { errors, valid } = validateLoginInput(username, password);
      if (!valid) throw new UserInputError("Errors", { errors });

      const user = await User.findOne({ username });
      if (!user) {
        errors.general = "User not found";
        throw new UserInputError("User not found", { errors });
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        errors.general = "Wrong credentials";
        throw new UserInputError("Wrong credentials", { errors });
      }

      const token = generateToken(user);

      return { ...user._doc, id: user._id, token };
    },
    //register resolver
    register: async (
      _,
      { registerInput: { username, email, password, confirmPassword } }
    ) => {
      const { valid, errors } = validateRegisterInput(
        username,
        email,
        password,
        confirmPassword
      );
      if (!valid) throw new UserInputError("Errors", { errors });

      const existingUser = await User.findOne({
        $or: [{ username }, { email }],
      });
      if (existingUser)
        throw new UserInputError("Username or email is taken", {
          errors: { username: "This username or email is already taken" },
        });

      const hashedPassword = await bcrypt.hash(password, 12);

      const newUser = new User({
        email,
        username,
        password: hashedPassword,
        createdAt: new Date().toISOString(),
      });
      const res = await newUser.save();
      const token = generateToken(res);

      return { ...res._doc, id: res._id, token };
    },
    //create booking resolver
    createBooking: async (_, { packageId, userId, date }) => {
      try {
        const user = await validateUserId(userId);
        const travelPackage = await validatePackageId(packageId);

        // Check and update availability
        if (travelPackage.availability <= 3) {
          await TravelPackage.findByIdAndUpdate(packageId, {
            $inc: { availability: 3 },
          });
        }

        // Ensure date is a valid Date object
        const bookingDate = new Date(date);
        if (isNaN(bookingDate.getTime())) {
          throw new Error("Invalid date format");
        }

        const newBooking = new Booking({
          packageId,
          userId,
          date: bookingDate,
          status: "CONFIRMED",
          createdAt: new Date(),
        });

        const booking = await newBooking.save();
        await TravelPackage.findByIdAndUpdate(packageId, {
          $inc: { availability: -1 },
        });

        const populatedBooking = await Booking.findById(booking._id)
          .populate("packageId")
          .populate("userId")
          .lean();

        const transformedBooking = {
          id: populatedBooking._id.toString(),
          userId: populatedBooking.userId._id.toString(),
          username: populatedBooking.userId.username,
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
          date: bookingDate.toISOString(),
          status: populatedBooking.status,
          createdAt: new Date(populatedBooking.createdAt).toISOString(),
        };

        pubsub.publish("BOOKING_CREATED", {
          bookingCreated: transformedBooking,
        });

        return transformedBooking;
      } catch (error) {
        throw new Error("Error creating booking: " + error.message);
      }
    },
    //cancel booking resolver
    cancelBooking: async (_, { bookingId, userId }) => {
      try {
        const booking = await Booking.findOneAndUpdate(
          { _id: bookingId, userId },
          { status: "CANCELLED" },
          { new: true }
        ).populate("packageId");

        if (!booking) {
          throw new UserInputError("Booking not found");
        }

        // Increment the availability of the package
        await TravelPackage.findByIdAndUpdate(booking.packageId._id, {
          $inc: { availability: 1 },
        });

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
            createdAt: booking.packageId.createdAt,
          },
          date: booking.date,
          status: booking.status,
          createdAt: booking.createdAt,
        };
      } catch (error) {
        throw new Error("Error cancelling booking: " + error.message);
      }
    },
    //delete travel package resolver
    deleteTravelPackage: async (_, { packageId }, context) => {
      try {
        // Log the context and headers for debugging
        console.log("Context:", context);

        // Check admin status
        if (!context.isAdmin) {
          console.log("Admin check failed:", context.isAdmin);
          throw new Error(
            "Unauthorized: Only admins can delete travel packages"
          );
        }

        const travelPackage = await TravelPackage.findById(packageId);
        if (!travelPackage) {
          throw new Error("Travel package not found");
        }

        await TravelPackage.findByIdAndDelete(packageId);

        return {
          id: travelPackage._id.toString(),
          success: true,
          message: "Travel package deleted successfully",
        };
      } catch (error) {
        console.error("Delete error:", error);
        throw new Error(error.message);
      }
    },
    //remove user resolver
    removeUser: async (_, { userId }, context) => {
      try {
        // Check admin privileges
        if (!context.isAdmin) {
          throw new ForbiddenError(
            "Unauthorized: Only admins can remove users"
          );
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
          throw new UserInputError("User not found");
        }

        // Remove user
        await User.findByIdAndDelete(userId);

        return {
          id: userId,
          message: "User removed successfully",
        };
      } catch (error) {
        throw new Error("Error removing user: " + error.message);
      }
    },
    //add travel package resolver
    addTravelPackage: async (
      _,
      {
        title,
        description,
        price,
        duration,
        destination,
        category,
        availability,
      }
    ) => {
      try {
        const newPackage = new TravelPackage({
          title,
          description,
          price,
          duration,
          destination,
          category,
          availability,
          createdAt: new Date().toISOString(),
        });

        const res = await newPackage.save();
        return {
          ...res._doc,
          id: res._id.toString(),
        };
      } catch (err) {
        throw new Error("Error creating travel package: " + err.message);
      }
    },
    //edit travel package resolver
    editTravelPackage: async (_, { packageId, ...updateFields }, context) => {
      try {
        // Check admin privileges
        if (!context.isAdmin) {
          throw new ForbiddenError(
            "Unauthorized: Only admins can edit travel packages"
          );
        }

        // Find the travel package
        const travelPackage = await TravelPackage.findById(packageId);
        if (!travelPackage) {
          throw new UserInputError("Travel package not found");
        }

        // Update the fields
        Object.keys(updateFields).forEach((key) => {
          travelPackage[key] = updateFields[key];
        });

        const updatedPackage = await travelPackage.save();

        return updatedPackage;
      } catch (error) {
        throw new Error("Error editing package: " + error.message);
      }
    },
    //update user profile resolver
    updateUserProfile: async (_, { userId, updateInput }, context) => {
      try {
        // First check if user exists
        const existingUser = await User.findById(userId);
        if (!existingUser) {
          throw new UserInputError("User not found");
        }

        // Validate the input if email is being updated
        if (updateInput.email) {
          const { valid, errors } = validateUpdateProfileInput(updateInput);
          if (!valid) {
            throw new UserInputError("Errors", { errors });
          }
        }

        // Remove confirmPassword from updateInput if it exists
        const { confirmPassword, password, ...updateData } = updateInput;

        // If password is being updated, hash it
        if (password) {
          if (password !== confirmPassword) {
            throw new UserInputError("Passwords must match");
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
          token,
        };
      } catch (error) {
        throw new Error("Error updating user profile: " + error.message);
      }
    },
    // Add to wishlist mutation
    addToWishlist: async (_, { userId, packageId }) => {
      try {
        // Check if user exists
        const user = await validateUserId(userId);

        // Check if package exists
        const travelPackage = await validatePackageId(packageId);

        // Check if already in wishlist
        const existingWishlistItem = await Wishlist.findOne({
          userId,
          packageId,
        });
        if (existingWishlistItem) {
          throw new UserInputError("Package already in wishlist");
        }

        // Create new wishlist item
        const newWishlistItem = new Wishlist({
          userId,
          packageId,
          createdAt: new Date().toISOString(),
        });

        const savedItem = await newWishlistItem.save();
        const populatedItem = await Wishlist.findById(savedItem._id)
          .populate("packageId")
          .lean();

        return {
          id: populatedItem._id.toString(),
          userId: populatedItem.userId.toString(),
          packageId: {
            id: populatedItem.packageId._id.toString(),
            title: populatedItem.packageId.title,
            description: populatedItem.packageId.description,
            price: populatedItem.packageId.price,
            duration: populatedItem.packageId.duration,
            destination: populatedItem.packageId.destination,
            category: populatedItem.packageId.category,
            availability: populatedItem.packageId.availability,
            createdAt: populatedItem.packageId.createdAt,
          },
          createdAt: populatedItem.createdAt,
        };
      } catch (error) {
        throw new Error("Error adding to wishlist: " + error.message);
      }
    },

    // Remove from wishlist mutation
    removeFromWishlist: async (_, { userId, packageId }) => {
      try {
        // Check if wishlist item exists
        const wishlistItem = await Wishlist.findOneAndDelete({
          userId,
          packageId,
        })
          .populate("packageId")
          .lean();

        if (!wishlistItem) {
          throw new UserInputError("Wishlist item not found");
        }

        return {
          id: wishlistItem._id.toString(),
          userId: wishlistItem.userId.toString(),
          packageId: {
            id: wishlistItem.packageId._id.toString(),
            title: wishlistItem.packageId.title,
            description: wishlistItem.packageId.description,
            price: wishlistItem.packageId.price,
            duration: wishlistItem.packageId.duration,
            destination: wishlistItem.packageId.destination,
            category: wishlistItem.packageId.category,
            availability: wishlistItem.packageId.availability,
            createdAt: wishlistItem.packageId.createdAt,
          },
          createdAt: wishlistItem.createdAt,
        };
      } catch (error) {
        throw new Error("Error removing from wishlist: " + error.message);
      }
    },
  },
};

module.exports = resolvers;
