// test_park/backend/swagger.js
import swaggerJsdoc from "swagger-jsdoc";

const swaggerDefinition = {
  openapi: "3.0.3",
  info: {
    title: "Carfour API",
    version: "1.0.0",
    description: "API documentation for your backend (test_park).",
  },
  servers: [
    {
      url: "http://localhost:5000",
      description: "Local Development Server",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      User: {
        type: "object",
        properties: {
          _id: { type: "string" },
          name: { type: "string", example: "Abhishek Rawat" },
          email: { type: "string", example: "abhishek@example.com" },
          isVerified: { type: "boolean", example: true }
        },
      },
      AuthRegisterRequest: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name: { type: "string", example: "Abhishek Rawat" },
          email: { type: "string", example: "abhishek@example.com" },
          password: { type: "string", example: "123456" },
        },
      },
      AuthLoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", example: "abhishek@example.com" },
          password: { type: "string", example: "123456" },
        },
      },
      Rating: {
        type: "object",
        properties: {
          _id: { type: "string" },
          sellerId: { type: "string" },
          buyerId: { type: "string" },
          stars: { type: "integer", minimum: 1, maximum: 5, example: 4 },
          comment: { type: "string", example: "Good buyer" },
          createdAt: { type: "string", format: "date-time" },
        },
        required: ["sellerId", "buyerId", "stars"],
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
};

export const swaggerOptions = {
  definition: swaggerDefinition,

  // ✅ IMPORTANT: These paths MUST match your backend folder structure
  apis: [
    "index.js",        // for server-level comments if needed
    "routes/*.js",     // <--- loads your route annotations
    "routes/**/*.js",
  ],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);
