const { gql } = require("apollo-server-express");

const typeDefs = gql`
  type User {
    id: ID!
    email: String!
    username: String!
    firstName: String
    lastName: String
    phoneNumber: String
    createdAt: String!
    token: String
  }

  type TravelPackage {
    id: ID!
    title: String!
    description: String!
    price: Float!
    duration: String!
    destination: String!
    category: String!
    availability: Int!
    createdAt: String!
  }

  type Booking {
    id: ID!
    userId: ID!
    username: String!
    packageId: TravelPackage!
    date: String!
    status: BookingStatus!
    createdAt: String!
  }

  enum BookingStatus {
    CONFIRMED
    PENDING
    CANCELLED
  }
  type DeleteUserResponse {
    id: ID!
    message: String!
  }

  input RegisterInput {
    username: String!
    email: String!
    password: String!
    confirmPassword: String!
  }

  input UpdateUserInput {
    username: String
    email: String
    firstName: String
    lastName: String
    phoneNumber: String
    password: String
    confirmPassword: String
  }

  input FilterInput {
    minPrice: Float
    maxPrice: Float
    category: String
    availability: Int
  }

  input TravelPackageInput {
    title: String!
    description: String!
    price: Float!
    duration: String!
    destination: String!
    category: String!
    availability: Int!
  }

  type Wishlist {
    id: ID!
    userId: ID!
    packageId: TravelPackage!
    createdAt: String!
  }

  type Analytics {
    totalRevenue: Float!
    totalBookings: Int!
    mostPopularPackages: [TravelPackage!]!
    confirmedBookingsCount: Int!
    cancelledBookingsCount: Int!
  }

  type Query {
    getPackages(search: String, filter: FilterInput): [TravelPackage!]
    getAllPackages: [TravelPackage!]!
    getPackageById(id: ID!, currency: String): TravelPackage
    getUserProfile(userId: ID!): User!
    getBookings(userId: ID!): [Booking]!
    getAllUsers: [User]
    getAllBookings: [Booking]!
    getUserWishlist(userId: ID!): [Wishlist!]!
    getAdminAnalytics: Analytics!
  }

  type Mutation {
    register(registerInput: RegisterInput): User!
    login(username: String!, password: String!): User!
    logout(userId: ID!): Boolean!
    updateUserProfile(userId: ID!, updateInput: UpdateUserInput!): User!
    createBooking(packageId: ID!, userId: ID!, date: String!): Booking!
    cancelBooking(bookingId: ID!, userId: ID!): Booking!
    addTravelPackage(
      title: String!
      description: String!
      price: Float!
      duration: String!
      destination: String!
      category: String!
      availability: Int!
    ): TravelPackage!
    editTravelPackage(
      packageId: ID!
      title: String!
      description: String!
      price: Float!
      duration: String!
      destination: String!
      category: String!
      availability: Int!
    ): TravelPackage!
    deleteTravelPackage(packageId: ID!): DeletePackageResponse!
    removeUser(userId: ID!): DeleteUserResponse!
    addToWishlist(userId: ID!, packageId: ID!): Wishlist!
    removeFromWishlist(userId: ID!, packageId: ID!): Wishlist!
  }

  type Subscription {
    bookingCreated: Booking!
    bookingCancelled: Booking!
  }
  type DeletePackageResponse {
    id: ID!
    message: String!
  }

  input BookingInput {
    packageId: ID!
    userId: ID!
    date: String!
  }
`;

module.exports = typeDefs;
