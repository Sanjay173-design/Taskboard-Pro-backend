const Redis = require("ioredis");

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379,
  tls: {},

  // 🚨 DO NOT set db
  // 🚨 DO NOT call select()

  enableReadyCheck: false,
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  connectTimeout: 2000,
});

redis.on("error", (err) => {
  console.warn("Redis error:", err.message);
});

module.exports = redis;
