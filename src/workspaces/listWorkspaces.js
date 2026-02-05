const redis = require("../utils/redis");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");
const { res } = require("../utils/response");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

module.exports.listWorkspaces = async (event, context) => {
  try {
    context.callbackWaitsForEmptyEventLoop = false;

    const claims = event.requestContext?.authorizer?.jwt?.claims || {
      sub: "OFFLINE-USER",
    };

    const cacheKey = `workspaces:${claims.sub}`;

    // 1️⃣ Try Redis
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log("CACHE HIT (workspaces)");
        return res(200, JSON.parse(cached));
      }
    } catch (err) {
      console.warn("Redis read failed (workspaces):", err.message);
    }

    console.log("CACHE MISS (workspaces) — fetching from DynamoDB");

    // 2️⃣ Fetch from DynamoDB
    const result = await docClient.send(
      new ScanCommand({
        TableName: "Workspaces",
        FilterExpression: "ownerId = :uid",
        ExpressionAttributeValues: {
          ":uid": claims.sub,
        },
      }),
    );

    const items = result.Items || [];

    // 3️⃣ Save to Redis (TTL = 5 min)
    try {
      await redis.set(cacheKey, JSON.stringify(items), "EX", 300);
      console.log("CACHE WRITE OK (workspaces)");
    } catch (err) {
      console.warn("Redis write failed (workspaces):", err.message);
    }

    return res(200, items);
  } catch (err) {
    console.error("listWorkspaces failed:", err);
    return res(500, { error: "Failed to fetch workspaces" });
  }
};
