module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const hostUrl = req.headers.host ? `https://${req.headers.host}` : '';

  const swaggerSpec = {
    openapi: "3.0.0",
    info: {
      title: "NutriLens API Documentation",
      version: "1.0.0",
      description: "Secure serverless proxy endpoints for Gemini AI model leasing, nutritional analysis, conversational advice, and Supabase database authentication & sync."
    },
    servers: [
      {
        url: hostUrl || "/",
        description: "NutriLens Serverless API Server"
      }
    ],
    components: {
      securitySchemes: {
        LeaseToken: {
          type: "http",
          scheme: "bearer",
          description: "Temporary API client lease token obtained from /api/lease"
        },
        UserSessionToken: {
          type: "http",
          scheme: "bearer",
          description: "Supabase JWT Access Token obtained from /api/signin or /api/signup"
        }
      },
      schemas: {
        UserProfile: {
          type: "object",
          properties: {
            user_id: { type: "string", format: "uuid" },
            height: { type: "number", format: "double", description: "Height in cm" },
            weight: { type: "number", format: "double", description: "Weight in kg" },
            target_bmi: { type: "number", format: "double", description: "Target BMI" },
            gender: { type: "string", default: "General" },
            age: { type: "integer" },
            backend_url: { type: "string" },
            internal_secret: { type: "string" },
            gemini_api_key: { type: "string" }
          }
        },
        FoodEntry: {
          type: "object",
          properties: {
            id: { type: "string", description: "Unique entry identifier (UUID or timestamp)" },
            user_id: { type: "string" },
            name: { type: "string" },
            protein: { type: "number", format: "double" },
            fat: { type: "number", format: "double" },
            carbs: { type: "number", format: "double" },
            fiber: { type: "number", format: "double" },
            iron: { type: "number", format: "double" },
            sodium: { type: "number", format: "double" },
            calcium: { type: "number", format: "double" },
            potassium: { type: "number", format: "double" },
            logged_at: { type: "string", format: "date-time" }
          }
        }
      }
    },
    paths: {
      "/api/lease": {
        post: {
          summary: "Acquire temporary lease token",
          description: "Exchange the internal client secret key for a 1-hour secure signature lease token to access AI endpoints.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    secret: { type: "string", description: "The internal secret key" }
                  },
                  required: ["secret"]
                }
              }
            }
          },
          responses: {
            200: {
              description: "Lease token issued",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      token: { type: "string", description: "Standard lease token formatted as: expiresAt.hmac_signature" },
                      expiresAt: { type: "integer", description: "Token expiry timestamp in ms" }
                    }
                  }
                }
              }
            },
            401: { description: "Invalid secret key" },
            500: { description: "Server Configuration Error" }
          }
        }
      },
      "/api/analyze": {
        post: {
          summary: "Analyze food text description or image base64 data",
          description: "Estimates the macro & micro nutritional breakdown. Requires a valid lease token in the Authorization header.",
          security: [{ LeaseToken: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    type: { type: "string", enum: ["text", "image"] },
                    text: { type: "string", description: "Description for text mode, or additional user context for image mode" },
                    image: { type: "string", description: "Base64 encoded image string (required if type is 'image')" },
                    mimeType: { type: "string", description: "Image mime type, e.g., image/jpeg (required if type is 'image')" }
                  },
                  required: ["type"]
                }
              }
            }
          },
          responses: {
            200: {
              description: "Nutrition analysis success",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      name: { type: "string", example: "Oatmeal with Bananas" },
                      protein: { type: "number", example: 12.5 },
                      fat: { type: "number", example: 4.5 },
                      carbs: { type: "number", example: 45.0 },
                      fiber: { type: "number", example: 4.0 },
                      iron: { type: "number", example: 1.8 },
                      sodium: { type: "number", example: 5.0 },
                      calcium: { type: "number", example: 25.0 },
                      potassium: { type: "number", example: 150.0 }
                    }
                  }
                }
              }
            },
            401: { description: "Unauthorized / Expired lease token" },
            400: { description: "Bad request - missing fields" },
            500: { description: "Analysis failed / Gemini API Error" }
          }
        }
      },
      "/api/chat": {
        post: {
          summary: "Chat with the AI Nutrition Advisor",
          description: "Generates dietary advice based on context and message history. Requires a valid lease token.",
          security: [{ LeaseToken: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    history: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          role: { type: "string", enum: ["user", "model"] },
                          message: { type: "string" }
                        }
                      }
                    },
                    context: { type: "string", description: "User health profile details and targets" }
                  },
                  required: ["message"]
                }
              }
            }
          },
          responses: {
            200: {
              description: "AI Advisor reply response",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      reply: { type: "string" }
                    }
                  }
                }
              }
            },
            401: { description: "Unauthorized" },
            500: { description: "Chat generation failed" }
          }
        }
      },
      "/api/location": {
        get: {
          summary: "Inferred geolocation lookup",
          description: "Finds the approximate city/country location using IP/Vercel Geo Headers fallback.",
          security: [{ LeaseToken: [] }],
          responses: {
            200: {
              description: "Location resolved successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      location: { type: "string", example: "Jakarta, Special Capital Region of Jakarta, Indonesia" },
                      source: { type: "string" }
                    }
                  }
                }
              }
            },
            401: { description: "Unauthorized" }
          }
        }
      },
      "/api/signup": {
        post: {
          summary: "Register a new user",
          description: "Creates auth user in Supabase, inserts initial health profile parameters, and logs login event.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string", minLength: 6 },
                    height: { type: "number" },
                    weight: { type: "number" },
                    targetBmi: { type: "number" },
                    age: { type: "integer" },
                    gender: { type: "string" }
                  },
                  required: ["email", "password"]
                }
              }
            }
          },
          responses: {
            200: {
              description: "Sign up successful, returns Supabase user session token",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      session: { type: "object" },
                      user: { type: "object" },
                      profile: { $ref: "#/components/schemas/UserProfile" }
                    }
                  }
                }
              }
            },
            400: { description: "Invalid credentials or email already registered" }
          }
        }
      },
      "/api/signin": {
        post: {
          summary: "Authenticate user and open session",
          description: "Authenticates with Supabase using email and password, returning session data including the access JWT token.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    email: { type: "string" },
                    password: { type: "string" }
                  },
                  required: ["email", "password"]
                }
              }
            }
          },
          responses: {
            200: {
              description: "Sign in successful",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      session: { type: "object" },
                      user: { type: "object" }
                    }
                  }
                }
              }
            },
            400: { description: "Invalid credentials / authentication failed" }
          }
        }
      },
      "/api/profile": {
        get: {
          summary: "Get user health profile",
          description: "Retrieve profile statistics for the authenticated user.",
          security: [{ UserSessionToken: [] }],
          responses: {
            200: {
              description: "Profile returned",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/UserProfile" }
                }
              }
            },
            401: { description: "Unauthorized" },
            404: { description: "Profile not found" }
          }
        },
        post: {
          summary: "Upsert user health profile",
          description: "Save or update profile parameters (height, weight, target BMI, custom API configuration keys).",
          security: [{ UserSessionToken: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserProfile" }
              }
            }
          },
          responses: {
            200: {
              description: "Profile updated successfully",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/UserProfile" }
                }
              }
            },
            401: { description: "Unauthorized" },
            400: { description: "Invalid parameters" }
          }
        }
      },
      "/api/entries": {
        get: {
          summary: "List food log entries",
          description: "Fetches all food entries logged by the user, ordered by logged_at descending.",
          security: [{ UserSessionToken: [] }],
          responses: {
            200: {
              description: "List of food entries",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/FoodEntry" }
                  }
                }
              }
            },
            401: { description: "Unauthorized" }
          }
        },
        post: {
          summary: "Upsert a food log entry",
          description: "Creates a new food entry, or updates an existing one if the ID already exists.",
          security: [{ UserSessionToken: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FoodEntry" }
              }
            }
          },
          responses: {
            200: {
              description: "Food entry saved successfully",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/FoodEntry" }
                }
              }
            },
            401: { description: "Unauthorized" },
            400: { description: "Invalid parameters" }
          }
        },
        delete: {
          summary: "Delete food entry/entries",
          description: "Deletes a specific entry if the 'id' query parameter is specified. If 'id' is omitted, clears all entries logged by the user.",
          security: [{ UserSessionToken: [] }],
          parameters: [
            {
              name: "id",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "ID of the specific food entry to delete. Omit to clear all."
            }
          ],
          responses: {
            200: {
              description: "Deletion complete",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      message: { type: "string" }
                    }
                  }
                }
              }
            },
            401: { description: "Unauthorized" }
          }
        }
      }
    }
  };

  return res.status(200).json(swaggerSpec);
};
