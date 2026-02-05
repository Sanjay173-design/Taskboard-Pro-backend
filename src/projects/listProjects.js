const redis = require("../utils/redis");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");
const { res } = require("../utils/response");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

module.exports.listProjects = async (event, context) => {
  try {
    context.callbackWaitsForEmptyEventLoop = false;

    const claims = event.requestContext?.authorizer?.jwt?.claims || {
      sub: "OFFLINE-USER",
    };

    const workspaceId = event.queryStringParameters?.workspaceId;

    if (!workspaceId) {
      return res(400, { error: "workspaceId is required" });
    }

    const cacheKey = `projects:${claims.sub}:${workspaceId}`;

    // 1️⃣ Try Redis
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log("CACHE HIT (projects)");
        return res(200, JSON.parse(cached));
      }
    } catch (err) {
      console.warn("Redis read failed (projects):", err.message);
    }

    console.log("CACHE MISS (projects) — fetching from DynamoDB");

    // 2️⃣ Fetch from DynamoDB
    const result = await docClient.send(
      new ScanCommand({
        TableName: "Projects",
        FilterExpression: "workspaceId = :wid AND ownerId = :uid",
        ExpressionAttributeValues: {
          ":wid": workspaceId,
          ":uid": claims.sub,
        },
      }),
    );

    const items = result.Items || [];

    // 3️⃣ Save to Redis (TTL = 5 min)
    try {
      await redis.set(cacheKey, JSON.stringify(items), "EX", 300);
      console.log("CACHE WRITE OK (projects)");
    } catch (err) {
      console.warn("Redis write failed (projects):", err.message);
    }

    return res(200, items);
  } catch (err) {
    console.error("listProjects failed:", err);
    return res(500, { error: "Failed to fetch projects" });
  }
};
