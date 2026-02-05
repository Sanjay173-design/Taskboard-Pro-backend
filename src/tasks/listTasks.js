const redis = require("../utils/redis");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");
const { res } = require("../utils/response");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

module.exports.listTasks = async (event, context) => {
  try {
    context.callbackWaitsForEmptyEventLoop = false;
    const claims = event.requestContext?.authorizer?.jwt?.claims || {
      sub: "OFFLINE-USER",
    };
    const projectId = event.queryStringParameters?.projectId;

    if (!projectId) {
      return res(400, { error: "projectId is required" });
    }

    // 🔑 Cache key (user + project scoped)
    const cacheKey = `tasks:${claims.sub}:${projectId}`;

    // 1️⃣ Try Redis first (ONLY if redis is available)
    if (redis) {
      try {
        const cachedTasks = await redis.get(cacheKey);
        if (cachedTasks) {
          console.log("CACHE HIT");
          return res(200, JSON.parse(cachedTasks));
        }
      } catch (cacheErr) {
        console.warn(
          "Redis read failed, falling back to DB:",
          cacheErr.message,
        );
      }
    }
    console.log("CACHE MISS — fetching from DynamoDB");

    // 2️⃣ Fetch from DynamoDB
    const result = await docClient.send(
      new ScanCommand({
        TableName: "Tasks",
        FilterExpression: "projectId = :pid AND ownerId = :uid",
        ExpressionAttributeValues: {
          ":pid": projectId,
          ":uid": claims.sub,
        },
      }),
    );

    const items = result.Items || [];

    // 3️⃣ Save to Redis (ONLY if redis exists)
    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(items), "EX", 60);
        console.log("CACHE WRITE OK");
      } catch (cacheErr) {
        console.warn("Redis write failed:", cacheErr.message);
      }
    }

    return res(200, items);
  } catch (err) {
    console.error("listTasks failed:", err);
    return res(500, { error: "Failed to fetch tasks" });
  }
};
